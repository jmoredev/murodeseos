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

### S10 — Copia de credenciales olvidada en el esquema expuesto (nuevo)

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

### S11 — Protección de contraseñas filtradas desactivada (nuevo)

El advisor `auth_leaked_password_protection` está en nivel WARN. Supabase puede
comprobar las contraseñas contra HaveIBeenPwned y está desactivado.

### S8 — Redirect de confirmación fijado a localhost

`app/(auth)/signup/index.tsx:49` usa `emailRedirectTo = 'http://localhost:8081/login'`.
Con `mailer_autoconfirm: false` en producción, ningún usuario nuevo puede
confirmar su cuenta. `EXPO_PUBLIC_SITE_URL` está documentada en `env.example`
pero no se usa en el código.

## Plan de remediación

Todo son migraciones nuevas y aditivas. Producción tiene datos reales: nada de
reinicar el esquema ni reescribir migraciones existentes.

| # | Acción | Tipo | Riesgo |
| --- | --- | --- | --- |
| 1 | Revocar los permisos de `anon` y `authenticated` sobre las dos tablas `tmp_auth_*` y eliminarlas | migración | bajo: sin claves foráneas y sin uso en el código |
| 2 | Activar la protección de contraseñas filtradas | panel de Supabase | nulo |
| 3 | Exponer la lectura de listas por una vista o función que exija grupo en común y no devuelva `reserved_by` al dueño | migración + código | medio: cambia el camino de lectura |
| 4 | Restringir `wishlist_items` SELECT para que solo devuelva filas de grupos compartidos | migración | medio: hay que ajustar las consultas del cliente |
| 5 | Garantizar reserva única con una restricción en la base de datos y un mensaje claro al segundo | migración + código | medio |
| 6 | Arreglar el redirect de confirmación y dar uso a `EXPO_PUBLIC_SITE_URL` | código | bajo |
| 7 | Endurecer el lint hasta convertirlo en puerta bloqueante | código | bajo |

### Orden recomendado

Los puntos 1 y 2 son independientes y de riesgo bajo: se pueden hacer ya. Los
puntos 3, 4 y 5 son el cambio de producto y conviene hacerlos juntos, porque
tocan el mismo camino de lectura y de escritura. El 6 es independiente.

## Restricciones

- Las 18 migraciones existentes no se tocan.
- Toda migración nueva debe ser idempotente y aditiva.
- El repositorio es público: la clave anónima no es un secreto y RLS es la única
  frontera real.
- No se escribe nada en producción sin aprobación explícita.
