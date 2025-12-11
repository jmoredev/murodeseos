import { test, expect } from '@playwright/test'
import { E2E_CONFIG } from './config'

// Le dice a Playwright: "Para este archivo, usa un estado vacío (sin cookies)"
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Flujo de Inicio de Sesión', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
    })

    test('debería mostrar el formulario de inicio de sesión', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /bienvenido de nuevo/i })).toBeVisible()
        await expect(page.getByLabel(/correo electrónico/i)).toBeVisible()
        await expect(page.getByLabel(/contraseña/i)).toBeVisible()
        await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible()
    })

    test('debería mostrar error de validación para correo inválido', async ({ page }) => {

        
        // Ingresar un email inválido
        await page.getByLabel(/correo electrónico/i).fill('invalid-email')

        // Esto da tiempo a React para actualizar el estado 'email' antes de ejecutar el blur.
        await expect(page.getByLabel(/correo electrónico/i)).toHaveValue('invalid-email')

        // Presionar Tab para mover el foco al siguiente campo
        await page.keyboard.press('Tab')

        // Verificar que aparece el mensaje de error
        await expect(page.getByText(/introduce un correo electrónico válido/i)).toBeVisible()
    })

    test('debería navegar a la página de registro desde el login', async ({ page }) => {
        // Click en el enlace de registro
        await page.getByRole('link', { name: /regístrate/i }).click()

        // Verificar que estamos en la página de signup
        await expect(page).toHaveURL(/\/signup/)
    })

    test('debería mostrar error para credenciales vacías', async ({ page }) => {
        // Intentar hacer login sin credenciales
        await page.getByRole('button', { name: /iniciar sesión/i }).click()

        // Los campos requeridos deben mostrar validación del navegador
        const emailInput = page.getByLabel(/correo electrónico/i)
        await expect(emailInput).toHaveAttribute('required', '')
    })
})
