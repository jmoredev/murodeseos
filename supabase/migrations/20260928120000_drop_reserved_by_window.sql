-- Reservas privadas: FASE 2 DE 2 — cierra la ventana de compatibilidad.
--
-- La fase 1 (`20260925120000`) movió la reserva a `public.wishlist_reservations`, pero
-- conservó `wishlist_items.reserved_by` (columna, índice, clave foránea, un puente de
-- disparadores y una política estrecha) para que el bundle ya cargado en producción siguiera
-- reservando y cancelando. Esta migración retira todo eso: con la columna fuera, la identidad
-- de quien reserva ya no está en `wishlist_items`, y es aquí donde se completa el arreglo de
-- privacidad.
--
-- Consecuencia aceptada: un cliente que siga ejecutando el bundle anterior falla al reservar o
-- cancelar con `42703` hasta que recargue. La recarga sí trae el código nuevo, porque el
-- service worker sirve JS/CSS con red primero.
--
-- El bloque de copia de la fase 1 está guardado por la existencia de la columna, así que a
-- partir de aquí es un no-op. Todo es idempotente: una segunda ejecución no hace nada.
--
-- El ORDEN importa: la política y las funciones del puente referencian la columna, así que
-- tienen que caer antes del `drop column`. La fase 1 pagó ese error como defecto V2
-- ("cannot drop column because other objects depend on it").

-- 1. Política de compatibilidad de la vía antigua: referencia `reserved_by`.
drop policy if exists "Reserva o cancelación en listas ajenas" on public.wishlist_items;

-- 2. Disparadores del puente.
drop trigger if exists tr_mirror_item_to_reservation on public.wishlist_items;
drop trigger if exists tr_mirror_reservation_to_item on public.wishlist_reservations;

-- 3. Funciones del puente.
drop function if exists private.mirror_item_to_reservation();
drop function if exists private.mirror_reservation_to_item();

-- 4. Índice de la columna.
drop index if exists public.idx_wishlist_items_reserved_by;

-- 5. La columna, con su clave foránea.
alter table public.wishlist_items drop column if exists reserved_by;

-- 6. El trigger de permisos vuelve a su forma estricta: desaparecen la excepción del espejo
-- interno (ajuste de sesión `muro.internal_mirror`) y la tolerancia al cambio de `reserved_by`,
-- que ya no existe. Queda solo lo de siempre: nadie cambia el propietario y un tercero
-- autenticado no edita nada.
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

  -- 2. Un tercero autenticado no puede editar nada; el dueño sí.
  -- auth.uid() nulo (service_role, seed) no debe bloquearse.
  if (select auth.uid()) is not null and old.user_id <> (select auth.uid()) then
    raise exception 'No tienes permiso para editar los detalles de este regalo. Solo puedes reservarlo.';
  end if;

  return new;
end;
$function$;
