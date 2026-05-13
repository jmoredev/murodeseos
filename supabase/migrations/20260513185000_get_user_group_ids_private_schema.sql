-- PostgREST solo expone public (config); las funciones en `private` no generan /rpc/....
-- Sigue siendo SECURITY DEFINER para leer group_members sin recursión RLS.
-- Sustituye public.get_user_group_ids tras el endurecimiento en 20260513183500.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.get_user_group_ids(user_uuid uuid)
RETURNS TABLE(group_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gm.group_id
  FROM public.group_members AS gm
  WHERE gm.user_id = user_uuid;
$$;

REVOKE ALL ON FUNCTION private.get_user_group_ids(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_user_group_ids(uuid) TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.get_user_group_ids(uuid) TO service_role;

DROP POLICY IF EXISTS "Los miembros pueden ver otros miembros de sus grupos" ON public.group_members;

CREATE POLICY "Los miembros pueden ver otros miembros de sus grupos"
  ON public.group_members
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT private.get_user_group_ids((SELECT auth.uid()))
    )
  );

DROP FUNCTION IF EXISTS public.get_user_group_ids(uuid);
