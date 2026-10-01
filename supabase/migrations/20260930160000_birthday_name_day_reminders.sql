-- Cumpleaños y onomástico: perfil, ajustes de antelación y RPC generador.
--
-- Unidad A de `feat/cumpleanos-onomastico`:
--   A1: `profiles.birth_date` / `profiles.name_day` (nullable; el año del
--       onomástico es irrelevante, solo cuenta mes+día).
--   A2: los CHECK de tipo aceptan `birthday` y `name_day`.
--   A3: `group_reminder_settings` con antelación configurable por grupo
--       (defecto 15 días, válida 1..365).
--   A4: RPC `generate_birthday_reminders` que crea los avisos próximos.
--
-- Nota de exposición: PostgREST solo expone `public` (config.toml: `schemas`),
-- igual que el comentario de 20260513185000. La implementación vive en `private`
-- (no genera /rpc/...) y un envoltorio delgado en `public` es lo que el cliente
-- llama con `supabase.rpc('generate_birthday_reminders')`.

-- ------------------------------------------------------------------
-- A1. Columnas de perfil.
-- ------------------------------------------------------------------
alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists name_day date;

-- ------------------------------------------------------------------
-- A2. Tipos nuevos en los CHECK existentes.
--
-- Nombres exactos: el CHECK de `notifications.type` se reinstauró como
-- `notifications_type_check` en 20260512120000; el de
-- `group_notification_preferences.notification_type` es un check de columna
-- sin nombre (migración 20260929130000), así que postgres le dio el nombre
-- por defecto `<tabla>_<columna>_check`.
-- ------------------------------------------------------------------
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'wish_added',
    'wish_reserved',
    'draw_performed',
    'wish_deleted_by_owner',
    'birthday',
    'name_day'
  ));

alter table public.group_notification_preferences
  drop constraint if exists group_notification_preferences_notification_type_check;

alter table public.group_notification_preferences
  add constraint group_notification_preferences_notification_type_check
  check (notification_type in (
    'wish_added',
    'wish_reserved',
    'wish_deleted_by_owner',
    'draw_performed',
    'birthday',
    'name_day'
  ));

-- ------------------------------------------------------------------
-- A3. Antelación de recordatorios por usuario y grupo.
--
-- `groups.id`/`group_members.group_id` son TEXT (migración 20260102122206),
-- así que `group_id` también es TEXT aquí. La clave foránea compuesta a
-- `group_members(group_id, user_id)` (única vía índice
-- `group_members_group_id_user_id_key`) garantiza que solo existen ajustes
-- de miembros y los limpia al salir del grupo, igual que hace la tabla de
-- preferencias en 20260929130000.
-- ------------------------------------------------------------------
create table if not exists public.group_reminder_settings (
  user_id uuid not null,
  group_id text not null,
  lead_days int not null default 15,
  updated_at timestamptz not null default now(),
  primary key (user_id, group_id),
  constraint group_reminder_settings_lead_days_check
    check (lead_days between 1 and 365),
  constraint group_reminder_settings_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on delete cascade,
  constraint group_reminder_settings_member_fkey
    foreign key (group_id, user_id)
    references public.group_members (group_id, user_id)
    on delete cascade
);

alter table public.group_reminder_settings enable row level security;

-- La API solo lee y escribe las propias; el default de Supabase concede demás.
revoke all on public.group_reminder_settings from anon, authenticated, public;
grant select, insert, update, delete on table public.group_reminder_settings to authenticated;

drop policy if exists "Veo mi antelación de avisos" on public.group_reminder_settings;

create policy "Veo mi antelación de avisos"
  on public.group_reminder_settings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Creo mi antelación de avisos" on public.group_reminder_settings;

create policy "Creo mi antelación de avisos"
  on public.group_reminder_settings
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Actualizo mi antelación de avisos" on public.group_reminder_settings;

create policy "Actualizo mi antelación de avisos"
  on public.group_reminder_settings
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Borro mi antelación de avisos" on public.group_reminder_settings;

create policy "Borro mi antelación de avisos"
  on public.group_reminder_settings
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------------
-- A4. RPC generador.
--
-- * SECURITY DEFINER: lee group_members/perfiles de los demás sin tocar RLS,
--   igual que las vías de aviso existentes.
-- * Solo sesiones autenticadas generan avisos (service_role/anon no generan
--   nada), siguiendo la guarda de 20260929130000.
-- * Por cada grupo del que el llamador es miembro, recuerda el cumpleaños y/o
--   el onomástico de los OTROS miembros (nunca al propio homenajeado), dentro
--   de `today .. today + lead_days` (UTC de `now()`; un día de diferencia por
--   zona horaria es limitación aceptada en la feature).
-- *límite*: `lead_days` sale de `group_reminder_settings` para
--   (llamador, grupo); sin fila vale 15.
-- * Enforcement del tipo: NO se consulta `private.notification_enabled` aquí;
--   el trigger `tr_enforce_notification_preference` (BEFORE INSERT sobre
--   notifications) es el único punto de control y descarta en silencio las
--   filas con el tipo desactivado. Si la preferencia se activa más tarde y el
--   evento sigue en ventana, la siguiente llamada lo genera.
-- * Reglas de fecha: "próxima ocurrencia" del mes+día, con vuelta de año
--   (eventos de enero se avisan en diciembre) y 29-feb → 28-feb en años no
--   bisiestos.
-- * Dedupe: una sola notificación por
--   (destinatario, homenajeado, grupo, tipo) y año natural del evento. La
--   clave se firma en `metadata.event_year`, así que el anti-join no se
--   equivoca cuando el evento cae al año siguiente (diciembre→enero). Sin
--   índice único parcial: al re-llamarse justo al cargar notificaciones, el
--   anti-join basta y no toca la tabla ajena al feature.
-- ------------------------------------------------------------------
create or replace function private.generate_birthday_reminders()
 returns void
 language plpgsql
 security definer
 set search_path = public
