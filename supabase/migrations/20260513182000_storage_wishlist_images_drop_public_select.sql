-- Bucket wishlist-images es público: el acceso por URL pública no depende de una política SELECT en storage.objects.
-- Una política SELECT para `to public` permite listar/recorrer todo el bucket por la API (riesgo de exposición).
-- La app solo construye URLs con getPublicUrl; no usa .list() ni SELECT sobre objects.

DROP POLICY IF EXISTS "Imágenes de wishlist son públicas" ON storage.objects;
