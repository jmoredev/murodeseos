-- Preferencias de notificación por grupo.
--
-- Cada miembro decide, grupo a grupo, qué avisos quiere recibir. La preferencia
-- vive en la base porque quien actúa (el dueño que añade un deseo, quien reserva)
-- no puede leer las preferencias de los demás bajo RLS. Se aplica en un único
-- punto: un `BEFORE INSERT` sobre `notifications` descarta la fila cuando el
-- destinatario tiene ese tipo desactivado para el grupo de la propia fila. Así
-- vale para las cuatro vías de creación (dos triggers y dos inserciones de
-- cliente) sin tocar la lógica que las crea, y solo afecta a avisos futuros.
--
-- También se añade una guarda `auth.uid() is not null` a los dos triggers que
-- crean avisos: el seed corre con service_role (sin usuario), y una siembra no
-- debe parecer que hubo actividad real.

-- 1. Tabla de preferencias. Ausencia de fila = activado. La clave foránea
-- compuesta a `group_members` garantiza que solo hay preferencias de miembros y
-- las limpia al salir del grupo.
create table if not exists public.group_notification_preferences (
  user_id uuid not null,
  group_id text not null,
  notification_type text not null
    check (notification_type in (
      'wish_added',
      'wish_reserved',
      'wish_deleted_by_owner',
      'draw_performed'
    )),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, group_id, notification_type),
  constraint group_notification_preferences_member_fkey
    foreign key (group_id, user_id)
    references public.group_members (group_id, user_id)
    on delete cascade
);

alter table public.group_notification_preferences enable row level security;

-- La API solo lee y escribe las propias; el default de Supabase concede demás.
revoke all on public.group_notification_preferences from anon, authenticated, public;
grant select, insert, update, delete on table public.group_notification_preferences to authenticated;

-- 2. RLS: cada quien ve y edita solo sus preferencias. La pertenencia al grupo ya
-- la exige la clave foránea, así que no hace falta repetirla.
drop policy if exists "Veo mis preferencias de aviso" on public.group_notification_preferences;

create policy "Veo mis preferencias de aviso"
  on public.group_notification_preferences
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Creo mis preferencias de aviso" on public.group_notification_preferences;

create policy "Creo mis preferencias de aviso"
  on public.group_notification_preferences
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Actualizo mis preferencias de aviso" on public.group_notification_preferences;

create policy "Actualizo mis preferencias de aviso"
  on public.group_notification_preferences
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Borro mis preferencias de aviso" on public.group_notification_preferences;

create policy "Borro mis preferencias de aviso"
  on public.group_notification_preferences
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- 3. ¿El destinatario tiene activado este tipo en este grupo? Sin fila, sí.
create or replace function private.notification_enabled(
  target_user uuid,
  target_group text,
  target_type text
)
 returns boolean
 language sql
 stable
 security definer
 set search_path = public
as $$
  select coalesce(
    (
      select p.enabled
      from public.group_notification_preferences as p
      where p.user_id = target_user
        and p.group_id = target_group
        and p.notification_type = target_type
    ),
    true
  );
$$;

revoke all on function private.notification_enabled(uuid, text, text) from public, anon, authenticated;

-- 4. Punto único de control: descarta el aviso desactivado antes de insertarlo.
-- `group_id` nulo (aviso sin grupo) no tiene preferencia por grupo y pasa.
create or replace function private.enforce_notification_preference()
 returns trigger
 language plpgsql
 security definer
 set search_path = public
as $$
begin
  if new.group_id is not null
     and not private.notification_enabled(new.user_id, new.group_id, new.type) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_enforce_notification_preference on public.notifications;

create trigger tr_enforce_notification_preference
  before insert on public.notifications
  for each row
  execute function private.enforce_notification_preference();

revoke all on function private.enforce_notification_preference() from public, anon, authenticated;

-- 5. Guardas de autoría: solo acciones de usuario real generan avisos. Sin esto,
-- el seed (service_role, `auth.uid()` nulo) creaba avisos de reserva al sembrar.
create or replace function private.notify_wish_reserved()
 returns trigger
 language plpgsql
 security definer
 set search_path = public
as $$
declare
  v_owner_id uuid;
  v_excluded text[];
begin
  -- Reservas del seed o de la administración: no son actividad de nadie.
  if (select auth.uid()) is null then
    return null;
  end if;

  -- Dueño del deseo reservado y los grupos de los que el deseo está excluido.
  select i.user_id, coalesce(i.excluded_group_ids, '{}'::text[])
    into v_owner_id, v_excluded
  from public.wishlist_items as i
  where i.id = new.item_id;

  if v_owner_id is null or v_owner_id = new.reserver_id then
    return null;
  end if;

  insert into public.notifications (user_id, actor_id, group_id, wish_id, type)
  select distinct on (m.user_id)
    m.user_id,
    new.reserver_id,
    m.group_id,
    new.item_id,
    'wish_reserved'
  from public.group_members as mine
  join public.group_members as theirs
    on theirs.group_id = mine.group_id
  join public.group_members as m
    on m.group_id = mine.group_id
  where mine.user_id = new.reserver_id
    and theirs.user_id = v_owner_id
    and m.user_id <> new.reserver_id
    and m.user_id <> v_owner_id
    and not (mine.group_id = any (v_excluded))
  order by m.user_id, m.group_id;

  return null;
end;
$$;

revoke all on function private.notify_wish_reserved() from public, anon, authenticated;

create or replace function private.notify_wish_deleted()
 returns trigger
 language plpgsql
 security definer
 set search_path = public
as $$
declare
  v_reserver_id uuid;
  v_group_id text;
begin
  -- Borrados del seed o de la administración: no generan aviso.
  if (select auth.uid()) is null then
    return old;
  end if;

  select r.reserver_id into v_reserver_id
  from public.wishlist_reservations as r
  where r.item_id = old.id;

  if v_reserver_id is null or v_reserver_id = old.user_id then
    return old;
  end if;

  select mine.group_id into v_group_id
  from public.group_members as mine
  join public.group_members as theirs on mine.group_id = theirs.group_id
  where mine.user_id = old.user_id
    and theirs.user_id = v_reserver_id
  order by mine.group_id
  limit 1;

  insert into public.notifications (user_id, actor_id, group_id, wish_id, type, metadata)
  values (
    v_reserver_id,
    old.user_id,
    v_group_id,
    null,
    'wish_deleted_by_owner',
    jsonb_build_object('wish_title', old.title)
  );

  return old;
end;
$$;

revoke all on function private.notify_wish_deleted() from public, anon, authenticated;
