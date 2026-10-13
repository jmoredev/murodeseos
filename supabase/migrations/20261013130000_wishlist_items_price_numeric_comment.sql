-- El comentario de esta columna lo escribió el paso 1 (`20261007120000`), cuando el
-- plan todavía era **renombrar** `price_numeric` a `price`. La decisión del
-- 2026-10-09 abandonó el renombrado y el paso 2 (`20261013120000`) soltó la columna
-- de texto, así que el comentario quedó describiendo un estado que ya no existe:
-- decía que `price` (text) «convive durante la transición» y que «se renombra a
-- `price` en el paso 2».
--
-- No se reescribe la migración del paso 1: ya está aplicada, y cambiar su texto
-- rompería el historial. Un comentario se corrige **sobreescribiéndolo**.
comment on column public.wishlist_items.price_numeric is
  'Precio como numero (numeric(12,2)). Es la columna viva: el texto `price` se retiro en el paso 2 (20261013120000) y no se renombra nada. Ver odd/tasks/price-numeric.md.';
