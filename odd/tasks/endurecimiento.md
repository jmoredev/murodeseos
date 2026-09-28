# Endurecimiento de la base de datos y de la privacidad

**Feature:** `endurecimiento`
**Estado:** **cerrada** — S1, S2 y D4 corregidos, **aplicados y verificados en producción** el 2026-09-28 con las dos fases de la migración de reservas. S8 quedó resuelto y verificado, y **S13** se cerró el 2026-09-28 retirando la carpeta `database/` (unidad [`higiene`](./higiene.md)). Quedan **S11** (panel de Supabase, depende del plan) y **S12** (rutas dinámicas: rediseño de producto) como trabajo aparte. S14 vive en [`consolidacion.md`](./consolidacion.md).
**Inicio:** 2026-09-24
**Depende de:** `consolidacion` (proyecto Supabase vinculado)

## Objetivo

Cerrar los huecos de acceso y de privacidad que quedan abiertos en el proyecto
Supabase de producción, sin tocar datos existentes y con migraciones aditivas.

## Estado verificado de producción

Proyecto `bztfzifafquulelcxycqk`, auditado con `supabase db advisors` y
`supabase db query --linked`. Las **21 migraciones locales están aplicadas** —incluidas las dos
de la migración de reservas— así que el esquema remoto coincide con el repositorio: no hay
deriva.

| Control | Estado | Evidencia |
| --- | --- | --- |
| RLS activo en todas las tablas de `public` | correcto | `relrowsecurity = true` en las 9 tablas (medida del 2026-09-28); una de ellas es `wishlist_reservations`, que la fase 1 añadió |
| `wishlist_items` UPDATE del propietario | correcto | `user_id = auth.uid()` en USING y WITH CHECK |
| `wishlist_items` UPDATE de terceros | correcto | ya no existe política de UPDATE para terceros: solo el dueño actualiza sus deseos. La política de compatibilidad que abrió la fase 1 se retiró con la fase 2 |
| `notifications` INSERT | correcto | `actor_id = auth.uid()` |
| `notifications` tipos permitidos | correcto | incluye `draw_performed` y `wish_deleted_by_owner` |
| Storage: política SELECT pública | eliminada | solo quedan INSERT, UPDATE y DELETE |
| `private.get_user_group_ids` | correcto | SECURITY DEFINER, EXECUTE solo a `authenticated` y `service_role` |
| `private.handle_new_user` | correcto | SECURITY DEFINER, EXECUTE solo a `supabase_auth_admin` |
| `public.check_wishlist_update_permissions` | correcto | SECURITY INVOKER, EXECUTE solo a `postgres` y `service_role` |
| Funciones alcanzables por RPC | cerrado | las tres devuelven `PGRST202` con `anon` |

## Hallazgos abiertos

### S1 — El dueño puede leer quién reservó su regalo (RESUELTO)

> **Resuelto el 2026-09-25** en la feature `reservas`, y **cerrado en producción el
> 2026-09-28**. La reserva dejó de vivir en `wishlist_items`: se movió a
> `public.wishlist_reservations` con
> `supabase/migrations/20260925120000_wishlist_reservations_privacy.sql` (fase 1, que además
> conservó `reserved_by` como espejo del bundle ya desplegado), y la ventana se cerró con
> `20260928120000_drop_reserved_by_window.sql` (fase 2: retira la columna, su índice, su clave
> foránea, el puente de disparadores y la política de compatibilidad). El cliente recibe el
> estado por `get_wishlist_reservation_states`, que nunca devuelve autoría, y el dueño no
> recibe estado de sus propios deseos. Verificado en local con una matriz por rol y en
> producción tras aplicar la fase 2: la columna ya no existe. Detalle en
> [`reservas.md`](./reservas.md).

La política SELECT de `wishlist_items` era `auth.uid() IS NOT NULL`. El cliente
del dueño recibía todas las columnas, incluida `reserved_by`, y las consultas usan
`select('*')`. La ocultación era solo de interfaz, así que la sorpresa se podía
leer desde el navegador. Viola D3.

### S2 — Cualquier usuario autenticado lee cualquier lista (RESUELTO)

> **Resuelto el 2026-09-25** en la misma migración de la feature `reservas`, y **cerrado en
> producción el 2026-09-28**: la política SELECT exige ahora un grupo compartido con el dueño
> que no esté en `excluded_group_ids`. El filtro de exclusiones que el cliente aplicaba por su
> cuenta se retiró, para que la política sea la única autoridad. Verificado contra la base local
> con una matriz por rol y en producción tras aplicar las dos fases.

La misma política no comprobaba pertenencia a un grupo. Con el UUID de una persona
—o enumerando— se obtenía su lista completa. Viola D2.

### S10 — Copia de credenciales olvidada en el esquema expuesto (RESUELTO)

