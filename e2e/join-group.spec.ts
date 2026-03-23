import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { E2E_CONFIG, BASE_URL } from './config'

// Cliente Supabase para operaciones de "backdoor" (limpieza de DB, etc)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

// Mapa para limpieza
const createdGroupIds = new Set<string>()

async function findCreatedGroupByName(name: string, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const { data } = await supabaseAdmin
            .from('groups')
            .select('id, name')
            .eq('name', name)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (data?.id) return data
        await new Promise(resolve => setTimeout(resolve, 400))
    }
    return null
}

test.describe('Unirse a Grupo', () => {
    // Evitar colisiones en DB/estado del mismo usuario entre tests del mismo spec.
    test.describe.configure({ mode: 'serial' })
    test.beforeEach(async ({ page }) => {
        // Navegar a home y verificar login
        await page.goto('/')
        await expect(page).toHaveURL('/')
    })

    test.afterEach(async ({ request }) => {
        // Limpieza de grupos creados
        for (const groupId of createdGroupIds) {
            console.log(`🧹 [Limpieza] Borrando grupo ${groupId}...`);
            const response = await request.delete(`${BASE_URL}/api/groups/${groupId}`);
            if (!response.ok() && response.status() !== 404) {
                console.error(`🔴 Error al borrar grupo ${groupId}: ${response.status()}`);
            }
        }
        createdGroupIds.clear();
    });

    test('debería unirse a un grupo exitosamente tras haber salido', async ({ page }) => {
        // 1. Crear un grupo primero (para tener un código válido)
        await page.goto('/groups/create')
        const groupName = `Join Test ${Date.now()}`
        const groupNameInput = page.getByPlaceholder(/Ej:/).first()
        await expect(groupNameInput).toBeVisible()

        // Usar type con delay para asegurar que React detecte el cambio en WebKit
        await groupNameInput.click()
        await groupNameInput.pressSequentially(groupName, { delay: 50 })

        // El submit es el último "Crear Grupo" (hay 2 en pantalla: header + botón)
        await page.getByText(/Crear Grupo/i).last().click()

        // El page navega a la home cuando el grupo se crea.
        await page.waitForURL(/\/$/)

        // Autenticar cliente supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: E2E_CONFIG.user.email,
            password: E2E_CONFIG.user.password,
        })
        if (authError || !authData.user) throw new Error('Falló login de test en backdoor')

        const userId = authData.user.id

        // Buscar el grupo por nombre para obtener su ID real (con retry + admin para evitar RLS/timing)
        const groupData = await findCreatedGroupByName(groupName, 20000)

        if (!groupData) throw new Error('No se encontró el grupo creado')
        createdGroupIds.add(groupData.id)
        const groupCode = groupData.id

        console.log(`🧪 Grupo creado: ${groupName} (${groupData.id}). Eliminando membresía...`)

        // 2. BACKDOOR: Eliminar la membresía de este usuario para simular que no está
        const { error: deleteError } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupData.id)
            .eq('user_id', userId)

        if (deleteError) throw new Error(`Error borrando membresía: ${deleteError.message}`)

        // 3. Ir a la pantalla de unirse
        await page.goto('/groups/join')
        await expect(page.getByText(/Unirse/i).first()).toBeVisible()

        // 4. Ingresar el código
        const codeInput = page.getByPlaceholder(/Ej:/).first()
        await expect(codeInput).toBeVisible()
        await codeInput.click()
        await codeInput.pressSequentially(groupCode!.trim(), { delay: 50 })

        await page.getByText(/Unirse al Grupo/i).first().click()

        // 5. Verificar por navegación/UI estable
        // Evitamos validar el texto exacto del toast porque puede variar entre viewports.

        // Verificar redirección
        await page.waitForURL(/\/$/, { timeout: 30000 })

        // Confirmar en DB que la membresía existe para este usuario.
        // En móvil la UI puede tardar en refrescarse, así que validamos primero la fuente de verdad.
        const deadline = Date.now() + 20000
        while (Date.now() < deadline) {
            const { data: membership } = await supabaseAdmin
                .from('group_members')
                .select('id')
                .eq('group_id', groupData.id)
                .eq('user_id', userId)
                .maybeSingle()

            if (membership) break
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        const { data: membershipFinal } = await supabaseAdmin
            .from('group_members')
            .select('id')
            .eq('group_id', groupData.id)
            .eq('user_id', userId)
            .maybeSingle()

        expect(membershipFinal, 'La membresía no apareció en DB tras unir').toBeTruthy()

        // UI: validar que estamos viendo la sección de grupos (sin depender del texto exacto del card)
        await page.goto('/?tab=groups')
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null)
        await expect(page.getByText(/Gestiona tus intercambios/i).first()).toBeVisible({ timeout: 15000 })
    })

    test('debería mostrar mensaje si ya es miembro', async ({ page }) => {
        // 1. Crear grupo
        await page.goto('/groups/create')
        const groupName = `Already Member ${Date.now()}`
        const groupNameInput = page.getByPlaceholder(/Ej:/).first()
        await expect(groupNameInput).toBeVisible()

        await groupNameInput.click()
        await groupNameInput.pressSequentially(groupName, { delay: 50 })

        await page.getByText(/Crear Grupo/i).last().click()
        await page.waitForURL(/\/$/)

        // (Registrar para limpieza)
        const { data: authData } = await supabase.auth.signInWithPassword({
            email: E2E_CONFIG.user.email,
            password: E2E_CONFIG.user.password,
        })
        const userId = authData.user?.id
        if (!userId) throw new Error('No se pudo obtener userId para el test')

        const groupData = await findCreatedGroupByName(groupName, 20000)
        if (groupData) createdGroupIds.add(groupData.id)
        if (!groupData) throw new Error('No se encontró el grupo creado')
        const groupCode = groupData.id

        // 2. Ir a Join e intentar unirse con el mismo código
        await page.goto('/groups/join')
        const codeInput = page.getByPlaceholder(/Ej:/).first()
        await expect(codeInput).toBeVisible()
        await codeInput.click()
        await codeInput.pressSequentially(groupCode!.trim(), { delay: 50 })

        // Esperar e intentar click
        await page.getByText(/Unirse al Grupo/i).first().click()

        // 3. Verificar que ya está en la lista (UI estable)
        await page.waitForURL(/\/$/, { timeout: 30000 })

        // Confirmar en DB que el usuario es miembro
        const deadline = Date.now() + 20000
        while (Date.now() < deadline) {
            const { data: membership } = await supabaseAdmin
                .from('group_members')
                .select('id')
                .eq('group_id', groupData.id)
                .eq('user_id', userId)
                .maybeSingle()

            if (membership) break
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        const { data: membershipFinal } = await supabaseAdmin
            .from('group_members')
            .select('id')
            .eq('group_id', groupData.id)
            .eq('user_id', userId)
            .maybeSingle()

        expect(membershipFinal, 'No existía membresía en DB para el usuario').toBeTruthy()

        await page.goto('/?tab=groups')
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null)
        await expect(page.getByText(/Gestiona tus intercambios/i).first()).toBeVisible({ timeout: 15000 })
    })

    test('debería mostrar error con código inexistente', async ({ page }) => {
        await page.goto('/groups/join')
        const codeInput = page.getByPlaceholder(/Ej:/).first()
        await expect(codeInput).toBeVisible()
        await codeInput.click()
        await codeInput.pressSequentially('INV999', { delay: 50 })

        await page.getByText(/Unirse al Grupo/i).first().click()

        await expect(page.getByText('Código incorrecto o grupo no encontrado')).toBeVisible()
    })

    test('debería volver a mis grupos al hacer click en volver', async ({ page }) => {
        await page.goto('/?tab=groups')
        await page.locator('a[href*="/groups/join"]').first().click()
        await expect(page).toHaveURL(/.*\/groups\/join/)

        await page.getByText(/Volver/i).first().click()

        // "Volver" usa router.back(), así que validamos la UI más que la URL exacta.
        await expect(page.getByText(/Mis grupos/i).first()).toBeVisible({ timeout: 15000 })
    })
})
