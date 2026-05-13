-- Sustituye UPDATE con USING/WITH CHECK (true): el linter de Supabase lo marca como bypass de RLS.
-- Reglas alineadas con la app y con check_wishlist_update_permissions (trigger):
--   - El dueño (user_id) puede actualizar su fila.
--   - Quien no es dueño solo puede tocar filas no reservadas o reservadas por él (reservar / cancelar reserva).

DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar items" ON public.wishlist_items;

CREATE POLICY "Propietarios pueden actualizar sus deseos"
  ON public.wishlist_items
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Reserva o cancelación en listas ajenas"
  ON public.wishlist_items
  FOR UPDATE
  TO authenticated
  USING (
    user_id IS DISTINCT FROM auth.uid()
    AND (reserved_by IS NULL OR reserved_by = auth.uid())
  )
  WITH CHECK (
    user_id IS DISTINCT FROM auth.uid()
    AND (reserved_by IS NULL OR reserved_by = auth.uid())
  );