> **Resuelto el 2026-09-24** con la migración `20260924140609_drop_leftover_tmp_auth_tables.sql`,
> aplicada a producción. Verificado: las dos tablas ya no existen, ningún objeto
> `tmp*` queda en `public`, las 8 tablas reales conservan RLS y sus políticas sin
> cambios, hay 19/19 migraciones registradas, y los advisors pasaron de 3
> hallazgos a 1.

`public.tmp_auth_users` y `public.tmp_auth_identities` son andamiaje temporal que
`supabase db pull` genera para resolver dependencias del esquema `auth`. Ninguna
migración las elimina.

| Hecho | Dato |
| --- | --- |
| Filas | 10 en cada tabla |
| Contenido | 10 correos y **10 hashes de contraseña** en `tmp_auth_users` |
| Ubicación | esquema `public`, expuesto por PostgREST |
| RLS | activo con **cero políticas** |
| Permisos a `anon` y `authenticated` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, **TRUNCATE**, UPDATE |
| Dependencias | ninguna clave foránea las referencia |
| Uso en el código | ninguna |

Hoy no se pueden leer filas por la API porque RLS sin políticas deniega todo, y
eso es lo único que lo impide. Dos consecuencias: `TRUNCATE` **no está sujeto a
RLS**, así que `anon` conserva ese privilegio sobre una tabla con hashes; y basta
una política añadida por error, o un `DISABLE ROW LEVEL SECURITY`, para exponer
las credenciales de 10 personas. Es una copia de `auth.users` que no debería
existir.

### S11 — Protección de contraseñas filtradas desactivada

El advisor `auth_leaked_password_protection` está en nivel WARN y es el único
hallazgo que queda. Supabase puede comprobar las contraseñas contra
HaveIBeenPwned y está desactivado.

### S12 — Las rutas dinámicas devuelven 404 con el shell de la SPA (nuevo)

`/wishlist/<uuid>` y `/groups/<código>` responden **404** aunque sirven el
contenido exacto de `404.html`, que incluye el bundle. La aplicación arranca y
enruta correctamente, así que visualmente funciona; lo incorrecto es el código de
estado. Afecta a recargar o enlazar directamente esas páginas.

El enlace de invitación `/groups/join?code=...` sí devuelve 200, así que el flujo
de compartir no está afectado. Es comportamiento preexistente del export
estático, no una regresión: GitHub Pages no puede reescribir un 404 a 200. La
solución sería evitar rutas dinámicas y usar parámetros de consulta, que el
export sí genera como rutas estáticas.

### S13 — SQL antiguo en `database/` que revertiría el endurecimiento (RESUELTO)

> **Resuelto el 2026-09-28.** La carpeta `database/` se retiró entera —sus seis scripts y el
> `README.md` que los mandaba ejecutar— en el commit `008e646`, dentro de la unidad
> [`higiene`](./higiene.md). `supabase/migrations/` queda como única fuente de verdad del
> esquema y la historia de git conserva lo retirado. No se cambió nada del esquema ni se
> volvió a consultar la base.

Nada del repositorio usa la carpeta `database/`, pero contiene scripts SQL
anteriores a las migraciones que las contradicen. El más peligroso empieza así:

```sql
-- database/supabase_wishlist_schema.sql
DROP TABLE IF EXISTS wishlist_items CASCADE;
```

Ejecutarlo destruiría la tabla de deseos y volvería a crear las políticas
permisivas antiguas: `USING (true) WITH CHECK (true)` en `wishlist_items`,
`WITH CHECK (true)` en `notifications` y el `SELECT` público del bucket. Es decir,
revertiría todo el endurecimiento de mayo y la migración que eliminó las tablas
`tmp_auth_*`, y se llevaría por delante datos reales.

`database/README.md` describe además tablas `wishes` y `reservations` que no
existen y manda ejecutar `database/supabase_seed.sql`, que tampoco existe.

Nada lo ejecuta automáticamente, así que hoy no hay daño: es una trampa para quien
siga las instrucciones del README. La solución es eliminar la carpeta y dejar
`supabase/migrations/` como única fuente de verdad.

### S8 — Redirect de confirmación fijado a localhost (RESUELTO)

> **Resuelto el 2026-09-28.** `lib/site-url.ts` centraliza la URL base del sitio: usa
> `EXPO_PUBLIC_SITE_URL` —que ahora sí se usa en el código y que `deploy.yml` pasa al build
> desde la variable del repositorio— y, si no está definida, deriva el sitio actual (el origen
> más la ruta base de GitHub Pages), con `http://localhost:8081` como último recurso. El alta
> compone el enlace de confirmación con ella. `getGithubPagesBasePath` se movió a ese módulo y
> `app/_layout.tsx` lo importa, así que hay una sola fuente de verdad. Cubierto por
> `__tests__/site-url.test.ts`.
>
> Queda del lado del panel de Supabase que la **Site URL** y la lista de redirecciones incluyan
> el sitio de producción; eso no se puede leer desde el repositorio.

