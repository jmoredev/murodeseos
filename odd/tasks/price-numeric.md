# Precio como número (`feat/price-numeric`)

**Abierta:** 2026-10-07 · **Rama:** `feat/price-numeric` (desde `main`, `c25f542`) · **Estado:** abierta — **paso 1 aplicado en producción y aprobado por revisión nativa** (tras corregir un hallazgo CRITICAL del refutador); pendientes el paso 2 y los cambios de app

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

**Y un segundo defecto, CRITICAL, que encontró el refutador de la revisión nativa** (yo no lo vi porque probé el **formato** exhaustivamente y **nunca la magnitud**): el predicado acepta números de magnitud arbitraria, pero `price_numeric` es `numeric(12,2)` — 10 dígitos enteros como máximo. Un valor como `9999999999.995` casa el patrón, pasa el `::numeric` (sin límite) y **falla al asignar**. Reproducido contra la base local:

```
ERROR:  numeric field overflow
DETAIL:  A field with precision 12, scale 2 must round to an absolute value less than 10^10.
```

Es `22003`, y con la migración en una sola transacción el `UPDATE` no rellena nada y **el paso 1 aborta entero** — justo lo contrario del contrato de este paso, que es degradar a `NULL` y dejar la fila para revisión. Corregido acotando la magnitud **antes** de convertir (por encima de `9999999999.99` → `NULL`), verificado con la misma expresión de la migración:

| Original | Resultado |
| --- | --- |
| `9999999999.995` · `999999999999` · `10000000000` | `NULL` (conserva el texto) |
| `9999999999.99` (el máximo exacto) · `349.00` · `10,55` | pasan |

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

## Procedimiento de enlace y despliegue (ejecutado)

El CLI quedó autenticado y el proyecto enlazado. Los pasos, con la sintaxis verificada de la CLI 2.117.0:

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

## Revisión nativa (2026-10-07)

Linaje **`review-8e157803f74135b7`**: riesgo medio, 1 lente (`review-reliability`), 2 ficheros / 150 líneas, presupuesto de corrección 75 → **aprobada** y autoridad **quemada**.

**El refutador encontró un CRITICAL real** (`R3-numeric-overflow`, con `causal_disposition: introduced`) que la lente había dejado pasar, y la corrección se validó con una **validación dirigida** que la aprobó. Secuencia completa del proveedor: lente → resultado → **refutador** → `correction_required` → plan de corrección (14 líneas de diff) → **validador dirigido** → `approved` → `acknowledge-approved`.

**Lección**: probar el **formato** de una conversión no prueba su **rango**. La revisión automática no basta para encontrar esto (la lente no lo vio); el refutador adversarial sí. Y el defecto era real: mi propia premisa («que el texto libre diga lo que sea») era la que hacía probable el valor extremo.

**Nota sobre producción**: producción ya aplicó la versión **pre-arreglo** y su resultado es **idéntico**, porque ninguna fila real supera el límite (verificado: 49 filas, ninguna con más de dos dígitos enteros, 0 candidatas a redondeo). Lo que estaba mal era la **robustez del artefacto** para cualquier otro conjunto de datos. El SQL del repositorio **no es byte a byte el que corrió en producción**, y es el intercambio correcto: los entornos futuros reciben la versión que no puede abortar.

## Commits

- **`848f51a`** — `feat(db): add a numeric price column and backfill what can be read` (paso 1: la migración y esta ficha).
- **`1b0324a`** — `fix(db): bound the backfill magnitude so it degrades instead of aborting` (corrección del CRITICAL `R3-numeric-overflow`).

## Aplicado en producción (2026-10-07)

Con autorización explícita del propietario. `db push` aplicó **dos** migraciones, no una: la nuestra y **`20260930160000_birthday_name_day_reminders`**, que estaba fusionada (PR #34) pero **cuyo esquema nunca llegó a producción**. Verificado contra el esquema real: producción tenía **10** tablas y local 11 — faltaba `group_reminder_settings`; tampoco existían `profiles.birth_date`/`name_day` ni `generate_birthday_reminders`.

**No había rotura viva**: el bundle desplegado no contiene ninguna de esas referencias (el frontend en producción es anterior a esa feature). **Pero era una trampa armada**: `app/profile/setup/index.tsx:56-57` manda `birth_date`/`name_day` en el guardado del perfil y `components/ProfileTab.tsx:36` los pide en el `select`, así que el siguiente despliegue habría roto la pestaña de perfil. El push la desarmó.

**Pre-flight hechas antes de empujar**: (1) ¿reaplicación? No, la tabla no existía. (2) Los dos `CHECK` que la migración de cumpleaños recrea: comparados contra el volcado real, el conjunto nuevo **contiene** al viejo, así que el `ALTER` no podía fallar por filas existentes.

**Verificación posterior**: las **26 migraciones con remoto confirmado, ninguna pendiente**; el esquema de producción pasa a **11 tablas** con `group_reminder_settings`, `birth_date`, `name_day` y `price_numeric` presentes. Copias de seguridad en `~/db-backups/` (esquema + datos, fuera del repositorio).

### Datos de la revisión para el paso 2

De **49 filas** de `wishlist_items`: **46 parseadas**, **2 vacías** ('' → `NULL`, se muestran «Sin precio» y no se pierde nada) y **una sola no numérica**: **`'25/30. €'`** (un rango escrito a mano). **Cero candidatas a redondeo**: ningún precio tiene tres decimales. Ese valor produce además un defecto vivo cosmético: la tarjeta pinta `${item.price} €`, así que se ve **«25/30. € €»**, con el euro duplicado.

## Procedimiento de enlace y despliegue (ejecutado)
