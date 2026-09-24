-- check_wishlist_update_permissions es solo para el trigger; no debe ser invocable vía PostgREST (anon/authenticated).
-- SECURITY DEFINER + EXECUTE público = riesgo (linter Supabase).

REVOKE ALL ON FUNCTION public.check_wishlist_update_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_wishlist_update_permissions() FROM anon, authenticated;
