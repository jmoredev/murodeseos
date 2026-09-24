-- Elimina el andamiaje temporal que una extracción inicial dejó en el esquema public.
--
-- `public.tmp_auth_users` y `public.tmp_auth_identities` se crearon para resolver
-- dependencias del esquema `auth` durante un `supabase db pull`. Ninguna migración
-- las eliminó, así que quedaron en el esquema expuesto por PostgREST con una copia
-- de `auth.users`: 10 correos y 10 hashes bcrypt en `tmp_auth_users`.
--
-- Su única defensa era RLS activo sin políticas, que deniega toda lectura, pero
-- `anon` y `authenticated` conservaban DELETE, INSERT, REFERENCES, SELECT, TRIGGER,
-- TRUNCATE y UPDATE. `TRUNCATE` no está sujeto a RLS, así que ese privilegio era
-- efectivo, y bastaba una política añadida por error para exponer las credenciales.
--
-- Comprobado antes de eliminarlas: ninguna clave foránea las referencia, ninguna
-- función, vista ni disparador las menciona, no tienen políticas, y ningún código
-- de la aplicación las usa. Los 10 registros son copias obsoletas: los datos vivos
-- están en `auth.users`.
--
-- Al ejecutarse después de 20260102122206_estructura_inicial, un `supabase db reset`
-- local reproduce el mismo esquema que producción.

-- Los privilegios se retiran primero: si el DROP fallara por cualquier motivo, el
-- acceso indebido ya estaría cerrado. Ambas guardas hacen la migración idempotente.
do $body$
begin
    if to_regclass('public.tmp_auth_users') is not null then
        execute 'revoke all on table public.tmp_auth_users from anon, authenticated';
    end if;

    if to_regclass('public.tmp_auth_identities') is not null then
        execute 'revoke all on table public.tmp_auth_identities from anon, authenticated';
    end if;
end
$body$;

drop table if exists public.tmp_auth_users;
drop table if exists public.tmp_auth_identities;
