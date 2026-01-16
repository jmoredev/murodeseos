import { test, expect } from '@playwright/test'
import { E2E_CONFIG } from './config'

//Almacena pares de { ID_del_Test : ID_del_Dato_Creado }
const createdIds = new Map<string, string>();

test.describe('Flujo de Creación de Grupo', () => {
    test.setTimeout(60000)
    test.beforeEach(async ({ page }) => {
        // Como ya tienes cookies, el servidor te dejará entrar.
        await page.goto('http://localhost:3000/');

        // Verificar que estamos logueados
        await expect(page).toHaveURL('http://localhost:3000/')
        // Verificar que aparece el botón de cerrar sesión para confirmar que el usuario está autenticado
        await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    })

    test.afterEach(async ({ request }, testInfo) => {
        // RECUPERAR: Buscamos si ESTE test específico (identificado por testInfo.testId) guardó algo
        const idToDelete = createdIds.get(testInfo.testId);

        if (idToDelete) {
            console.log(`🧹 [Limpieza] Test "${testInfo.title}" borrando ID: ${idToDelete}`);

            // Llamada a la API para borrar
            const response = await request.delete(`http://localhost:3000/api/groups/${idToDelete}`);

            // --- BLOQUE DE DEPURACIÓN ---
            if (!response.ok()) {
                console.log(`🔴 ERROR AL BORRAR: Status ${response.status()}`);
                console.log(`🔴 Respuesta del servidor: ${await response.text()}`);
            }
            // -----------------------------

            // Verificamos que se borró bien (opcional pero recomendado)
            // En local, si ya se borró manualmente o por otro test, no fallamos
            if (!response.ok() && response.status() !== 404) {
                console.error(`🔴 Error al borrar grupo ${idToDelete}: ${response.status()}`);
            }

            // LIMPIAR EL MAPA: Borramos la entrada para no ocupar memoria
            createdIds.delete(testInfo.testId);
        }
    });

    test('Un usuario puede crear un grupo exitosamente y volver al inicio', async ({ page }, testInfo) => {
        // 1. Verificar que estamos en la Home y navegar a la pestaña de grupos
        await expect(page).toHaveURL('http://localhost:3000/')
        await page.goto('http://localhost:3000/?tab=groups')

        // Esperar a que se cargue la pestaña de grupos
        await expect(page.getByRole('heading', { name: 'Mis grupos' })).toBeVisible()

        // 2. Hacer clic en el botón "Crear Grupo"
        const createGroupButton = page.locator('a[title="Crear grupo"], a[href*="/groups/create"], button:has-text("Crear Grupo"), a:has-text("Crear Nuevo Grupo")')
        await expect(createGroupButton.first()).toBeVisible({ timeout: 10000 })
        await createGroupButton.first().click()

        // 3. Verificar que estamos en la página de creación de grupo
        await expect(page).toHaveURL(/\/groups\/create/)
        await expect(page.locator('h1')).toContainText(/Crear.*Grupo/i)

        // 4. Rellenar el formulario
        const groupName = `Test Grupo ${Date.now()}`
        const groupNameInput = page.locator('input#groupName, input[name="groupName"], input[placeholder*="Grupo"]')
        await expect(groupNameInput).toBeVisible()
        await groupNameInput.fill(groupName)

        // 5. Seleccionar un icono (opcional)
        const emojiButtons = page.locator('button:has-text("🎉")')
        if (await emojiButtons.count() > 0) {
            await emojiButtons.first().click()
        }

        // 6. Enviar el formulario
        const submitButton = page.locator('button[type="submit"]:has-text("Crear"), button:has-text("Crear y Compartir")')
        await expect(submitButton).toBeVisible()
        await submitButton.click()

        // Interceptar respuesta para sacar el ID
        const response = await page.waitForResponse(r => r.request().method() === 'POST' && r.status() === 201);
        const body = await response.json();

        // GUARDAR: Asociamos el ID del nuevo cliente al ID único de ESTE test
        console.log(`📝 Test "${testInfo.title}" creó el ID: ${body.id}`);
        createdIds.set(testInfo.testId, body.id);

        // 7. Verificar pantalla de éxito (NO hay redirección automática)
        const successMessage = page.locator('text=¡Grupo creado!')
        await expect(successMessage).toBeVisible({ timeout: 10000 })

        // Verificar que aparece el código del grupo
        const groupCodeElement = page.locator('text=/[A-Z0-9]{6,8}/') // Ajustar regex si el ID tiene otro formato
        await expect(groupCodeElement).toBeVisible()


        // 8. Hacer clic en "Continuar al inicio"
        const continueButton = page.locator('button:has-text("Continuar al inicio")')
        await expect(continueButton).toBeVisible()
        await continueButton.click()

        // 9. Verificar redirección a la home
        await page.waitForURL('http://localhost:3000/', { timeout: 10000 })

        // 10. Ir a la pestaña de grupos para verificar que el grupo aparece
        // 10. Ir a la pestaña de grupos para verificar que el grupo aparece
        // Usamos click en la UI en lugar de recarga para asegurar que la SPA maneje el estado correctamente
        // y evitar problemas de caché en WebKit/Mobile Safari con page.goto
        const groupsTabButton = page.getByRole('button', { name: /Mis grupos|Grupos/i }).first()
        await expect(groupsTabButton).toBeVisible()
        await groupsTabButton.click()

        await expect(page.getByRole('heading', { name: 'Mis grupos' })).toBeVisible()

        const groupCard = page.locator(`text="${groupName}"`)
        await expect(groupCard).toBeVisible({ timeout: 10000 })
    })

    test('El formulario de creación valida el nombre mínimo', async ({ page }) => {
        // Verificar que aparece el botón de cerrar sesión para confirmar que el usuario está autenticado
        await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();

        await page.goto('http://localhost:3000/groups/create')

        const groupNameInput = page.locator('input#groupName, input[name="groupName"]')
        await groupNameInput.fill('AB')

        const submitButton = page.locator('button[type="submit"]')

        // Verificar si está deshabilitado o si al hacer clic no navega
        const isDisabled = await submitButton.isDisabled()

        if (!isDisabled) {
            await submitButton.click()
            await page.waitForTimeout(1000)
            await expect(page).toHaveURL(/\/groups\/create/)
        } else {
            expect(isDisabled).toBe(true)
        }

        await groupNameInput.fill('Grupo Válido')
        await expect(submitButton).toBeEnabled({ timeout: 2000 })
    })

    test('Permite seleccionar diferentes iconos para el grupo', async ({ page }) => {
        // Verificar que aparece el botón de cerrar sesión para confirmar que el usuario está autenticado
        await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();

        await page.goto('http://localhost:3000/groups/create')

        const emojiButtons = page.locator('button:has-text("🎁"), button:has-text("🎉")')
        await expect(emojiButtons.first()).toBeVisible()

        const emojiCount = await emojiButtons.count()
        if (emojiCount > 1) {
            const secondEmoji = emojiButtons.nth(1)
            await secondEmoji.click()
            await expect(secondEmoji).toHaveClass(/border-deseo-acento|bg-deseo-acento|scale-110/)
        }
    })
})
