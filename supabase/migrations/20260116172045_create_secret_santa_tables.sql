-- Añadir estado de sorteo a los grupos
ALTER TABLE public.groups ADD COLUMN is_draw_active BOOLEAN DEFAULT FALSE;

-- Tabla para asignaciones del sorteo
CREATE TABLE public.draw_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id TEXT REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  giver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  is_revealed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, giver_id) -- Un donante solo regala a uno por grupo
);

-- Tabla para exclusiones del sorteo (bidireccionales por lógica de aplicación)
CREATE TABLE public.draw_exclusions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id TEXT REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_a_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_b_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_a_id, user_b_id)
);

-- Habilitar RLS
ALTER TABLE public.draw_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_exclusions ENABLE ROW LEVEL SECURITY;

-- Políticas para draw_assignments
CREATE POLICY "Los usuarios pueden ver su propia asignación"
  ON public.draw_assignments
  FOR SELECT
  USING (auth.uid() = giver_id);

CREATE POLICY "Los administradores pueden gestionar asignaciones"
  ON public.draw_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = draw_assignments.group_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Políticas para draw_exclusions
CREATE POLICY "Los miembros pueden ver las exclusiones de su grupo"
  ON public.draw_exclusions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = draw_exclusions.group_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Los administradores pueden gestionar exclusiones"
  ON public.draw_exclusions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = draw_exclusions.group_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Habilitar Realtime para las asignaciones (para el pop-up instantáneo si se desea)
ALTER PUBLICATION supabase_realtime ADD TABLE draw_assignments;
