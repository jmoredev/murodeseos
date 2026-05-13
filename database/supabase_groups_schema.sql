-- Tabla de grupos
CREATE TABLE groups (
  id TEXT PRIMARY KEY, -- Código corto (ej: "X7K9P2")
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🎁',
  creator_id UUID REFERENCES auth.users NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de miembros de grupos
CREATE TABLE group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_groups_creator_id ON groups(creator_id);

-- Row Level Security (RLS)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Políticas para groups
-- Permitir que cualquier usuario autenticado vea grupos (la restricción real está en group_members)
CREATE POLICY "Los grupos son visibles para usuarios autenticados"
  ON groups FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Cualquier usuario autenticado puede crear grupos"
  ON groups FOR INSERT
  WITH CHECK ((select auth.uid()) = creator_id);

CREATE POLICY "Solo el creador puede actualizar el grupo"
  ON groups FOR UPDATE
  USING (creator_id = (select auth.uid()));

CREATE POLICY "Solo el creador puede eliminar el grupo"
  ON groups FOR DELETE
  USING (creator_id = (select auth.uid()));

-- Políticas para group_members (sin recursión)
-- Función en schema `private`: no expuesta por PostgREST (solo public/graphql_public en API).
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.get_user_group_ids(user_uuid uuid)
RETURNS TABLE(group_id text)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
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

-- Política corregida: Los miembros pueden ver a TODOS los miembros de los grupos a los que pertenecen
CREATE POLICY "Los miembros pueden ver otros miembros de sus grupos"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT private.get_user_group_ids((select auth.uid()))
    )
  );

CREATE POLICY "Los usuarios pueden unirse a grupos"
  ON group_members FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Los usuarios pueden salir de grupos"
  ON group_members FOR DELETE
  USING (user_id = (select auth.uid()));

-- ACTUALIZACIÓN: Apodos para grupos (Añadido posteriormente)
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS group_alias TEXT;

-- Política para permitir que los usuarios actualicen sus propios apodos (y otros campos de su membresía)
CREATE POLICY "Los usuarios pueden actualizar su propia membresía"
  ON group_members FOR UPDATE
  USING (user_id = (select auth.uid()));
