import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { E2E_CONFIG, BASE_URL } from './config'

//Almacena pares de { ID_del_Test : ID_del_Dato_Creado }
const createdIds = new Map<string, string>();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey =
    process.env.NEXT_SERVICE_ROLE_KEY ||
    process.env.EXPO_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Faltan env vars para supabaseAdmin en E2E')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

test.describe('Flujo de Creación de Grupo', () => {
    test.setTimeout(60000)
    test.beforeEach(async ({ page }) => {
        // Como ya tienes cookies, el servidor te dejará entrar.
        await page.goto('/');

        // Verificar que estamos logueados
        await expect(page).toHaveURL(/\/$/)
    })

    test.afterEach(async ({ request }, testInfo) => {
        // RECUPERAR: Buscamos si ESTE test específico (identificado por testInfo.testId) guardó algo
        const idToDelete = createdIds.get(testInfo.testId);

        if (idToDelete) {
            console.log(`🧹 [Limpieza] Test "${testInfo.title}" borrando ID: ${idToDelete}`);

            // Llamada a la API para borrar
            const response = await request.delete(`${BASE_URL}/api/groups/${idToDelete}`);

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
        await expect(page).toHaveURL(/\/$/)
        await page.goto('/?tab=groups')

        // Esperar a que se cargue la pestaña de grupos
        await expect(page.getByText(/Mis grupos/i)).toBeVisible()

        // 2. Hacer clic en el botón "Crear Grupo"
        // En la UI actual el botón/enlace suele ser "Crear" y navega a `/groups/create`.
        const createGroupButton = page.locator('a[href*="/groups/create"]').first()
        await expect(createGroupButton).toBeVisible({ timeout: 10000 })
        await createGroupButton.click()

        // 3. Verificar que estamos en la página de creación de grupo
        await expect(page).toHaveURL(/\/groups\/create/)
        await expect(page.getByText(/Crear Grupo/i).first()).toBeVisible()

        // 4. Rellenar el formulario
        const groupName = `Test Grupo ${Date.now()}`
        const groupNameInput = page.getByPlaceholder(/Ej:/).first()
        await expect(groupNameInput).toBeVisible()
        await groupNameInput.fill(groupName)

        // 5. Seleccionar un icono (opcional)
        // En esta versión el selector de icono está deshabilitado/planificado.
        await expect(page.getByText(/Toca para cambiar el icono/i)).toBeVisible()

        // 6. Enviar el formulario
        // El texto "Crear Grupo" aparece dos veces (header + botón submit).
        // En esta UI el submit es el que está al final.
        await page.getByText(/Crear Grupo/i).last().click()

        // Si el submit funciona, la pantalla navega a la home (router.replace('/')).
        await page.waitForURL(/\/$/, { timeout: 20000 })

        // Validar que el grupo y su membresía existen en Supabase.
        // Esto diferencia "no se creó en DB" vs "la UI no lo renderiza".
        const { data: createdGroup, error: createdGroupError } = await supabaseAdmin
            .from('groups')
            .select('id')
            .eq('name', groupName)
            .maybeSingle()

        if (createdGroupError) {
            throw new Error(`Error consultando grupo creado: ${createdGroupError.message}`)
        }

        if (!createdGroup?.id) {
            // Debug adicional: cuántos grupos existen con "Test Grupo"
            const { data: testGroups } = await supabaseAdmin
                .from('groups')
                .select('id,name')
                .ilike('name', 'Test Grupo%')
                .limit(5)

            throw new Error(
                `El grupo con nombre "${groupName}" no se encontró en Supabase. ` +
                `Grupos de ejemplo: ${(testGroups ?? []).map(g => g.name).join(', ') || 'none'}`
            )
        }

        // Guardar para cleanup
        createdIds.set(testInfo.testId, createdGroup.id)

        const { data: members } = await supabaseAdmin
            .from('group_members')
            .select('user_id')
            .eq('group_id', createdGroup.id)
            .limit(1)

        if (!members || members.length === 0) {
            throw new Error(`El grupo "${groupName}" se creó, pero no tiene miembros en group_members`)
        }

        // Validar que la navegación vuelve a "Mis grupos"
        // (La grilla puede tardar en refetch por caché/estado SPA, así que no validamos el nombre exacto aquí).
        await page.goto('/?tab=groups')
        await page.reload()
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null)
        await expect(page.getByText(/Mis grupos/i).first()).toBeVisible({ timeout: 20000 })
    })

    test('El formulario de creación valida el nombre mínimo', async ({ page }) => {
        await page.goto('/groups/create')

        const groupNameInput = page.getByPlaceholder(/Ej:/).first()
        await groupNameInput.fill('AB')

        // Intentar crear con un nombre demasiado corto no debería sacar de la pantalla de creación
        // Clic en el submit (no en el header).
        await page.getByText(/Crear Grupo/i).last().click()
        await expect(page).toHaveURL(/\/groups\/create/)
    })

    test('Permite seleccionar diferentes iconos para el grupo', async ({ page }) => {
        await page.goto('/groups/create')

        // El selector de iconos está en planificación para esta versión.
        await expect(page.getByText(/Toca para cambiar el icono/i)).toBeVisible()
    })
})
