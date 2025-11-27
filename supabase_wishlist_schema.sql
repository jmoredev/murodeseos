-- Drop existing table if it exists
DROP TABLE IF EXISTS wishlist_items CASCADE;

-- Create wishlist_items table
CREATE TABLE wishlist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  links TEXT[] DEFAULT '{}',
  image_url TEXT,
  price TEXT,
  notes TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  reserved_by UUID REFERENCES auth.users, -- ID del usuario que reservó el regalo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_wishlist_items_user_id ON wishlist_items(user_id);
CREATE INDEX idx_wishlist_items_reserved_by ON wishlist_items(reserved_by);

-- Row Level Security (RLS)
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- Políticas

-- 1. LECTURA: Todos los usuarios autenticados pueden ver los items (necesario para ver listas de amigos)
CREATE POLICY "Usuarios autenticados pueden ver todos los items"
  ON wishlist_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. CREACIÓN: Solo el dueño puede crear items
CREATE POLICY "Usuarios pueden crear sus propios items"
  ON wishlist_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 3. ACTUALIZACIÓN (Dueño): El dueño puede editar sus items
CREATE POLICY "Usuarios pueden actualizar sus propios items"
  ON wishlist_items FOR UPDATE
  USING (user_id = auth.uid());

-- 4. ACTUALIZACIÓN (Reserva): Otros usuarios pueden actualizar el campo reserved_by
CREATE POLICY "Otros usuarios pueden reservar items"
  ON wishlist_items FOR UPDATE
  USING (user_id != auth.uid())
  WITH CHECK (user_id != auth.uid());

-- 5. ELIMINACIÓN: Solo el dueño puede borrar
CREATE POLICY "Usuarios pueden eliminar sus propios items"
  ON wishlist_items FOR DELETE
  USING (user_id = auth.uid());
