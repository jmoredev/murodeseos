# Endurecimiento de la base de datos y de la privacidad

**Feature:** `endurecimiento`
**Estado:** auditoría completada, remediación pendiente de aprobación
**Inicio:** 2026-09-24
**Depende de:** `consolidacion` (proyecto Supabase vinculado)

## Objetivo

Cerrar los huecos de acceso y de privacidad que quedan abiertos en el proyecto
Supabase de producción, sin tocar datos existentes y con migraciones aditivas.

## Estado verificado de producción

Proyecto `bztfzifafquulelcxycqk`, auditado con `supabase db advisors` y
`supabase db query --linked`. Las **18 migraciones locales están aplicadas**, así
que el esquema remoto coincide con el repositorio: no hay deriva.

| Control | Estado | Evidencia |
| --- | --- | --- |
| RLS activo en todas las tablas de `public` | correcto | `relrowsecurity = true` en las 10 tablas |
| `wishlist_items` UPDATE del propietario | correcto | `user_id = auth.uid()` en USING y WITH CHECK |
| `wishlist_items` UPDATE de terceros | correcto | solo reserva o cancelación sobre filas libres o propias |
| `notifications` INSERT | correcto | `actor_id = auth.uid()` |
| `notifications` tipos permitidos | correcto | incluye `draw_performed` y `wish_deleted_by_owner` |
| Storage: política SELECT pública | eliminada | solo quedan INSERT, UPDATE y DELETE |
| `private.get_user_group_ids` | correcto | SECURITY DEFINER, EXECUTE solo a `authenticated` y `service_role` |
| `private.handle_new_user` | correcto | SECURITY DEFINER, EXECUTE solo a `supabase_auth_admin` |
| `public.check_wishlist_update_permissions` | correcto | SECURITY INVOKER, EXECUTE solo a `postgres` y `service_role` |
| Funciones alcanzables por RPC | cerrado | las tres devuelven `PGRST202` con `anon` |

## Hallazgos abiertos

### S1 — El dueño puede leer quién reservó su regalo

La política SELECT de `wishlist_items` es `auth.uid() IS NOT NULL`. El cliente
del dueño recibe todas las columnas, incluida `reserved_by`, y las consultas usan
`select('*')`. La ocultación es solo de interfaz, así que la sorpresa se puede
leer desde el navegador. Viola D3.

### S2 — Cualquier usuario autenticado lee cualquier lista

La misma política no comprueba pertenencia a un grupo. Con el UUID de una persona
—o enumerando— se obtiene su lista completa. Viola D2.

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

### S8 — Redirect de confirmación fijado a localhost

`app/(auth)/signup/index.tsx:49` usa `emailRedirectTo = 'http://localhost:8081/login'`.
Con `mailer_autoconfirm: false` en producción, ningún usuario nuevo puede
confirmar su cuenta. `EXPO_PUBLIC_SITE_URL` está documentada en `env.example`
pero no se usa en el código.

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
| 3 | Mover las reservas a una tabla dedicada y exponer la lectura por función | migración + código | medio: cambia el camino de lectura y escribe datos |
| 4 | Restringir la lectura de `wishlist_items` a grupos compartidos | migración | medio: hay que ajustar las consultas del cliente |
| 5 | Garantizar reserva única con la clave primaria de la tabla nueva | migración | bajo |
| 6 | Arreglar el redirect de confirmación y dar uso a `EXPO_PUBLIC_SITE_URL` | código | bajo |
| 7 | Endurecer el lint hasta convertirlo en puerta bloqueante | código | bajo |
| 8 | Eliminar la carpeta `database/` y dejar `supabase/migrations/` como única fuente de verdad | repositorio | bajo |

### Orden recomendado

El punto 2 es independiente y de riesgo nulo: se puede hacer ya. Los puntos 3, 4
y 5 son el cambio de producto y conviene hacerlos juntos, porque tocan el mismo
camino de lectura y de escritura. El 6 es independiente. El 7 es deuda.

## Restricciones

- Las 18 migraciones existentes no se tocan.
- Toda migración nueva debe ser idempotente y aditiva.
- El repositorio es público: la clave anónima no es un secreto y RLS es la única
  frontera real.
- No se escribe nada en producción sin aprobación explícita.
