-- Aviso al reservar un deseo: repone el `wish_reserved` que nunca se envió.
--
-- Contexto: al mover la reserva a `public.wishlist_reservations` (fase 1,
-- `20260925120000`) se añadió un trigger para avisar al reservador cuando el dueño
-- borra el deseo, pero no para avisar a los demás miembros del grupo cuando el
-- deseo se reserva. La función de cliente `notifyWishReserved` existía, pero se
-- quedó sin llamador al migrar a Expo PWA (`7475793`), así que el aviso no se
-- generaba nunca. Este trigger lo devuelve a la base, donde la reserva es la
-- fuente de verdad y el aviso es atómico con la inserción.
--
-- Semántica (la misma que la política de visibilidad): avisa a los miembros de
-- los grupos comunes entre quien reserva y el dueño, excluyendo a quien reserva
-- (ya lo sabe) y al dueño (para no romper la sorpresa). Un grupo excluido del
-- deseo (`wishlist_items.excluded_group_ids`) no recibe el aviso, igual que no ve
-- el deseo.
--
-- Idempotente: `create or replace` de la función y `drop trigger if exists` antes
-- de crearlo. El trigger corre como dueño de la tabla (`security definer`), así
-- que la RLS de `notifications` no participa y el reservador no puede fabricar la
-- fila por otra vía (los roles de API no pueden invocar la función).

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
  -- Dueño del deseo reservado y los grupos de los que el deseo está excluido.
  select i.user_id, coalesce(i.excluded_group_ids, '{}'::text[])
    into v_owner_id, v_excluded
  from public.wishlist_items as i
  where i.id = new.item_id;

  -- Sin deseo (no debería pasar: la FK es `on delete cascade` y el INSERT exige
  -- que el item exista) o reserva del propio dueño: no hay nada que avisar.
  if v_owner_id is null or v_owner_id = new.reserver_id then
    return null;
  end if;

  -- Un aviso por destinatario. `distinct on` con `order by user_id, group_id`
  -- elige un grupo determinista cuando la persona comparte varios con el dueño,
  -- y evita la fila duplicada que en el cliente resolvía un `Map`.
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

drop trigger if exists tr_notify_wish_reserved on public.wishlist_reservations;

create trigger tr_notify_wish_reserved
  after insert on public.wishlist_reservations
  for each row
  execute function private.notify_wish_reserved();

-- El trigger se ejecuta por OID; los roles de API no deben invocarla como RPC.
revoke all on function private.notify_wish_reserved() from public, anon, authenticated;
