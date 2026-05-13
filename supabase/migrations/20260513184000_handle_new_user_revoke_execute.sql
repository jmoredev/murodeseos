-- handle_new_user solo debe ejecutarse como trigger tras INSERT en auth.users, no como RPC público.
-- SECURITY DEFINER + EXECUTE en PUBLIC permite invocación vía PostgREST (anon).

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
