-- get_user_group_ids es SECURITY DEFINER y no debe ser invocable por anon vía PostgREST RPC.
-- La política de lectura solo aplica a sesiones autenticadas (anon no obtenía filas con auth.uid() NULL).
-- EXECUTE solo para roles que evalúan RLS / service_role.

DROP POLICY IF EXISTS "Los miembros pueden ver otros miembros de sus grupos" ON public.group_members;

CREATE POLICY "Los miembros pueden ver otros miembros de sus grupos"
  ON public.group_members
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT public.get_user_group_ids((SELECT auth.uid()))
    )
  );

REVOKE ALL ON FUNCTION public.get_user_group_ids(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_group_ids(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_group_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_group_ids(uuid) TO service_role;
