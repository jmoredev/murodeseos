-- Paso 2 de `price-numeric`: el contrato. La app publicada en `v2026.10.13` ya
-- lee y escribe `price_numeric`, así que la columna de texto puede desaparecer.
-- No se renombra nada: la columna numérica conserva su nombre (decisión del
-- 2026-10-09, en `odd/tasks/price-numeric.md`).
--
-- NADA DEPENDE YA DE `price`, y esto no se dedujo leyendo ficheros: se midió
-- contra la base local (2026-10-13) soltando la columna dentro de una
-- transacción revertida y provocando las dos rutas de UPDATE que existen:
--   · actor = dueño de la fila              → UPDATE 1
--   · actor sin `sub` (`auth.uid()` nulo: service_role, seed, SQL directo) → UPDATE 1
--
-- POR QUÉ NO SE TOCA EL GUARDIÁN DE PERMISOS (y por qué eso es lo correcto):
-- su definición **viva** es la del paso 6 de
-- `20260928120000_drop_reserved_by_window.sql`, y ya no compara `price`: solo
-- mira el propietario y si el actor es un tercero autenticado. Las versiones
-- **anteriores** de ese fichero (`20260102122206:254`, `20260107142656:31`) sí
-- lo comparaban, y de ahí salió un falso positivo: leer una migración antigua no
-- dice cuál es el cuerpo vivo, porque PL/pgSQL resuelve los nombres en tiempo de
-- ejecución y una función sustituida más tarde deja de nombrar la columna sin
-- que nada lo anuncie.
-- La razón de que no haga falta es esa, **no** que «PL/pgSQL resuelve al vuelo»:
-- ese argumento vale para un RENAME (el nombre sobrevive) y es falso para un DROP
-- (el nombre desaparece). Lo que nos salva es que el cuerpo vivo no la nombra.
--
-- Y no es una precaución teórica: un `CREATE OR REPLACE` «preventivo» del guardián
-- reintroduciría la comparación por campos y la excepción para el actor sin `sub`,
-- es decir volvería a **bloquear al seed y al service_role**, que es justo lo que
-- el paso 6 de `20260928120000` fue a permitir. Se comprobó en el rojo.
--
-- RED DE SEGURIDAD: no se suelta la columna mientras pueda ser la ÚNICA copia de
-- un precio. La ventana entre el paso 1 y la app nueva la escribió el bundle
-- viejo, que usaba SOLO esta columna: hay deseos con su precio aquí y
-- `price_numeric` en NULL, y otros con el precio nuevo aquí y el viejo allí. El
-- `CHECK` de no negativo no los ve, porque NULL lo satisface. No se reconcilia en
-- automático a propósito: `updated_at` no se mantiene en esta tabla, así que un
-- precio de la ventana y uno que el usuario acaba de borrar con la app nueva son
-- indistinguibles ("odd/tasks/price-numeric.md"). Decide el propietario.
do $$
declare
  n integer;
begin
  select count(*) into n
    from public.wishlist_items
   where price is not null
     and btrim(price) <> ''
     and (
       price_numeric is null
       or price_numeric is distinct from
          case when btrim(price) ~ '^[0-9]+([.,][0-9]+)?$'
                and replace(btrim(price), ',', '.')::numeric <= 9999999999.99
               then replace(btrim(price), ',', '.')::numeric(12,2)
          end
     );
  if n > 0 then
    raise exception 'Paso 2 abortado: % fila(s) guardan en `price` un precio que `price_numeric` no refleja.', n;
  end if;
end $$;

ALTER TABLE public.wishlist_items DROP COLUMN price;

-- El paso 1 rellenó `price_numeric` con lo que se pudo leer el 2026-10-07, y la
-- medición de las 49 filas es del 2026-10-09 (la única no numérica, `'25/30. €'`,
-- se corrigió a `30` ese día). Eso NO cubre la ventana: lo que el bundle viejo
-- escribió entre esa fecha y la publicación del 2026-10-13.
--
-- La app publicada ya no la escribe. Un cliente rezagado que todavía
-- intentara escribirla recibe `42703`, que es exactamente lo que la recuperación
-- de desajuste de esquema del repositorio ya sabe interpretar
-- (`lib/wish-reservation.ts`: `WishSchemaMismatchError` → «Recarga la página»).
--
-- El `CHECK` es puramente aditivo: el paso 1 solo aceptaba magnitudes sin signo
-- (`^[0-9]+([.,][0-9]+)?$`), así que no puede existir un valor negativo y la
-- validación de las filas existentes no puede fallar.
ALTER TABLE public.wishlist_items
    ADD CONSTRAINT wishlist_items_price_nonnegative
    CHECK (price_numeric IS NULL OR price_numeric >= 0);
