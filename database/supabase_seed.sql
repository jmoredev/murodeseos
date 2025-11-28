-- ============================================
-- DATOS DE PRUEBA PARA MURO DE DESEOS
-- ============================================
-- IMPORTANTE: Este script debe ejecutarse en el SQL Editor de Supabase
-- después de haber ejecutado supabase_setup.sql y supabase_groups_schema.sql

-- ============================================
-- 1. CREAR USUARIOS DE PRUEBA
-- ============================================
-- Nota: Supabase Auth maneja la creación de usuarios.
-- Para crear usuarios de prueba, tienes dos opciones:
--
-- OPCIÓN A (Recomendada): Usar el Dashboard de Supabase
--   1. Ve a Authentication > Users
--   2. Haz clic en "Add user" > "Create new user"
--   3. Ingresa email y password para cada usuario
--
-- OPCIÓN B: Usar la API de Supabase desde tu aplicación
--   Crear un endpoint temporal o script que use supabase.auth.admin.createUser()
--
-- Para este seed, asumiremos que ya creaste estos usuarios manualmente:
-- Usuario 1: maria@test.com (password: Test123!)
-- Usuario 2: juan@test.com (password: Test123!)
-- Usuario 3: ana@test.com (password: Test123!)
-- Usuario 4: carlos@test.com (password: Test123!)

-- ============================================
-- 2. INSERTAR PERFILES DE PRUEBA
-- ============================================
-- IMPORTANTE: Reemplaza los UUIDs con los IDs reales de tus usuarios de prueba
-- Puedes obtenerlos ejecutando: SELECT id, email FROM auth.users;

-- Ejemplo de cómo insertar perfiles (DEBES REEMPLAZAR LOS UUIDs):
/*
INSERT INTO profiles (id, username, full_name, display_name, avatar_url, updated_at)
VALUES
  -- María García
  ('REEMPLAZAR-CON-UUID-DE-MARIA', 'maria_garcia', 'María García', 'María', '👩‍💼', NOW()),
  
  -- Juan Pérez
  ('REEMPLAZAR-CON-UUID-DE-JUAN', 'juan_perez', 'Juan Pérez', 'Juan', '👨‍💻', NOW()),
  
  -- Ana López
  ('REEMPLAZAR-CON-UUID-DE-ANA', 'ana_lopez', 'Ana López', 'Ana', '👩‍🎨', NOW()),
  
  -- Carlos Ruiz
  ('REEMPLAZAR-CON-UUID-DE-CARLOS', 'carlos_ruiz', 'Carlos Ruiz', 'Carlos', '👨‍🔧', NOW());
*/

-- ============================================
-- 3. INSERTAR GRUPOS DE PRUEBA
-- ============================================
-- IMPORTANTE: Reemplaza los creator_id con los UUIDs reales de tus usuarios

/*
INSERT INTO groups (id, name, icon, creator_id, created_at, updated_at)
VALUES
  -- Grupo 1: Familia García (creado por María)
  ('FAM001', 'Familia García', '👨‍👩‍👧‍👦', 'REEMPLAZAR-CON-UUID-DE-MARIA', NOW(), NOW()),
  
  -- Grupo 2: Amigos del Trabajo (creado por Juan)
  ('WORK01', 'Amigos del Trabajo', '💼', 'REEMPLAZAR-CON-UUID-DE-JUAN', NOW(), NOW()),
  
  -- Grupo 3: Club de Lectura (creado por Ana)
  ('BOOK01', 'Club de Lectura', '📚', 'REEMPLAZAR-CON-UUID-DE-ANA', NOW(), NOW()),
  
  -- Grupo 4: Equipo Fútbol (creado por Carlos)
  ('SPORT1', 'Equipo Fútbol', '⚽', 'REEMPLAZAR-CON-UUID-DE-CARLOS', NOW(), NOW());
*/

-- ============================================
-- 4. INSERTAR MIEMBROS DE GRUPOS
-- ============================================
-- IMPORTANTE: Reemplaza los user_id con los UUIDs reales de tus usuarios

/*
INSERT INTO group_members (group_id, user_id, role, joined_at)
VALUES
  -- Familia García (FAM001)
  ('FAM001', 'REEMPLAZAR-CON-UUID-DE-MARIA', 'admin', NOW()),    -- María (creadora)
  ('FAM001', 'REEMPLAZAR-CON-UUID-DE-JUAN', 'member', NOW()),    -- Juan
  ('FAM001', 'REEMPLAZAR-CON-UUID-DE-ANA', 'member', NOW()),     -- Ana
  
  -- Amigos del Trabajo (WORK01)
  ('WORK01', 'REEMPLAZAR-CON-UUID-DE-JUAN', 'admin', NOW()),     -- Juan (creador)
  ('WORK01', 'REEMPLAZAR-CON-UUID-DE-MARIA', 'member', NOW()),   -- María
  ('WORK01', 'REEMPLAZAR-CON-UUID-DE-CARLOS', 'member', NOW()),  -- Carlos
  
  -- Club de Lectura (BOOK01)
  ('BOOK01', 'REEMPLAZAR-CON-UUID-DE-ANA', 'admin', NOW()),      -- Ana (creadora)
  ('BOOK01', 'REEMPLAZAR-CON-UUID-DE-MARIA', 'member', NOW()),   -- María
  ('BOOK01', 'REEMPLAZAR-CON-UUID-DE-JUAN', 'member', NOW()),    -- Juan
  
  -- Equipo Fútbol (SPORT1)
  ('SPORT1', 'REEMPLAZAR-CON-UUID-DE-CARLOS', 'admin', NOW()),   -- Carlos (creador)
  ('SPORT1', 'REEMPLAZAR-CON-UUID-DE-JUAN', 'member', NOW()),    -- Juan
  ('SPORT1', 'REEMPLAZAR-CON-UUID-DE-ANA', 'member', NOW());     -- Ana
*/

-- ============================================
-- SCRIPT AUXILIAR: Obtener UUIDs de usuarios
-- ============================================
-- Ejecuta esto primero para obtener los UUIDs de tus usuarios:
-- SELECT id, email FROM auth.users ORDER BY created_at;

-- ============================================
-- SCRIPT AUXILIAR: Limpiar datos de prueba
-- ============================================
-- Si necesitas eliminar todos los datos de prueba, ejecuta:
/*
DELETE FROM group_members;
DELETE FROM groups;
DELETE FROM profiles WHERE username IN ('maria_garcia', 'juan_perez', 'ana_lopez', 'carlos_ruiz');
-- Nota: Los usuarios de auth.users deben eliminarse desde el Dashboard de Supabase
*/
