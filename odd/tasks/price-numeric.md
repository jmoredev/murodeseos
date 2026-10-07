# Precio como número (`feat/price-numeric`)

**Abierta:** 2026-10-07 · **Rama:** `feat/price-numeric` (desde `main`, `c25f542`) · **Estado:** abierta — **paso 1 (migración aditiva) preparado y verificado en local**; pendientes el paso 2 y los cambios de app

## Objetivo

Que `wishlist_items.price` sea `numeric` en lugar de `text`, para dejar de parsear el precio en cada punto de uso y eliminar la ambigüedad de formato en el dato.

## Por qué (medido, no teórico)

`price` es `text` (`supabase/migrations/20260102122206_estructura_inicial.sql:126`) y guarda lo que el usuario escribe. Eso ya produce dos defectos reales:

1. **`parseFloat('349,00')` devuelve `349`** — se detiene en la coma y **suelta los decimales en silencio**. Como el orden «POR PRECIO» se calculaba con `parseFloat` sobre el texto (`components/WishListTab.tsx:115-118`), escribir con coma —lo natural en español, y lo que el placeholder `0,00` ahora invita a hacer— ordenaba mal.
2. **Un valor no numérico produce `NaN`**, y un comparador que devuelve `NaN` deja el orden indefinido. Nada impide ese valor: la columna es texto libre.

> El defecto 1 se cerró **provisionalmente** en `ui-polish` (U4) con `parsePriceForSort` en `lib/format-price.ts`, que normaliza el separador y devuelve `null` para lo ilegible. Eso arregla el síntoma sin tocar el esquema. Esta feature arregla la causa.

**Alcance medido**: 13 literales de precio como texto en seeds y specs (`e2e/config.ts`, `e2e/wishlist.spec.ts`, `scripts/seed-complete-database.ts`), más los componentes que leen `price`.

## Decisión de despliegue en dos pasos

El paso 1 es **puramente aditivo** (añade una columna y rellena lo que puede): no borra nada, así que puede aplicarse a producción sin esperar a los cambios de app y **da ya los datos de la revisión**. El paso 2 (borrar la columna vieja) es destructivo y **no debe aplicarse hasta revisar qué filas no parsearon**.

El CLI aplica *todas* las migraciones pendientes de golpe, así que esto obliga a **dos `db push` separados**, con las consultas de revisión en medio. De ahí que en esta rama solo viva la migración del paso 1.

## Seguridad del `UPDATE` masivo del paso 1 (verificada antes de escribirlo)

Tres triggers sobre `public.wishlist_items`:

| Trigger | Cuándo dispara | Efecto |
| --- | --- | --- |
| `tr_check_wishlist_update` | `BEFORE UPDATE FOR EACH ROW` (`20260102122206:758`) | **Dispara y pasa**: solo cambiamos `price_numeric`, y las columnas que vigila son `title`, `links`, `image_url`, `price`, `notes`, `priority` |
| `tr_mirror_item_to_reservation` | `AFTER UPDATE **OF reserved_by**` (`20260925120000:340`) | **No dispara**: no tocamos `reserved_by` |
| `tr_notify_wish_deleted` | `BEFORE DELETE` | No aplica a un `UPDATE` |

## Paso 1 — aplicado y verificado en local

`supabase/migrations/20261007120000_wishlist_items_price_numeric_add.sql`. Aplicado contra el Supabase local **con datos sembrados**: las 14 filas se rellenaron y ningún trigger protestó.

**Comportamiento probado con el SQL real** (expresión pura, sin insertar filas, para no contaminar la base que alimenta al E2E):

| Original | Resultado |
| --- | --- |
| `100.00` · `10,55` · `  7.5  ` | 100.00 · 10.55 · 7.50 |
| `12.345` · `0.005` | 12.35 · 0.01 — **redondeo a 2 decimales** |
| `,50` · `aprox 30` · `1.234,56` · `gratis` · vacío | **NO PARSEA** → `NULL`, conservando el texto |

**Defecto encontrado en la propia migración al probarla**: el predicado aplicaba la expresión regular **sin** `btrim` mientras el `cast` sí recortaba, así que `'  7.5  '` quedaba en `NULL` siendo legible. Corregido: predicado y cast miden lo mismo.

## Revisión entre los dos pasos (consultas)

```sql
-- a) Qué NO parseó: conserva su texto original y queda NULL aquí.
select id, price from public.wishlist_items
 where price_numeric is null and price is not null;

-- b) Qué se redondearía al forzar 2 decimales.
select id, price from public.wishlist_items
 where btrim(price) ~ '^[0-9]+[.,][0-9]{3,}$';
```

**Decisión pendiente del propietario**: qué hacer con las filas de (a). Se quedan en `NULL` (el deseo se muestra como «Sin precio») y su texto sigue en la columna vieja hasta el paso 2. **Como el paso 2 borra esa columna, esas filas perderían el texto**: hay que limpiarlas a mano antes, o no aplicar el paso 2.

## Paso 2 — NO escrito todavía (espera a la revisión)

```sql
alter table public.wishlist_items drop column price;
alter table public.wishlist_items rename column price_numeric to price;
alter table public.wishlist_items
    add constraint wishlist_items_price_nonnegative
    check (price is null or price >= 0);
```

El renombrado es seguro aunque dos funciones de trigger referencien `price` (el guardián de permisos y el espejo de reservas): PL/pgSQL resuelve los nombres en tiempo de ejecución y el nombre final sigue siendo `price`.

## Cambios de app — pendientes, y van DESPUÉS de `ui-polish`

Tocan `WishlistCard`, `WishDetailModal` y `WishListTab`, que son justo los ficheros de U4 en la rama `ui-polish`, y **simplifican** el formateador que U4 acaba de escribir (con un número, `formatPrice` deja de tener que defender nunca contra texto basura). Hacerlo antes obligaría a escribir lo mismo dos veces.

## Procedimiento de enlace y despliegue (para el propietario)

El CLI no está autenticado y el proyecto no está enlazado en esta máquina. Los pasos, con la sintaxis verificada de la CLI 2.117.0:

```bash
# 1. Autenticar (una vez por máquina)
pnpm exec supabase login

# 2. Enlazar (una vez por clon). Pide la contraseña de la base de datos.
#    No aplica migraciones. Escribe supabase/.temp/project-ref, que está ignorado.
pnpm exec supabase link --project-ref bztfzifafquulelcxycqk

# 3. Copia de seguridad, FUERA del repositorio (contiene datos reales)
pnpm exec supabase db dump --linked -f ~/prod-backup-2026-10-07.sql

# 4. Comparar historial local y remoto ANTES de empujar nada
pnpm exec supabase migration list --linked

# 5. Previsualizar: debe listar SOLO la migración nueva
pnpm exec supabase db push --dry-run

# 6. Aplicar
pnpm exec supabase db push

# 7. Verificar
pnpm exec supabase migration list --linked
```

- **No hace falta `--skip-vault`**: `[db.vault]` está comentado en `config.toml` (líneas 48-49).
- **No usar `--include-all`** salvo que el paso 4 demuestre un desajuste real de historial: reaplica migraciones que no están en la tabla de historial remota.
- El `push` aplica lo que haya en `supabase/migrations/` **de la rama marcada**, así que hay que estar en la rama correcta.

## Commits

- _(paso 1, pendiente de commit)_ — `supabase/migrations/20261007120000_wishlist_items_price_numeric_add.sql` y esta ficha.
