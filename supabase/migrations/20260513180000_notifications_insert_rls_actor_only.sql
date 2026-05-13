-- Sustituye INSERT demasiado permisivo: solo quien actúa puede crear la fila (actor_id = sesión).
-- El aviso de Supabase/Linter sobre WITH CHECK siempre true queda resuelto.
-- Las inserciones del cliente (notification-utils) ya envían actor_id como el usuario autenticado.

DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert notifications as actor"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());
