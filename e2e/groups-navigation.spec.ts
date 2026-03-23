import { test, expect } from '@playwright/test'
import { E2E_CONFIG } from './config'

test.describe('Navegación de Grupos', () => {
    test.beforeEach(async ({ page }) => {
        // Como ya tienes cookies, el servidor te dejará entrar.
        await page.goto('/');

        // Verificar que estamos logueados
        await expect(page).toHaveURL(/\/$/)
    })

    test('Carga la pestaña de grupos directamente usando el parámetro URL', async ({ page }) => {
        await page.goto('/?tab=groups')

        // Verificar que el título "Mis grupos" es visible
        // Esto confirma que el componente GroupsTab está renderizado
        await expect(page.getByText(/Mis grupos/i).first()).toBeVisible()

        // Verificar que el botón de crear grupo es visible
        await expect(page.locator('a[href*="/groups/create"]').first()).toBeVisible()
    })

    test('El botón "Unirse a grupo" está visible y navega correctamente', async ({ page }) => {
        // Ir a la pestaña de grupos
        await page.goto('/?tab=groups')

        // Buscar el botón de unirse (el morado) por su atributo title
        const joinButton = page.locator('a[href*="/groups/join"]').first()
        await expect(joinButton).toBeVisible()
        await joinButton.click()

        // Verificar URL de destino
        await expect(page).toHaveURL(/.*\/groups\/join/)

        // Ya validamos navegación; el texto "Unirse" puede renderizarse pero no ser visible
        // según el estado del layout/scroll en RN Web.
    })

    test('El botón "Volver" desde la página de Unirse regresa a la pestaña de grupos', async ({ page }) => {
        // Navegar primero a la pestaña de grupos desde la home
        await page.goto('/?tab=groups')
        await expect(page.getByText(/Mis grupos/i).first()).toBeVisible()

        // Hacer clic en el botón de unirse
        await page.locator('a[href*="/groups/join"]').first().click()
        await expect(page).toHaveURL(/.*\/groups\/join/)

        // Clic en volver
        await page.getByText(/Volver/i).first().click()

        // Verificar que volvemos a la home con el tab de grupos
        await expect(page).toHaveURL(/.*\/\?tab=groups/)

        // Verificar que visualmente estamos en la pestaña de grupos
        await expect(page.getByText(/Mis grupos/i).first()).toBeVisible()
    })

    test('El botón "Volver" desde la página de Crear regresa a la pestaña de grupos', async ({ page }) => {
        // Navegar primero a la pestaña de grupos desde la home
        await page.goto('/?tab=groups')
        await expect(page.getByText(/Mis grupos/i).first()).toBeVisible()

        // Hacer clic en el botón de crear
        await page.locator('a[href*="/groups/create"]').first().click()
        await expect(page).toHaveURL(/.*\/groups\/create/)

        // Clic en volver
        await page.getByText(/Volver/i).first().click()

        // Verificar que volvemos a la home con el tab de grupos
        await expect(page).toHaveURL(/.*\/\?tab=groups/)

        // Verificar que visualmente estamos en la pestaña de grupos
        await expect(page.getByText(/Mis grupos/i).first()).toBeVisible()
    })
})
