# Usuario E2E para Tests Automáticos

## 📋 Información General

Se ha creado un usuario dedicado para tests end-to-end (E2E) con datos predecibles y aislados de los usuarios de prueba manual.

## 🤖 Credenciales del Usuario E2E

```typescript
Email: e2e-test@test.com
Password: E2ETest123!
Display Name: E2E Test User
Avatar: 🤖
```

## 🎯 Datos Asociados

### Grupo E2E
- **ID**: `E2E001`
- **Nombre**: `E2E Test Group`
- **Icono**: 🧪
- **Miembros**: Solo el usuario E2E (admin)

### Wishlist Items (Predecibles)

El usuario E2E siempre tiene exactamente **3 items** en su wishlist:

1. **E2E Test Item 1**
   - Precio: €100.00
   - Prioridad: Alta
   - Estado: Sin reservar

2. **E2E Test Item 2**
   - Precio: €50.00
   - Prioridad: Media
   - Estado: Sin reservar

3. **E2E Test Item 3**
   - Precio: €25.00
   - Prioridad: Baja
   - Estado: Sin reservar

## 🔧 Scripts Disponibles

### Crear Usuario E2E (incluido en seed completo)
```bash
npx tsx scripts/seed-complete-database.ts
```

### Resetear Solo Usuario E2E
```bash
npx tsx scripts/reset-e2e-user.ts
```

Este script:
- ✅ Elimina todos los wishlist items del usuario E2E
- ✅ Elimina miembros adicionales del grupo E2E
- ✅ Recrea los 3 items predecibles
- ❌ NO afecta a los usuarios de prueba manual

## 📝 Uso en Tests

### Importar Configuración

```typescript
import { E2E_CONFIG } from '../e2e/config'

// Usar credenciales
await page.fill('input[name="email"]', E2E_CONFIG.user.email)
await page.fill('input[name="password"]', E2E_CONFIG.user.password)

// Verificar datos
expect(groupName).toBe(E2E_CONFIG.group.name)
expect(items).toHaveLength(E2E_CONFIG.wishlistItems.length)
```

### Ejemplo de Test

```typescript
import { test, expect } from '@playwright/test'
import { E2E_CONFIG } from '../e2e/config'

test.describe('Mi Test Suite', () => {
    test.beforeEach(async ({ page }) => {
        // Login con usuario E2E
        await page.goto('/login')
        await page.fill('input[name="email"]', E2E_CONFIG.user.email)
        await page.fill('input[name="password"]', E2E_CONFIG.user.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('/')
    })

    test('debería mostrar los items del usuario E2E', async ({ page }) => {
        // Los datos son predecibles
        await expect(page.locator('text=E2E Test Item 1')).toBeVisible()
        await expect(page.locator('text=E2E Test Item 2')).toBeVisible()
        await expect(page.locator('text=E2E Test Item 3')).toBeVisible()
    })
})
```

## ✅ Ventajas

1. **Aislamiento**: Los tests no afectan ni son afectados por datos de prueba manual
2. **Predecibilidad**: Siempre sabes qué datos esperar
3. **Limpieza Rápida**: Resetear solo el usuario E2E es más rápido que resetear toda la BD
4. **Debugging**: Más fácil identificar problemas cuando los datos son consistentes
5. **Paralelización**: Múltiples tests pueden usar el mismo usuario sin conflictos

## ⚠️ Notas Importantes

- **NO uses este usuario para pruebas manuales**: Está diseñado para tests automáticos
- **Resetea antes de cada suite de tests**: Para garantizar un estado limpio
- **Los items nunca están reservados**: Facilita tests de reserva/liberación
- **El grupo solo tiene 1 miembro**: Facilita tests de invitación/membresía

## 🔄 Workflow Recomendado

### En CI/CD
```bash
# 1. Seed completo antes de todos los tests
npx tsx scripts/seed-complete-database.ts

# 2. Ejecutar tests
npm run test:e2e

# 3. (Opcional) Limpiar después
npx tsx scripts/reset-e2e-user.ts
```

### En Desarrollo Local
```bash
# Resetear solo el usuario E2E entre ejecuciones de tests
npx tsx scripts/reset-e2e-user.ts
npm run test:e2e
```

## 📊 Comparación: Usuario E2E vs Usuarios de Prueba

| Característica | Usuario E2E | Usuarios de Prueba |
|----------------|-------------|-------------------|
| **Propósito** | Tests automáticos | Pruebas manuales |
| **Datos** | Predecibles y fijos | Aleatorios |
| **Grupos** | 1 grupo (solo admin) | Múltiples grupos con varios miembros |
| **Wishlist** | 3 items fijos | 2-4 items aleatorios |
| **Reservas** | Nunca reservados | 30% probabilidad de reserva |
| **Modificable** | Solo por tests | Sí, manualmente |
| **Reset** | Script dedicado | Seed completo |