as $$
declare
  v_caller uuid := (select auth.uid());
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_caller is null then
    return;
  end if;

  insert into public.notifications (user_id, actor_id, group_id, wish_id, type, metadata)
  select
    v_caller,
    ev.honoree_id,
    ev.group_id,
    null::uuid,
    ev.event_type,
    jsonb_build_object(
      'event_year', to_char(ev.event_date, 'YYYY'),
      'event_date', ev.event_date::text,
      'honoree_id', ev.honoree_id,
      'honoree_display_name', coalesce(p.display_name, p.full_name, p.username)
    )
  from (
    select
      o.group_id,
      o.honoree_id,
      o.event_type,
      case
        when nx.occ_this_year >= v_today then nx.occ_this_year
        else nx.occ_next_year
      end as event_date,
      o.lead_days
    from (
      select
        b.group_id,
        b.honoree_id,
        b.event_type,
        b.origin_date,
        coalesce(s.lead_days, 15) as lead_days,
        date_part('year', v_today)::int as caller_year
      from (
        select
          mine.group_id,
          other.user_id as honoree_id,
          'birthday'::text as event_type,
          p.birth_date as origin_date
        from public.group_members as mine
        join public.group_members as other
          on other.group_id = mine.group_id
         and other.user_id <> mine.user_id
        join public.profiles as p
          on p.id = other.user_id
        where mine.user_id = v_caller
          and p.birth_date is not null
        union all
        select
          mine.group_id,
          other.user_id,
          'name_day'::text,
          p.name_day
        from public.group_members as mine
        join public.group_members as other
          on other.group_id = mine.group_id
         and other.user_id <> mine.user_id
        join public.profiles as p
          on p.id = other.user_id
        where mine.user_id = v_caller
          and p.name_day is not null
      ) as b
      left join public.group_reminder_settings as s
        on s.user_id = v_caller
       and s.group_id = b.group_id
    ) as o
    join lateral (
      select
        -- Next occurrence of the event's month+day: first within the caller's
        -- current year, else the following one (year wrap). Feb 29 maps to
        -- Feb 28 in non-leap years.
        case
          when extract(month from o.origin_date) = 2
               and extract(day from o.origin_date) = 29
               and not ((o.caller_year % 4 = 0 and o.caller_year % 100 <> 0)
                        or o.caller_year % 400 = 0)
          then make_date(o.caller_year, 2, 28)
          else make_date(o.caller_year,
                         extract(month from o.origin_date)::int,
                         extract(day from o.origin_date)::int)
        end as occ_this_year,
        case
          when extract(month from o.origin_date) = 2
               and extract(day from o.origin_date) = 29
               and not (((o.caller_year + 1) % 4 = 0 and (o.caller_year + 1) % 100 <> 0)
                        or (o.caller_year + 1) % 400 = 0)
          then make_date(o.caller_year + 1, 2, 28)
          else make_date(o.caller_year + 1,
                         extract(month from o.origin_date)::int,
                         extract(day from o.origin_date)::int)
        end as occ_next_year
    ) as nx on true
  ) as ev
  join public.profiles as p
    on p.id = ev.honoree_id
  where ev.event_date >= v_today
    and ev.event_date <= v_today + ev.lead_days
    -- Dedupe: one notification per (recipient, honoree, group, type) per
    -- calendar year of the upcoming event. `metadata.event_year` is stamped
    -- by this same insert, so repeated calls never duplicate, including the
    -- Dec→Jan wrap.
    and not exists (
      select 1
      from public.notifications as n
      where n.user_id = v_caller
        and n.actor_id = ev.honoree_id
        and n.group_id = ev.group_id
        and n.type = ev.event_type
        and n.metadata->>'event_year' = to_char(ev.event_date, 'YYYY')
    );
end;
$$;

revoke all on function private.generate_birthday_reminders() from public, anon;
-- El envoltorio `public` es invoker: para llamar aquí dentro, `authenticated`
-- necesita USAGE del esquema (ya lo concedía 20260513185000; se repite por idempotencia).
grant usage on schema private to authenticated, service_role;
grant execute on function private.generate_birthday_reminders() to authenticated, service_role;

-- Envoltorio expuesto por PostgREST (solo `public` está en la API según
-- config.toml). Invoker: el llamador autenticado necesita EXECUTE sobre la
-- función de `private`, que ya se concede arriba. Cualquiera sin esa
-- concesión (anon) no puede pasar por aquí.
create or replace function public.generate_birthday_reminders()
 returns void
 language plpgsql
 security invoker
 set search_path = public
as $$
begin
  perform private.generate_birthday_reminders();
end;
$$;

revoke all on function public.generate_birthday_reminders() from public, anon;
grant execute on function public.generate_birthday_reminders() to authenticated, service_role;