`app/(auth)/signup/index.tsx:49` usaba `emailRedirectTo = 'http://localhost:8081/login'`.
Con `mailer_autoconfirm: false` en producción, ningún usuario nuevo puede
confirmar su cuenta. `EXPO_PUBLIC_SITE_URL` estaba documentada en `env.example`
pero no se usaba en el código.

## Diseño de la remediación de S1, S2 y D4

### Lo que se descartó, y por qué

El primer diseño era ocultar `reserved_by` al dueño revocando el `SELECT` de esa
columna con privilegios a nivel de columna. **No es viable.** La documentación de
PostgreSQL sobre privilegios dice, sobre `SELECT`:

> permite leer cualquier columna… este privilegio también es necesario para
> referenciar valores de columnas existentes en `UPDATE`, `DELETE` o `MERGE`.

Las políticas de UPDATE y el trigger `check_wishlist_update_permissions`
referencian `reserved_by`, y el trigger compara además `OLD.title`, `OLD.links`,
etcétera. Revocar el `SELECT` de esa columna rompería las reservas para todos los
usuarios. Supabase lo desaconseja de forma explícita:

> No recomendamos usar privilegios a nivel de columna para la mayoría de
> usuarios. Recomendamos políticas RLS combinadas con **una tabla dedicada**
> para los datos sensibles.

### Lo que se hará

Mover las reservas a su propia tabla, que es la recomendación de Supabase:

```sql
create table public.wishlist_reservations (
  item_id     uuid primary key references public.wishlist_items(id) on delete cascade,
  reserver_id uuid not null references auth.users(id) on delete cascade,
  reserved_at timestamptz not null default now()
);
```

Consecuencias buscadas:

| Efecto | Cómo se consigue |
| --- | --- |
| El dueño no puede ver quién reservó | La información deja de estar en la tabla que él lee: no hay nada que ocultar |
| Reserva única, gana el primero | La clave primaria de `item_id` lo garantiza en la base de datos |
| Solo miembros de un grupo común leen una lista | Política RLS sobre `wishlist_items` con pertenencia a grupo compartido |
| Cada uno ve solo sus reservas | Política RLS sobre `wishlist_reservations`: `reserver_id = auth.uid()` |
| El visitante sabe si un regalo está reservado | Función `SECURITY DEFINER` que devuelve solo un indicador, nunca la autoría |

### Alcance real y requisito previo

No es una migración pequeña. Incluye migrar los datos existentes de `reserved_by`,
eliminar la columna, reescribir el trigger y las políticas de UPDATE, y adaptar
`WishListTab.tsx`, `app/wishlist/[userId]/page.tsx`, `WishlistCard.tsx`,
`WishDetailModal.tsx` y sus tests.

**Requisito previo:** verificación en base de datos local. El cambio toca RLS,
privilegios y una función `SECURITY DEFINER` sobre datos reales, y los errores en
esta área no se ven hasta que fallan en producción. Para levantar la base local
hace falta el demonio de Docker accesible desde el proceso.

## Plan de remediación

Todo son migraciones nuevas y aditivas. Producción tiene datos reales: nada de
reinicar el esquema ni reescribir migraciones existentes.

| # | Acción | Tipo | Riesgo |
| --- | --- | --- | --- |
| 1 | Revocar los permisos de `anon` y `authenticated` sobre las dos tablas `tmp_auth_*` y eliminarlas | migración | **hecho** |
| 2 | Activar la protección de contraseñas filtradas | panel de Supabase | nulo |
| 3 | Mover las reservas a una tabla dedicada y exponer la lectura por función | migración + código | **hecho** en local: `20260925120000_wishlist_reservations_privacy.sql` |
| 4 | Restringir la lectura de `wishlist_items` a grupos compartidos | migración | **hecho** en local: política `"Veo mis deseos y los de mis grupos"` |
| 5 | Garantizar reserva única con la clave primaria de la tabla nueva | migración | **hecho** en local: `item_id` es la clave primaria |
| 6 | Arreglar el redirect de confirmación y dar uso a `EXPO_PUBLIC_SITE_URL` | código | **hecho**: `lib/site-url.ts`, `deploy.yml` y `__tests__/site-url.test.ts` |
| 7 | Endurecer el lint hasta convertirlo en puerta bloqueante | código | bajo |
| 8 | Eliminar la carpeta `database/` y dejar `supabase/migrations/` como única fuente de verdad | repositorio | bajo |

### Orden recomendado

El punto 2 es independiente y de riesgo nulo: se puede hacer ya. Los puntos 3, 4
y 5 son el cambio de producto y conviene hacerlos juntos, porque tocan el mismo
camino de lectura y de escritura. El 6 es independiente. El 7 es deuda.

## Restricciones

- Las migraciones ya aplicadas no se tocan: se añaden nuevas, idempotentes y aditivas.
- Toda migración nueva debe ser idempotente y aditiva.
- El repositorio es público: la clave anónima no es un secreto y RLS es la única
  frontera real.
- No se escribe nada en producción sin aprobación explícita.
