-- Atribución de grupo con preferencias: elige un grupo donde el aviso esté activo.
--
-- Cierra el hueco que dejó la primera versión de las preferencias: el trigger
-- elegía el grupo MENOR de los comunes y delegaba en el `BEFORE INSERT` de
-- `notifications` el descarte si el destinatario lo tenía desactivado. Si esa
-- persona había desactivado el aviso en el grupo menor pero lo tenía activo en
-- otro grupo común, perdía el aviso. Ahora el trigger elige el menor grupo donde
-- el aviso está ACTIVADO; si no hay ninguno, no genera aviso.
--
-- No se toca `wish_added` (vive en el cliente y no puede leer las preferencias de
-- otros): queda como limitación conocida, documentada en la feature.

-- 1. Reserva: añade el filtro de preferencia a la selección del grupo.
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

  select i.user_id, coalesce(i.excluded_group_ids, '{}'::text[])
    into v_owner_id, v_excluded
  from public.wishlist_items as i
  where i.id = new.item_id;

  if v_owner_id is null or v_owner_id = new.reserver_id then
    return null;
  end if;

  -- Un aviso por destinatario, en el menor grupo donde lo tenga activado.
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
    and private.notification_enabled(m.user_id, mine.group_id, 'wish_reserved')
  order by m.user_id, m.group_id;

  return null;
end;
$$;

revoke all on function private.notify_wish_reserved() from public, anon, authenticated;

-- 2. Borrado: elige el menor grupo común donde el reservador tenga el aviso
-- activado. Si comparten grupos pero todos desactivados, no hay aviso; si no
-- comparten ningún grupo, se avisa sin grupo (preferencia por defecto).
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
  join public.group_members as theirs on theirs.group_id = mine.group_id
  where mine.user_id = old.user_id
    and theirs.user_id = v_reserver_id
    and private.notification_enabled(v_reserver_id, mine.group_id, 'wish_deleted_by_owner')
  order by mine.group_id
  limit 1;

  -- Comparten algún grupo pero ninguno lo tiene activado: no se avisa.
  if v_group_id is null and exists (
    select 1
    from public.group_members as mine
    join public.group_members as theirs on theirs.group_id = mine.group_id
    where mine.user_id = old.user_id
      and theirs.user_id = v_reserver_id
  ) then
    return old;
  end if;

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
