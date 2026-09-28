-- Reservas privadas y visibilidad por grupo.
-- Mueve la reserva de regalos fuera de `wishlist_items.reserved_by` a una tabla
-- dedicada, cierra la lectura de una lista de deseos a quien comparte un grupo
-- (menos los grupos excluidos) y evita que el cliente del dueño reciba autoría.
-- Todos los cambios son idempotentes y aditivos para poder reejecutarse.
--
-- FASE 1 DE 2: NO borra `wishlist_items.reserved_by` (ni su índice ni su FK).
-- La tabla nueva es la fuente de verdad; la columna queda como espejo del
-- cliente ya cargado, sincronizada por los disparadores del bloque 10. La fase
-- 2, posterior, borra columna, índice y FK, y eso completa el arreglo de
-- privacidad: durante la ventana la identidad de quien reserva sigue legible.

-- 1. Tabla de reservas: `item_id` como PK garantiza una sola reserva por deseo.
create table if not exists public.wishlist_reservations (
  item_id uuid primary key references public.wishlist_items(id) on delete cascade,
  reserver_id uuid not null references auth.users(id) on delete cascade,
  reserved_at timestamptz not null default now()
);

-- RLS activada; las políticas se crean en el bloque 8.
alter table public.wishlist_reservations enable row level security;

-- Índice sobre `reserver_id` para que "mis reservas" sea barato.
create index if not exists idx_wishlist_reservations_reserver_id
  on public.wishlist_reservations (reserver_id);

-- 2. Privilegios: Supabase aplica default privileges a tablas nuevas de `public`,
-- así que hay que revocar explícitamente y volver a conceder solo lo necesario.
-- La API nunca actualiza una reserva, por eso no se concede UPDATE.
revoke all on public.wishlist_reservations from anon, authenticated;
revoke all on public.wishlist_reservations from public;
grant select, insert, delete on table public.wishlist_reservations to authenticated;

-- 3. Retirada de la política de reserva por terceros: un tercero nunca debe
-- poder actualizar un deseo ajeno. En fase 1 se sustituye por una versión más
-- estrecha, que además exige compartir grupo con el dueño (bloque 10).
drop policy if exists "Reserva o cancelación en listas ajenas" on public.wishlist_items;

-- 4. Copia de las reservas existentes. FASE 1: se conserva `reserved_by`
-- (columna, índice y FK `wishlist_items_reserved_by_fkey` incluidos) como
-- espejo de compatibilidad, así que la copia solo rellena la tabla nueva con
-- lo que la columna aún tiene. Idempotente: una segunda ejecución no copia
-- nada, porque el `ON CONFLICT DO NOTHING` ya encontró esas filas.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wishlist_items'
      and column_name = 'reserved_by'
  ) then
    -- Copia las reservas activas conservando la fecha original si existe.
    insert into public.wishlist_reservations (item_id, reserver_id, reserved_at)
    select id, reserved_by, coalesce(updated_at, now())
    from public.wishlist_items
    where reserved_by is not null
    on conflict (item_id) do nothing;

    -- Aborta si quedara alguna reserva en la columna sin fila en la tabla: la
    -- copia nunca puede perder datos, y en fase 1 el bloque 10 mantiene iguales
    -- las dos vías, así que una segunda ejecución sigue pasando.
    if (select count(*) from public.wishlist_items where reserved_by is not null)
       > (select count(*) from public.wishlist_reservations) then
      raise exception 'La copia de reservas no coincide con reserved_by is not null';
    end if;
  end if;
end $$;

-- 5. Visibilidad de la lista de deseos: solo mis deseos y los de un grupo
-- compartido no excluido. Sustituye la lectura abierta a todo autenticado. El
-- `drop policy` previo de la política nueva es lo que la hace reejecutable.
drop policy if exists "Usuarios autenticados pueden ver todos los items" on public.wishlist_items;
drop policy if exists "Veo mis deseos y los de mis grupos" on public.wishlist_items;

create policy "Veo mis deseos y los de mis grupos"
  on public.wishlist_items
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.group_members as mine
      join public.group_members as theirs on mine.group_id = theirs.group_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = wishlist_items.user_id
        and not (theirs.group_id = any (coalesce(wishlist_items.excluded_group_ids, '{}'::text[])))
    )
  );

-- 6. El trigger de permisos ya no permite escribir a terceros: solo bloquea el
-- cambio de propietario y cualquier edición de quien no es dueño. `auth.uid()`
-- nulo (service_role, seed) omite el segundo control porque estos esquivan RLS
-- pero no los triggers. El trigger `tr_check_wishlist_update` sigue igual.
create or replace function public.check_wishlist_update_permissions()
 returns trigger
 language plpgsql
 security invoker
 set search_path to 'public'
