# 🗄️ Scripts de Base de Datos - Muro de Deseos

Esta carpeta contiene todos los scripts SQL necesarios para configurar y poblar la base de datos de Supabase.

## 📋 Orden de Ejecución

Ejecuta los scripts en el siguiente orden para configurar la base de datos correctamente:

### 1️⃣ **Setup Inicial** (Primero)
```sql
supabase_setup.sql
```
- Crea las tablas de usuarios y perfiles
- Configura las políticas RLS (Row Level Security)
- Establece la estructura base de la aplicación

### 2️⃣ **Schema de Grupos** (Segundo)
```sql
supabase_groups_schema.sql
```
- Crea las tablas de grupos (`groups`, `group_members`)
- Define las relaciones entre usuarios y grupos
- Configura las políticas de seguridad para grupos
- Establece roles (admin, member)

### 3️⃣ **Schema de Wishlist** (Tercero)
```sql
supabase_wishlist_schema.sql
```
- Crea las tablas de deseos (`wishes`, `reservations`)
- Define las relaciones entre deseos y usuarios
- Configura las políticas de privacidad de deseos
- Establece el sistema de reservas

### 4️⃣ **Datos de Prueba** (Opcional - Solo desarrollo)
```sql
supabase_seed.sql
```
- Inserta datos de prueba para desarrollo
- Crea usuarios de ejemplo
- Genera grupos de prueba
- Añade deseos de ejemplo

---

## 🚀 Cómo Ejecutar los Scripts

### Opción 1: Desde la UI de Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia y pega el contenido de cada script en orden
5. Haz clic en **Run** para ejecutar

### Opción 2: Desde la CLI de Supabase

```bash
# Si tienes Supabase CLI instalado
supabase db reset

# O ejecutar scripts individuales
psql -h your-db-host -U postgres -d postgres -f database/supabase_setup.sql
psql -h your-db-host -U postgres -d postgres -f database/supabase_groups_schema.sql
psql -h your-db-host -U postgres -d postgres -f database/supabase_wishlist_schema.sql
psql -h your-db-host -U postgres -d postgres -f database/supabase_seed.sql
```

---

## 📝 Descripción de Cada Script

### `supabase_setup.sql`
**Propósito**: Configuración inicial de usuarios y perfiles

**Tablas creadas**:
- `profiles` - Información de perfil de usuario (nombre, avatar)

**Funcionalidades**:
- Trigger automático para crear perfil al registrarse
- Políticas RLS para que usuarios solo vean su propio perfil
- Storage bucket para avatares (opcional)

---

### `supabase_groups_schema.sql`
**Propósito**: Sistema de grupos para compartir listas de deseos

**Tablas creadas**:
- `groups` - Información de grupos (id, nombre, icono, creador)
- `group_members` - Relación muchos-a-muchos entre usuarios y grupos

**Funcionalidades**:
- Códigos únicos de grupo (ej: ABC123)
- Roles de admin/member
- Políticas RLS para privacidad de grupos
- Cascadas automáticas al eliminar grupos

**Ejemplo de uso**:
```sql
-- Ver grupos de un usuario
SELECT g.* FROM groups g
JOIN group_members gm ON g.id = gm.group_id
WHERE gm.user_id = 'user-uuid-here';
```

---

### `supabase_wishlist_schema.sql`
**Propósito**: Sistema de lista de deseos y reservas

**Tablas creadas**:
- `wishes` - Deseos de usuarios (título, descripción, precio, imagen)
- `reservations` - Reservas de regalos por otros usuarios

**Funcionalidades**:
- Privacidad: usuarios no ven quién reservó sus deseos
- Políticas RLS para proteger reservas
- Relación con usuarios y grupos
- Estados de deseos (disponible, reservado)

**Reglas de negocio**:
- Un deseo solo puede ser reservado por una persona
- El dueño del deseo NO puede ver quién lo reservó
- Solo miembros del mismo grupo pueden ver deseos

---

### `supabase_seed.sql`
**Propósito**: Datos de prueba para desarrollo

**Datos incluidos**:
- 5+ usuarios de prueba con credenciales
- 3+ grupos de ejemplo (Familia, Amigos, Trabajo)
- Múltiples deseos de ejemplo
- Algunas reservas de prueba

**⚠️ ADVERTENCIA**: NO ejecutar en producción. Solo para desarrollo local.

**Usuarios de prueba**:
```
Email: maria@test.com | Pass: password123
Email: juan@test.com  | Pass: password123
Email: ana@test.com   | Pass: password123
```

---

## 🔒 Políticas de Seguridad (RLS)

Todos los scripts incluyen políticas de Row Level Security (RLS) para asegurar que:

✅ Usuarios solo ven sus propios datos  
✅ Miembros de grupos solo ven información de su grupo  
✅ Los dueños de deseos NO ven quién reservó sus regalos  
✅ Solo administradores de grupos pueden gestionar miembros  

---

## 🔄 Actualizar la Base de Datos

Si necesitas hacer cambios en la estructura:

1. **NUNCA** modifiques datos en producción directamente
2. Crea un nuevo archivo de migración: `migration_YYYYMMDD.sql`
3. Prueba en desarrollo primero
4. Documenta todos los cambios

---

## 📚 Referencias

- [Documentación de Supabase](https://supabase.com/docs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

## 🆘 Solución de Problemas

### Error: "relation already exists"
La tabla ya existe. Elimina las tablas existentes o usa `DROP TABLE IF EXISTS`.

### Error: "permission denied"
Asegúrate de que las políticas RLS están correctamente configuradas.

### Los datos de seed no aparecen
Verifica que ejecutaste los scripts de schema antes del script de seed.

---

**Última actualización**: 2025-11-28
