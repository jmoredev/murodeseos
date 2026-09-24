import { test, expect } from '@playwright/test'

// Le dice a Playwright: "Para este archivo, usa un estado vacío (sin cookies)"
test.use({ storageState: { cookies: [], origins: [] } });


test.describe('Página de Inicio / Redirección de Login', () => {
    test('debería redirigir a la página de login cuando no está autenticado', async ({ page }) => {
        await page.goto('/')

        // En Expo/RN Web, el usuario no autenticado puede quedarse en `/`
        // mostrando CTAs (sin necesariamente cambiar la URL).
        await expect(page.getByText(/Iniciar/i).first()).toBeVisible()
        await expect(page.getByText(/Registr/i).first()).toBeVisible()
    })

    test('debería mostrar los elementos del formulario de login', async ({ page }) => {
        await page.goto('/')

        // El formulario aparece tras pulsar "Iniciar Sesión"
        await page.getByText(/Iniciar/i).first().click()
        await expect(page.getByText(/Bienvenido de nuevo/i)).toBeVisible()

        await expect(page.getByTestId('email-input')).toBeVisible()
        await expect(page.getByTestId('password-input')).toBeVisible()
        await expect(page.getByTestId('login-button')).toBeVisible()
    })

    test('debería navegar al registro desde el login', async ({ page }) => {
        await page.goto('/')

        // En la pantalla inicial se muestra un enlace/botón para registrarse.
        // El texto puede variar entre "Regístrate" y "Registrarse".
        await page.getByText(/registr/i).first().click({ force: true })

        // Verificar que estamos en la página de signup
        await expect(page).toHaveURL(/\/signup/, { timeout: 15000 })
        await expect(page.getByText(/crear una cuenta/i)).toBeVisible({ timeout: 15000 })
    })

    test('debería navegar al login desde el registro', async ({ page }) => {
        await page.goto('/signup')

        // Click en el enlace de login
        const loginLink = page.getByTestId('login-link');
        await loginLink.evaluate((el) => (el as HTMLElement).click());

        await expect(page.getByText(/bienvenido de nuevo/i)).toBeVisible({ timeout: 15000 })
    })
})
