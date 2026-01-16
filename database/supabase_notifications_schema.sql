-- Tabla de notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Destinatario
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Quién realizó la acción
  group_id TEXT REFERENCES public.groups(id) ON DELETE CASCADE, -- Grupo relacionado (opcional)
  wish_id UUID REFERENCES public.wishlist_items(id) ON DELETE SET NULL, -- Deseo relacionado (opcional)
  type TEXT NOT NULL CHECK (type IN ('wish_added', 'wish_reserved')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Solo el destinatario puede ver sus notificaciones
CREATE POLICY "Users can see their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Permitir inserción (la lógica reside en el cliente/servidor que llama, pero necesitamos permiso)
-- En un entorno real, esto podría ser más restrictivo
CREATE POLICY "Anyone can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Solo el destinatario puede marcar como leída
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Habilitar Realtime para esta tabla
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
