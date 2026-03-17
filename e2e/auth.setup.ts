import { test as setup, expect } from '@playwright/test'
// IMPORTANTE: Ajusta esta ruta a donde tengas definido tu E2E_CONFIG
import { E2E_CONFIG } from './config'
import packageJson from '../package.json'

const authFile = 'playwright/.auth/user.json'

setup('autenticar usuario', async ({ page }) => {
    console.log('🏗️ Iniciando Setup de Autenticación E2E...');

    // 1. Ir al login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // 2. Login (el usuario ya está garantizado por el script de setup)
    await page.getByTestId('email-input').fill(E2E_CONFIG.user.email)
    await page.getByTestId('password-input').fill(E2E_CONFIG.user.password)
    await page.getByTestId('login-button').click()

    // 3. Esperar redirección a la home
    await page.waitForURL('**/', { timeout: 15000 })

    // Verificar que estamos dentro (buscando el botón de salir en desktop o mobile)
    await expect(page.getByText(/salir|cerrar sesión/i).first()).toBeVisible()

    // 4. Guardar el estado (incluyendo lastSeenVersion para evitar el modal)
    await page.evaluate((version) => {
        localStorage.setItem('lastSeenVersion', version);
    }, packageJson.version);

    await page.context().storageState({ path: authFile })
    console.log('✅ Autenticación completada y estado guardado.')
})
