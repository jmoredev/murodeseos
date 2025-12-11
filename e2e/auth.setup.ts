import { test as setup, expect } from '@playwright/test'
// IMPORTANTE: Ajusta esta ruta a donde tengas definido tu E2E_CONFIG
import { E2E_CONFIG } from './config'

const authFile = 'playwright/.auth/user.json'

setup('autenticar usuario', async ({ page }) => {
    console.log('🏗️ Iniciando Setup de Autenticación Global...');

    // 1. Ir al login
    await page.goto('http://localhost:3000/login')

    // Esperar a que la red se calme para evitar problemas de hidratación
    await page.waitForLoadState('networkidle')

    // 2. Rellenar usando tus variables E2E_CONFIG
    // Usamos los mismos selectores que tenías en tu test anterior
    await page.fill('input[name="email"]', E2E_CONFIG.user.email)

    // Verificación de seguridad (anti-borrado de React)
    await expect(page.locator('input[name="email"]')).toHaveValue(E2E_CONFIG.user.email)

    await page.fill('input[name="password"]', E2E_CONFIG.user.password)

    // 3. Login
    await page.click('button[type="submit"]')

    // 4. Esperar redirección y confirmación
    // Esto es vital: esperar a que las cookies se fijen antes de guardar
    await page.waitForURL('http://localhost:3000/')
    await expect(page.getByText('Cerrar sesión').first()).toBeVisible()

    // 5. Guardar el estado (incluyendo lastSeenVersion para evitar el modal)
    await page.evaluate((version) => {
        localStorage.setItem('lastSeenVersion', version);
    }, process.env.npm_package_version || '0.1.0');

    await page.context().storageState({ path: authFile })
    console.log('✅ Estado de autenticación guardado correctamente.')
})