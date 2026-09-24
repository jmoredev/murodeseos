-- Linter: authenticated no debe poder ejecutar esta función como RPC (SECURITY DEFINER).
-- La lógica solo usa OLD, NEW y auth.uid(): no requiere privilegios de propietario.
ALTER FUNCTION public.check_wishlist_update_permissions() SECURITY INVOKER;

-- Refuerzo: sin EXECUTE para roles de API (idempotente si ya se aplicó 20260513183000).
REVOKE ALL ON FUNCTION public.check_wishlist_update_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_wishlist_update_permissions() FROM anon, authenticated;
