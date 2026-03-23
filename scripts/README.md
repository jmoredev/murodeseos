# Datos de Prueba - Muro de Deseos

Este directorio contiene scripts para crear y gestionar datos de prueba en tu aplicación.

## 📋 Contenido

- **`supabase_seed.sql`** - Plantilla SQL con estructura de datos de prueba
- **`create-test-users.ts`** - Script automatizado para crear usuarios de prueba
- **`delete-test-users.ts`** - Script para limpiar datos de prueba

## 🚀 Método Recomendado: Script Automatizado

### Requisitos Previos

1. **Obtener la Service Role Key de Supabase:**
   - Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
   - Settings → API
   - Copia la `service_role` key (⚠️ **NUNCA** la compartas ni la subas a Git)

2. **Configurar variables de entorno:**
   Añade a tu archivo `.env.local`:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=tu-url-de-supabase
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
   ```

### Crear Datos de Prueba

```bash
# Instalar tsx si no lo tienes
npm install -D tsx

# Ejecutar script de creación
npx tsx scripts/create-test-users.ts
```

Este script creará:
- ✅ 4 usuarios de prueba
- ✅ 4 perfiles completos
- ✅ 4 grupos diferentes
- ✅ 12 membresías de grupos

### Usuarios Creados

| Email | Password | Nombre | Avatar |
|-------|----------|--------|--------|
| maria@test.com | Test123! | María García | 👩‍💼 |
| juan@test.com | Test123! | Juan Pérez | 👨‍💻 |
| ana@test.com | Test123! | Ana López | 👩‍🎨 |
| carlos@test.com | Test123! | Carlos Ruiz | 👨‍🔧 |

### Grupos Creados

| ID | Nombre | Icono | Creador |
|----|--------|-------|---------|
| FAM001 | Familia García | 👨‍👩‍👧‍👦 | María |
| WORK01 | Amigos del Trabajo | 💼 | Juan |
| BOOK01 | Club de Lectura | 📚 | Ana |
| SPORT1 | Equipo Fútbol | ⚽ | Carlos |

### Limpiar Datos de Prueba

```bash
npx tsx scripts/delete-test-users.ts
```

Este script eliminará todos los usuarios, perfiles, grupos y membresías de prueba.

## 📝 Método Alternativo: SQL Manual

Si prefieres crear los datos manualmente:

1. **Crear usuarios en Supabase Dashboard:**
   - Authentication → Users → Add user
   - Crear los 4 usuarios listados arriba

2. **Obtener los UUIDs:**
   ```sql
   SELECT id, email FROM auth.users ORDER BY created_at;
   ```

3. **Editar `supabase_seed.sql`:**
   - Reemplaza todos los `REEMPLAZAR-CON-UUID-DE-*` con los UUIDs reales
   - Descomenta las secciones de INSERT

4. **Ejecutar en SQL Editor:**
   - Ve a SQL Editor en Supabase Dashboard
   - Pega y ejecuta el contenido de `supabase_seed.sql`

## ⚠️ Notas Importantes

- **Seguridad:** La `service_role` key tiene acceso completo a tu base de datos. Úsala solo en desarrollo local.
- **Git:** Asegúrate de que `.env.local` esté en tu `.gitignore`
- **Producción:** NUNCA uses estos scripts en producción

## 🔍 Verificar Datos

Después de crear los datos, puedes verificarlos:

```sql
-- Ver usuarios
SELECT id, email FROM auth.users;

-- Ver perfiles
SELECT id, username, display_name, avatar_url FROM profiles;

-- Ver grupos
SELECT id, name, icon, creator_id FROM groups;

-- Ver membresías
SELECT gm.group_id, g.name, p.username, gm.role 
FROM group_members gm
JOIN groups g ON gm.group_id = g.id
JOIN profiles p ON gm.user_id = p.id
ORDER BY g.name, gm.role DESC;
```

## 🎯 Casos de Uso

Estos datos de prueba te permiten probar:
- ✅ Login con diferentes usuarios
- ✅ Visualización de grupos
- ✅ Roles de admin vs member
- ✅ Múltiples membresías por usuario
- ✅ Diferentes iconos y nombres de grupos
