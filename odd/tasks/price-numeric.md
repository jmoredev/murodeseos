# Precio como número (`feat/price-numeric`)

**Abierta:** 2026-10-07 · **Rama de esta tanda:** `feat/price-numeric-app` (desde `main`, `a15e924`) · **Estado:** en curso — paso 1 aplicado en producción y aprobado; **cambios de app en esta tanda**, y el paso 2 escrito pendiente de aplicar y de una ventana de compatibilidad

## Decisión de esta tanda (2026-10-09): **no se renombra la columna**

El plan original del paso 2 renombraba `price_numeric` → `price`. **Se descarta, y el motivo es de secuencia, no de gusto**: escribir un número en una columna que todavía es **texto** falla, y escribir texto en la que **ya es numérica** también, así que el renombrado obliga a que la app **tolere los dos nombres** (o a una **segunda publicación**), y `price_numeric` es además una columna que **no puede recibir el texto** del cliente rezagado.

**Decisión del propietario**: la app lee y escribe **`price_numeric`**, y el paso 2 **solo borra la columna de texto**. Una publicación, sin tolerancia de nombres, y el hueco de clientes rezagados lo cubre la **recuperación de desajuste de esquema que ya existe** (`lib/wish-reservation.ts`: `WishSchemaMismatchError`, códigos `42703`, `42P01`, `42883`, `PGRST202`, `PGRST204` → mensaje «Recarga la página»). La columna se queda con el nombre `price_numeric`.

## Unidades de esta tanda

| # | Tarea | Estado |
| --- | --- | --- |
| A1 | `lib/format-price.ts` para **números**: `formatPrice` (dos decimales, dinero), `parsePriceInput` (lo que se teclea, con el máximo de la columna), `toPriceNumber` (lo que llega de PostgREST, que puede ser cadena) y `filterPriceInputText` (el filtro del campo); comparador numérico con orden total | **hecho** (`1f0b74c`, +12 tests → 273 pasan) |
| A2 | El **formulario** admite sólo entrada numérica (teclado decimal, filtro por pulsación) y guarda en `price_numeric` | **hecho** (`1f0b74c`) |
| A3 | **Lectura y escritura** sobre `price_numeric` en las dos consultas, y `GiftItem.price` a número | **hecho** (`1f0b74c`) |
| A4 | **Seed y specs**: los literales de precio pasan a número | **hecho** (`1f0b74c`, `5a76f21`) |
| A5 | **Paso 2 escrito** (sólo `drop column price` + el `CHECK` de no negativo), **sin aplicar** hasta que la app lleve publicada una ventana | **escrito**, sin aplicar |
| A6 | **Arreglo del dato en producción**: la única fila no numérica (`'25/30. €'`) pasa a **30** — autorizado por el propietario, y apaga además el defecto vivo del «25/30. € €» | hecho |
| A7 | Verificación y publicación | verificado en local (`55 passed / 1 skipped`); falta revisión y publicación |

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

**Decisión del propietario (2026-10-09)**: la fila de (a) que no parsea —**una sola**, con el texto `'25/30. €'`— pasa a **30**. Se hace a mano antes del paso 2, así que ninguna fila pierde texto cuando se borre la columna. Las dos filas **vacías** se quedan como están: un deseo sin precio es legítimo y se pinta «Sin precio».

Medido en producción el 2026-10-09 (consulta de sólo lectura): **49 filas**, 46 con número, 2 vacías y **una** con texto no numérico. Cero candidatas a redondeo.

## Paso 2 — escrito, NO aplicado (espera a la ventana de compatibilidad)

```sql
-- El paso 2 con la decisión de «sin renombrar»: la columna numérica conserva su
-- nombre y lo único destructivo es borrar la de texto, que ya no escribe nadie.
-- Antes de aplicarlo, la fila `'25/30. €'` tiene que valer 30 (hecho y anotado arriba).
alter table public.wishlist_items drop column price;

alter table public.wishlist_items
    add constraint wishlist_items_price_nonnegative
    check (price_numeric is null or price_numeric >= 0);
```

**Por qué no se renombra** (y por qué eso cambia el SQL): el renombrado haría que el nombre final fuese `price`, y con él llegarían dos roturas distintas según el cliente. Un cliente **viejo** que siga mandando texto a `price` fallaría, y un cliente **nuevo** que mande un número a `price_numeric` fallaría mientras la columna todavía se llame así. Sin renombrar, en cambio, la app vieja escribe en la columna de **texto** (que sigue existiendo hasta el paso 2) y la nueva escribe en la numérica: las dos conviven sin tolerancia de nombres.

