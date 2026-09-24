-- Denormalized payload for notifications (e.g. wish title after wishlist row is deleted)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Align CHECK with app notification types (draw_performed was used in code but missing from initial CHECK)
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'wish_added',
    'wish_reserved',
    'draw_performed',
    'wish_deleted_by_owner'
  ));
