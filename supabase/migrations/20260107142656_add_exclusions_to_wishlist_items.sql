-- Add excluded_group_ids column to wishlist_items
ALTER TABLE public.wishlist_items 
ADD COLUMN excluded_group_ids text[] DEFAULT '{}'::text[];

-- Update the check_wishlist_update_permissions function to allow owners to edit exclusions
CREATE OR REPLACE FUNCTION public.check_wishlist_update_permissions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := (select auth.uid());
  
  -- 1. Nadie puede cambiar el propietario (user_id)
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'No se permite cambiar el propietario del item.';
  END IF;

  -- 2. Si soy el dueño, permito la edición (incluyendo excluded_group_ids)
  IF OLD.user_id = current_user_id THEN
    RETURN NEW;
  END IF;

  -- 3. Si NO soy el dueño, solo permito cambiar reserved_by
  IF OLD.title IS DISTINCT FROM NEW.title OR
     OLD.links IS DISTINCT FROM NEW.links OR
     OLD.image_url IS DISTINCT FROM NEW.image_url OR
     OLD.price IS DISTINCT FROM NEW.price OR
     OLD.notes IS DISTINCT FROM NEW.notes OR
     OLD.priority IS DISTINCT FROM NEW.priority OR
     OLD.excluded_group_ids IS DISTINCT FROM NEW.excluded_group_ids THEN
     RAISE EXCEPTION 'No tienes permiso para editar los detalles de este regalo. Solo puedes reservarlo.';
  END IF;

  RETURN NEW;
END;
$function$;
