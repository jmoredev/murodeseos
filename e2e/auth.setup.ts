import { test as setup, expect } from '@playwright/test'
// IMPORTANTE: Ajusta esta ruta a donde tengas definido tu E2E_CONFIG
import { E2E_CONFIG } from './config'

const authFile = 'playwright/.auth/user.json'

setup('autenticar usuario', async ({ page }) => {
    console.log('🏗️ Iniciando Setup de Autenticación E2E...');

    // 1. Ir al login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')

    // 2. Login (el usuario ya está garantizado por el script de setup)
    await page.fill('input[name="email"]', E2E_CONFIG.user.email)
    await page.fill('input[name="password"]', E2E_CONFIG.user.password)
    await page.click('button[type="submit"]')

    // 3. Esperar redirección a la home
    await page.waitForURL('http://localhost:3000/**', { timeout: 15000 })

    // Verificar que estamos dentro
    await expect(page.getByText('Cerrar sesión').first()).toBeVisible()

    // 4. Guardar el estado (incluyendo lastSeenVersion para evitar el modal)
    await page.evaluate((version) => {
        localStorage.setItem('lastSeenVersion', version);
    }, process.env.npm_package_version || '1.1.0');

    await page.context().storageState({ path: authFile })
    console.log('✅ Autenticación completada y estado guardado.')
})
