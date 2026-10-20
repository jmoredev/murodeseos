-- T7 · S6: la moneda del precio.
--
-- `price_numeric` es un número sin moneda, así que un `12,99` de Amazon.es y un `12,99` de una
-- tienda en dólares son indistinguibles en la base. La extracción ya devuelve la moneda y hoy se
-- descarta antes de guardar.
--
-- La columna es **nullable a propósito**: `null` significa «no se sabe» —filas viejas y páginas
-- que no declaran moneda— y se pinta como número pelado. No se rellena con 'EUR': inventar una
-- moneda para datos que no la tenían es peor que no tenerla, y ese valor inventado nadie lo podría
-- distinguir después de uno declarado de verdad.
--
-- El `CHECK` acepta sólo un ISO 4217 de tres letras mayúsculas, la misma forma que valida
-- `toCurrencyCode` en `lib/format-price.ts`: lo que la app lee nunca puede ser algo que la base no
-- haya aceptado.

alter table public.wishlist_items
    add column if not exists currency text;

alter table public.wishlist_items
    drop constraint if exists wishlist_items_currency_iso4217;

alter table public.wishlist_items
    add constraint wishlist_items_currency_iso4217
    check (currency is null or currency ~ '^[A-Z]{3}$');

comment on column public.wishlist_items.currency is
    'Moneda ISO 4217 del precio. NULL = no se conoce (filas viejas o extracción sin moneda); se pinta sólo el número.';
