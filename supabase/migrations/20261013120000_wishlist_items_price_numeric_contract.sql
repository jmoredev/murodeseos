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
ALTER TABLE public.wishlist_items DROP COLUMN price;

-- El paso 1 rellenó `price_numeric` con todo lo que se pudo leer (46 de 49 filas);
-- las 2 vacías quedaron en NULL y no pierden nada, y la única no numérica
-- (`'25/30. €'`) se corrigió a mano a `30` el 2026-10-09.
--
-- La columna de texto ya no la escribe nadie. Un cliente rezagado que todavía
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