as $function$
begin
  -- 1. Nadie puede cambiar el propietario (user_id).
  if old.user_id is distinct from new.user_id then
    raise exception 'No se permite cambiar el propietario del item.';
  end if;

  -- 2. El espejo de compatibilidad (bloque 10) escribe `reserved_by` en nombre
  -- del cliente antiguo: no es una edición de usuario y no pasa este control.
  if current_setting('muro.internal_mirror', true) = 'on' then
    return new;
  end if;

  -- 3. Un tercero autenticado no puede editar nada; el dueño sí.
  -- auth.uid() nulo (service_role, seed) no debe bloquearse.
  if (select auth.uid()) is not null and old.user_id <> (select auth.uid()) then
    -- FASE 1: el cliente antiguo reserva y cancela con un UPDATE que solo toca
    -- `reserved_by`. Se permite eso y nada más: ninguna otra columna cambia y
    -- el valor solo puede ser el propio, o libre si la reserva era suya.
    if (to_jsonb(new) - 'reserved_by') is distinct from (to_jsonb(old) - 'reserved_by') then
      raise exception 'No tienes permiso para editar los detalles de este regalo. Solo puedes reservarlo.';
    end if;

    if new.reserved_by is null then
      if old.reserved_by is distinct from (select auth.uid()) then
        raise exception 'Solo puedes cancelar tu propia reserva.';
      end if;
    elsif new.reserved_by <> (select auth.uid()) then
      raise exception 'No puedes reservar en nombre de otra persona.';
    end if;
  end if;

  return new;
end;
$function$;

-- 7. Estado de reserva para el cliente. SECURITY DEFINER porque lee la tabla de
-- reservas (que RLS restringe), pero nunca devuelve `reserver_id`; el dueño no
-- recibe nada de sus propios deseos para no romper la sorpresa. Vive en `public`
-- para que PostgREST la exponga en /rest/v1/rpc/get_wishlist_reservation_states.
create or replace function public.get_wishlist_reservation_states(owner_uuid uuid)
 returns table(item_id uuid, reserved_by_me boolean)
 language sql
 security definer
 set search_path = public
 stable
as $$
  select
    r.item_id,
    (r.reserver_id = (select auth.uid())) as reserved_by_me
  from public.wishlist_reservations as r
  join public.wishlist_items as i on i.id = r.item_id
  -- Misma regla de visibilidad que la política SELECT de `wishlist_items`.
  -- El dueño queda fuera por la condición siguiente: de sus propios deseos
  -- nunca recibe estado de reserva, ni siquiera el indicador.
  where i.user_id = owner_uuid
    and i.user_id <> (select auth.uid())
    and exists (
      select 1
      from public.group_members as mine
      join public.group_members as theirs on mine.group_id = theirs.group_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = i.user_id
        and not (theirs.group_id = any (coalesce(i.excluded_group_ids, '{}'::text[])))
    );
$$;

revoke all on function public.get_wishlist_reservation_states(uuid) from public, anon;
grant execute on function public.get_wishlist_reservation_states(uuid) to authenticated;

-- 8. Políticas de la tabla de reservas. El INSERT reutiliza la política de
-- `wishlist_items` mediante un EXISTS evaluado con los permisos del invocador,
-- así que la visibilidad vive en un solo lugar y no se puede reservar lo propio.
-- No hay política de UPDATE: una reserva es inmutable.
drop policy if exists "Veo solo mi reserva" on public.wishlist_reservations;

create policy "Veo solo mi reserva"
  on public.wishlist_reservations
  for select
  to authenticated
  using (reserver_id = (select auth.uid()));

drop policy if exists "Reservo deseos visibles que no son míos" on public.wishlist_reservations;

create policy "Reservo deseos visibles que no son míos"
  on public.wishlist_reservations
  for insert
  to authenticated
  with check (
    reserver_id = (select auth.uid())
    and exists (
      select 1
      from public.wishlist_items as i
      where i.id = item_id
        and i.user_id <> (select auth.uid())
    )
  );

drop policy if exists "Cancelo solo mi reserva" on public.wishlist_reservations;

create policy "Cancelo solo mi reserva"
  on public.wishlist_reservations
  for delete
  to authenticated
  using (reserver_id = (select auth.uid()));