**Ventana de compatibilidad antes de aplicarlo**: el paso 2 borra `price`, así que un cliente rezagado que todavía la escriba recibirá un error de columna inexistente. Ese caso ya está cubierto por la **recuperación de desajuste de esquema** que existe en el repositorio (`lib/wish-reservation.ts`: `WishSchemaMismatchError` con los códigos `42703`, `42P01`, `42883`, `PGRST202`, `PGRST204`, mensaje «Recarga la página»), así que no hace falta código nuevo: hace falta que la app nueva esté publicada y que los clientes hayan tenido ocasión de recargarla.

**Nota sobre los dos triggers que nombran `price`** (el guardián de permisos y el espejo de reservas): este SQL **ya no los toca**, porque no hay renombrado. Si en el futuro se decidiera renombrar, seguiría siendo seguro —PL/pgSQL resuelve los nombres en tiempo de ejecución— pero no es el caso.

## Cambios de app — hechos (2026-10-09)

Se hicieron **después** de `ui-polish`, como estaba previsto y por el motivo previsto: tocan `WishlistCard`, `WishDetailModal` y `WishListTab`, que son ficheros de U4, y **simplifican** el formateador que U4 escribió.

Cuatro cosas que solo se ven al hacerlo, y que quedan anotadas:

1. **El precio vive en dos sitios a propósito**: como número en los datos y como **texto que se está tecleando** en un estado propio. Sin esa separación no se puede escribir «12,» camino de «12,50», porque el número no guarda la coma a medias.
2. **Con un número, `0` es falso.** La comprobación de veracidad que había en el detalle (`item.price ? … : 'Sin precio'`) habría escondido un precio real de 0 € detrás de «Sin precio». Ahora se pregunta por el texto formateado, que sí es verdadero para `0,00`.
3. **El aviso del campo es casi inalcanzable tecleando**, y eso está bien: el filtro ya impide letras y segundos separadores, así que el único texto no legible que puede quedar es un número **fuera del rango de la columna** (`> 9999999999.99`). Es defensa en profundidad, no el camino principal.
4. **PostgREST puede devolver un `numeric` como cadena**, así que la lectura pasa por `toPriceNumber` en vez de dar por hecho que llega un número.

## Arreglo del dato en producción (2026-10-09)

Con autorización del propietario. **Una sola fila** cuadraba con el patrón de texto no numérico, y se identificó antes de tocarla:

| Antes | Después |
| --- | --- |
| `32c6cf9a-2d10-4b41-b0d2-b40c8678598a` · «Bolso/ maletín trabajo» · `price = '25/30. €'`, `price_numeric = null` | `price = '30'`, `price_numeric = 30.00` |

Se escribieron **las dos** columnas a propósito: la de texto la sigue leyendo la app publicada ahora mismo, así que el arreglo apaga ya el defecto visible «25/30. € €» sin esperar a la publicación. El `UPDATE` llevaba el valor viejo en el `WHERE` y `RETURNING`, de modo que si otra sesión hubiera cambiado la fila, la sentencia no habría cambiado nada en vez de pisar un valor ajeno.

**Y un dato medido de paso, que respalda una decisión del código**: esa lectura devolvió `price_numeric` como la **cadena** `"30.00"`, no como número. No prueba lo que hace PostgREST —la consulta va por el CLI, no por la API—, pero confirma que la representación **no es la misma en todos los caminos**, que es exactamente el motivo de que la ruta de lectura pase por `toPriceNumber`. El ida y vuelta completo por la API queda probado por el E2E, que escribe un número desde el formulario y lo ve pintado.

## Verificación local (2026-10-09)

- `typecheck` y `lint --max-warnings 0`: limpios.
- `vitest`: **33 ficheros, 273 tests + 1 todo** (base: 32 / 261 + 1).
- E2E con **resiembra y `--workers=1`**, proyecto `chromium` (el canónico del repo): **55 pasan, 1 saltado**. Las 54 de siempre más la nueva del campo de precio.
- **Cuidado con la trampa de la medición**: la primera corrida la lancé sin `--project`, así que Playwright intentó los seis proyectos. Salieron **162 fallos** que eran ambientales, no regresiones: `browserType.launch: Executable doesn't exist at …\firefox.exe`, porque solo está instalado chromium (`ms-playwright` tiene `chromium-1243` y nada más). Chromium y Mobile Chrome pasaron 54/54 cada uno dentro de esa misma corrida. Es la misma clase de trampa que la propagación de CDN: **medir el instrumento antes que el objeto**.

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

## Revisión nativa del corte de app (2026-10-09)

