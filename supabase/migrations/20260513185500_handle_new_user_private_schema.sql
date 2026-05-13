-- `private` no está en api.schemas → PostgREST no expone RPC; evita authenticated/anon en /rpc/handle_new_user.
-- El trigger en auth.users la ejecuta como proceso de Auth (rol supabase_auth_admin en Supabase).

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;

DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION private.handle_new_user() TO supabase_auth_admin;
  END IF;
END
$body$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

DROP FUNCTION IF EXISTS public.handle_new_user();
