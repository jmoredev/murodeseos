-- Paso 1 de 2: añade la columna numérica y rellena solo lo que se puede leer.
--
-- `price` es `text` en la base y la app guarda lo que el usuario escribe, así que
-- hay valores que no son un número. Esta migración es ADITIVA: no toca la columna
-- de texto y no borra nada. Lo que no se pueda interpretar queda en NULL aquí y
-- conserva su texto original en `price`, para revisarlo antes del paso 2.
--
-- Ver odd/tasks/price-numeric.md.
--
-- El patrón es deliberadamente estricto: exige dígitos antes del separador, así
-- que `,50`, `aprox 30` o `1.234,56` NO parsean y quedan en NULL. Prefiero una
-- fila a revisar que un dato inventado.
--
-- Seguridad de este UPDATE masivo, verificada contra los tres triggers de la
-- tabla antes de escribirlo:
--   · tr_check_wishlist_update (BEFORE UPDATE FOR EACH ROW): dispara y pasa —
--     solo cambiamos `price_numeric`, que no está entre las columnas que vigila
--     (title, links, image_url, price, notes, priority).
--   · tr_mirror_item_to_reservation (AFTER UPDATE OF reserved_by): NO dispara.
--   · tr_notify_wish_deleted (BEFORE DELETE): no aplica a un UPDATE.

alter table public.wishlist_items
    add column if not exists price_numeric numeric(12, 2);

comment on column public.wishlist_items.price_numeric is
    'Precio como número. Convive con `price` (text) durante la transición: se '
    'renombra a `price` en el paso 2, después de revisar qué filas no parsearon. '
    'Ver odd/tasks/price-numeric.md.';

update public.wishlist_items
   set price_numeric = replace(btrim(price), ',', '.')::numeric
 where price_numeric is null
   -- `btrim` TAMBIÉN en el predicado: sin él, un valor con espacios alrededor
   -- («  7.5  ») no casaba el patrón anclado y quedaba en NULL aunque el cast
   -- lo habría leído sin problema. Predicado y cast tienen que medir lo mismo.
   and btrim(price) ~ '^[0-9]+([.,][0-9]+)?$';