Linaje **`review-457cd4b91a748e26`**: riesgo medio, 1 lente (`review-reliability`), 15 ficheros / 645 líneas, presupuesto de corrección 200. **Aprobada en un solo evento de revisor**, autoridad **quemada** (`review-acknowledged/v1`) y entrega devuelta a la política ordinaria del repositorio. El corte se revisó como rango comprometido `main..HEAD` (15 ficheros), no como rama acumulada.

**Cuatro hallazgos, todos `informational` y ninguno bloqueante** —el proveedor los declara no reabribles y no ofrece transición de corrección—, y dos merecen trabajo posterior:

| Hallazgo | Ubicación | Lo que dice, en corto |
| --- | --- | --- |
| `R3-paste-thousands` (WARNING) | `lib/format-price.ts:67-73` | Pegar «1.234» se lee como **1,234** y no como 1234. Es la ambigüedad histórica de este campo (punto de miles contra separador decimal) y el filtro no la resuelve: deja pasar el primer separador y descarta el resto. No se arregla en esta tanda porque exigiría decidir formato con el usuario. |
| `R3-read-divergence` (WARNING) | `components/WishListTab.tsx:109` | Las dos rutas de lectura podrían divergir. |
| `R3-update-path-untested` (SUGGESTION) | `components/WishListTab.tsx:247` | La ruta de **editar** un deseo existente no tiene prueba propia, y con el precio en dos estados (número y texto) es justo donde más fácil sería equivocarse. |
| `R3-modal-zero-untested` (SUGGESTION) | `components/WishDetailModal.tsx:123-125` | El cero se probó en la tarjeta, no en el modal. |

**Nota de honestidad sobre la cobertura**: el E2E prueba crear, y las dos sugerencias dicen que **editar** y el **modal** solo están cubiertos por los tests unitarios de la tarjeta. Es deuda de prueba acotada y anotada, no un defecto vivo.

## Commits

- **`848f51a`** — `feat(db): add a numeric price column and backfill what can be read` (paso 1: la migración y esta ficha).
- **`1b0324a`** — `fix(db): bound the backfill magnitude so it degrades instead of aborting` (corrección del CRITICAL `R3-numeric-overflow`).
- **`cd535d7`** — `docs(odd): record the notification findings and decide the price column name` (la decisión de no renombrar, y el registro de notificaciones).
- **`1f0b74c`** — `feat(price): read and write the numeric price column` (los cambios de app y su suite).
- **`5a76f21`** — `test(e2e): prove the price field only takes a decimal number`.

## Aplicado en producción (2026-10-07)

Con autorización explícita del propietario. `db push` aplicó **dos** migraciones, no una: la nuestra y **`20260930160000_birthday_name_day_reminders`**, que estaba fusionada (PR #34) pero **cuyo esquema nunca llegó a producción**. Verificado contra el esquema real: producción tenía **10** tablas y local 11 — faltaba `group_reminder_settings`; tampoco existían `profiles.birth_date`/`name_day` ni `generate_birthday_reminders`.

**No había rotura viva**: el bundle desplegado no contiene ninguna de esas referencias (el frontend en producción es anterior a esa feature). **Pero era una trampa armada**: `app/profile/setup/index.tsx:56-57` manda `birth_date`/`name_day` en el guardado del perfil y `components/ProfileTab.tsx:36` los pide en el `select`, así que el siguiente despliegue habría roto la pestaña de perfil. El push la desarmó.

**Pre-flight hechas antes de empujar**: (1) ¿reaplicación? No, la tabla no existía. (2) Los dos `CHECK` que la migración de cumpleaños recrea: comparados contra el volcado real, el conjunto nuevo **contiene** al viejo, así que el `ALTER` no podía fallar por filas existentes.

**Verificación posterior**: las **26 migraciones con remoto confirmado, ninguna pendiente**; el esquema de producción pasa a **11 tablas** con `group_reminder_settings`, `birth_date`, `name_day` y `price_numeric` presentes. Copias de seguridad en `~/db-backups/` (esquema + datos, fuera del repositorio).

### Datos de la revisión para el paso 2

De **49 filas** de `wishlist_items`: **46 parseadas**, **2 vacías** ('' → `NULL`, se muestran «Sin precio» y no se pierde nada) y **una sola no numérica**: **`'25/30. €'`** (un rango escrito a mano). **Cero candidatas a redondeo**: ningún precio tiene tres decimales. Ese valor produce además un defecto vivo cosmético: la tarjeta pinta `${item.price} €`, así que se ve **«25/30. € €»**, con el euro duplicado.

## Procedimiento de enlace y despliegue (ejecutado)
