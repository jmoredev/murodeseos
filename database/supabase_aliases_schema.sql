-- Tabla de apodos de usuarios
CREATE TABLE IF NOT EXISTS user_aliases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  alias TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(owner_id, target_user_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_user_aliases_owner_id ON user_aliases(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_aliases_target_user_id ON user_aliases(target_user_id);

-- Row Level Security (RLS)
ALTER TABLE user_aliases ENABLE ROW LEVEL SECURITY;

-- Políticas
-- 1. LECTURA: Solo el dueño del alias puede verlo
CREATE POLICY "Usuarios pueden ver sus propios alias creados"
  ON user_aliases FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- 2. CREACIÓN: Solo el dueño puede crear alias
CREATE POLICY "Usuarios pueden crear alias"
  ON user_aliases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- 3. ACTUALIZACIÓN: Solo el dueño puede editar sus alias
CREATE POLICY "Usuarios pueden actualizar sus propios alias"
  ON user_aliases FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- 4. ELIMINACIÓN: Solo el dueño puede eliminar sus alias
CREATE POLICY "Usuarios pueden eliminar sus propios alias"
  ON user_aliases FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);