-- 9. Aviso al reservador cuando el dueño borra el deseo. Corre como dueño de la
-- tabla y no revela nada al dueño. BEFORE DELETE (no AFTER): la FK `on delete
-- cascade` la aplica un trigger interno `RI_` que ordena antes que `tr_` en
-- PostgreSQL, así que en un AFTER la reserva ya se habría borrado y el aviso
-- nunca se emitiría.
create schema if not exists private;

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
  -- Busca la reserva del deseo que se está borrando.
  select r.reserver_id into v_reserver_id
  from public.wishlist_reservations as r
  where r.item_id = old.id;

  -- Sin reserva, o si el reservador es el propio dueño, no hay nada que avisar.
  if v_reserver_id is null or v_reserver_id = old.user_id then
    return old;
  end if;

  -- Un grupo en común entre dueño y reservador (puede no existir: queda nulo).
  select mine.group_id into v_group_id
  from public.group_members as mine
  join public.group_members as theirs on mine.group_id = theirs.group_id
  where mine.user_id = old.user_id
    and theirs.user_id = v_reserver_id
  order by mine.group_id
  limit 1;

  -- Notificación al reservador; `wish_id` queda nulo como en el cliente, porque
  -- el deseo desaparece y el título se conserva en `metadata`.
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

drop trigger if exists tr_notify_wish_deleted on public.wishlist_items;

create trigger tr_notify_wish_deleted
  before delete on public.wishlist_items
  for each row
  execute function private.notify_wish_deleted();

-- El trigger se ejecuta por OID; los roles de API no deben invocarla como RPC.
revoke all on function private.notify_wish_deleted() from public, anon, authenticated;

-- 10. Puente de compatibilidad (fase 1). El cliente ya cargado sigue leyendo
-- y escribiendo `reserved_by`; estos disparadores mantienen columna y tabla de
-- acuerdo en las dos direcciones, sin recursión y sin robar la primera reserva.
create or replace function private.mirror_reservation_to_item()
 returns trigger
 language plpgsql
 security definer
 set search_path = public
as $$
begin
  perform set_config('muro.internal_mirror', 'on', true);

  if tg_op = 'INSERT' then
    update public.wishlist_items
       set reserved_by = new.reserver_id
     where id = new.item_id
       and reserved_by is distinct from new.reserver_id;
  else
    update public.wishlist_items
       set reserved_by = null
     where id = old.item_id
       and reserved_by is not null;
  end if;

  perform set_config('muro.internal_mirror', 'off', true);
  return null;
end;
$$;

drop trigger if exists tr_mirror_reservation_to_item on public.wishlist_reservations;

create trigger tr_mirror_reservation_to_item
  after insert or delete on public.wishlist_reservations
  for each row
  execute function private.mirror_reservation_to_item();

create or replace function private.mirror_item_to_reservation()
 returns trigger
 language plpgsql
 security definer
 set search_path = public
as $$
begin
  -- La tabla es la fuente de verdad: lo que la columna reciba se traduce a la
  -- tabla, y si ya había reserva la columna se realinea con la verdad.
  if new.reserved_by is null then
    delete from public.wishlist_reservations where item_id = new.id;
  else
    insert into public.wishlist_reservations (item_id, reserver_id, reserved_at)
    values (new.id, new.reserved_by, now())
    on conflict (item_id) do nothing;

    perform set_config('muro.internal_mirror', 'on', true);

    update public.wishlist_items as i
       set reserved_by = r.reserver_id
      from public.wishlist_reservations as r
     where i.id = new.id
       and r.item_id = new.id
       and i.reserved_by is distinct from r.reserver_id;

    perform set_config('muro.internal_mirror', 'off', true);
  end if;

  return null;
end;
$$;

drop trigger if exists tr_mirror_item_to_reservation on public.wishlist_items;

create trigger tr_mirror_item_to_reservation
  after update of reserved_by on public.wishlist_items
  for each row
  when (new.reserved_by is distinct from old.reserved_by)
  execute function private.mirror_item_to_reservation();

-- Reserva por la vía antigua: solo para quien ve el deseo por un grupo
-- compartido y no excluido, y solo para tomar una reserva libre o liberar la
-- propia. Es la política anterior sin el agujero del tercero.
drop policy if exists "Reserva o cancelación en listas ajenas" on public.wishlist_items;

create policy "Reserva o cancelación en listas ajenas"
  on public.wishlist_items
  for update
  to authenticated
  using (
    user_id is distinct from (select auth.uid())
    and (reserved_by is null or reserved_by = (select auth.uid()))
    and exists (
      select 1
      from public.group_members as mine
      join public.group_members as theirs on mine.group_id = theirs.group_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = wishlist_items.user_id
        and not (theirs.group_id = any (coalesce(wishlist_items.excluded_group_ids, '{}'::text[])))
    )
  )
  with check (
    user_id is distinct from (select auth.uid())
    and (reserved_by is null or reserved_by = (select auth.uid()))
  );

-- Los disparadores se ejecutan por OID; los roles de API no deben invocarlos.
revoke all on function private.mirror_reservation_to_item() from public, anon, authenticated;
revoke all on function private.mirror_item_to_reservation() from public, anon, authenticated;
