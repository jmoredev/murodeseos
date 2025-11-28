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
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- 2. CREACIÓN: Solo el dueño puede crear items
CREATE POLICY "Usuarios pueden crear sus propios items"
  ON wishlist_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- 3. ACTUALIZACIÓN: Unificada (Dueño edita todo, Otros solo reservan)
-- La lógica de seguridad granular se maneja en el trigger tr_check_wishlist_update
CREATE POLICY "Usuarios autenticados pueden actualizar items"
  ON wishlist_items FOR UPDATE
  TO authenticated
  USING ( true )
  WITH CHECK ( true );

CREATE POLICY "Usuarios pueden eliminar sus propios items"
  ON wishlist_items FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Triggers de Seguridad
CREATE OR REPLACE FUNCTION public.check_wishlist_update_permissions()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := (select auth.uid());
  
  -- 1. Nadie puede cambiar el propietario (user_id)
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'No se permite cambiar el propietario del item.';
  END IF;

  -- 2. Si soy el dueño, permito la edición
  IF OLD.user_id = current_user_id THEN
    RETURN NEW;
  END IF;

  -- 3. Si NO soy el dueño, solo permito cambiar reserved_by
  IF OLD.title IS DISTINCT FROM NEW.title OR
     OLD.links IS DISTINCT FROM NEW.links OR
     OLD.image_url IS DISTINCT FROM NEW.image_url OR
     OLD.price IS DISTINCT FROM NEW.price OR
     OLD.notes IS DISTINCT FROM NEW.notes OR
     OLD.priority IS DISTINCT FROM NEW.priority THEN
     RAISE EXCEPTION 'No tienes permiso para editar los detalles de este regalo. Solo puedes reservarlo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_check_wishlist_update ON wishlist_items;
CREATE TRIGGER tr_check_wishlist_update
  BEFORE UPDATE ON wishlist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_wishlist_update_permissions();
