-- Tabla de items de lista de deseos
CREATE TABLE wishlist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  links TEXT[] DEFAULT '{}',
  image_url TEXT,
  price TEXT,
  notes TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  is_reserved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_wishlist_items_user_id ON wishlist_items(user_id);

-- Row Level Security (RLS)
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Usuarios pueden ver sus propios items"
  ON wishlist_items FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Usuarios pueden crear sus propios items"
  ON wishlist_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuarios pueden actualizar sus propios items"
  ON wishlist_items FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Usuarios pueden eliminar sus propios items"
  ON wishlist_items FOR DELETE
  USING (user_id = auth.uid());
