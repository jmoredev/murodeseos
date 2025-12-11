import { test, expect } from '@playwright/test'

// Le dice a Playwright: "Para este archivo, usa un estado vacío (sin cookies)"
test.use({ storageState: { cookies: [], origins: [] } });


test.describe('Página de Inicio / Redirección de Login', () => {
    test('debería redirigir a la página de login cuando no está autenticado', async ({ page }) => {
        await page.goto('/')

        // El middleware redirige automáticamente a /login
        await expect(page).toHaveURL(/\/login/)
        await expect(page.getByRole('heading', { name: /bienvenido de nuevo/i })).toBeVisible()
    })

    test('debería mostrar los elementos del formulario de login', async ({ page }) => {
        await page.goto('/')

        // Verificar que estamos en login
        await expect(page).toHaveURL(/\/login/)

        // Verificar elementos del formulario
        await expect(page.getByLabel(/correo electrónico/i)).toBeVisible()
        await expect(page.getByLabel(/contraseña/i)).toBeVisible()
        await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible()
    })

    test('debería navegar al registro desde el login', async ({ page }) => {
        await page.goto('/')

        // Estamos en login, click en el enlace de registro
        await page.getByRole('link', { name: /regístrate/i }).click()

        // Verificar que estamos en la página de signup
        await expect(page).toHaveURL(/\/signup/)
        await expect(page.getByRole('heading', { name: /crear una cuenta/i })).toBeVisible()
    })

    test('debería navegar al login desde el registro', async ({ page }) => {
        await page.goto('/signup')

        // Click en el enlace de login
        await page.getByRole('link', { name: /inicia sesión/i }).click()

        // Verificar que estamos en la página de login
        await expect(page).toHaveURL(/\/login/)
        await expect(page.getByRole('heading', { name: /bienvenido de nuevo/i })).toBeVisible()
    })
})
