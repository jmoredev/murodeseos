import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { E2E_CONFIG } from './config'

// Cliente Supabase para operaciones de "backdoor" (limpieza de DB, etc)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Mapa para limpieza
const createdGroupIds = new Set<string>()

test.describe('Unirse a Grupo', () => {
    test.beforeEach(async ({ page }) => {
        // Navegar a home y verificar login
        await page.goto('/')
        await expect(page).toHaveURL('/')
        await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
    })

    test.afterEach(async () => {
        // Limpieza de grupos creados
        if (createdGroupIds.size > 0) {
            // Necesitamos estar autenticados para borrar
            const { data: { session } } = await supabase.auth.signInWithPassword({
                email: E2E_CONFIG.user.email,
                password: E2E_CONFIG.user.password,
            })

            for (const groupId of createdGroupIds) {
                console.log(`🧹 Limpiando grupo ${groupId}...`)
                await supabase.from('groups').delete().eq('id', groupId)
            }
            createdGroupIds.clear()
        }
    })

    test('debería unirse a un grupo exitosamente tras haber salido', async ({ page }) => {
        // 1. Crear un grupo primero (para tener un código válido)
        await page.goto('/groups/create')
        const groupName = `Join Test ${Date.now()}`
        const groupNameInput = page.locator('input#groupName, input[name="groupName"], input[placeholder*="Grupo"]')
        await expect(groupNameInput).toBeVisible()
        await groupNameInput.fill(groupName)
        await page.click('button[type="submit"]')

        // Esperar confirmación y obtener código
        await expect(page.locator('text=¡Grupo creado!')).toBeVisible()
        const codeElement = page.locator('text=/[A-Z0-9]{6,8}/')
        await expect(codeElement).toBeVisible()
        const groupCode = await codeElement.textContent()

        // Obtener ID del grupo recién creado (para limpieza)
        // Lo podemos sacar interceptando la llamada o consultando DB.
        // Aquí interceptaremos la respuesta de creación es más rápido
        // Nota: Si ya pasó la request, es tarde. Mejor interceptar antes del click.
        // Pero ya hicimos click.
        // Alternativa: consultar por nombre

        // Autenticar cliente supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: E2E_CONFIG.user.email,
            password: E2E_CONFIG.user.password,
        })
        if (authError || !authData.user) throw new Error('Falló login de test en backdoor')

        const userId = authData.user.id

        // Buscar el grupo por nombre para obtener su ID real
        const { data: groupData } = await supabase
            .from('groups')
            .select('id')
            .eq('name', groupName)
            .single()

        if (!groupData) throw new Error('No se encontró el grupo creado')
        createdGroupIds.add(groupData.id)

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
        await expect(page.getByRole('heading', { name: 'Unirse a un grupo' })).toBeVisible()

        // 4. Ingresar el código
        await page.locator('input#groupCode').pressSequentially(groupCode!.trim(), { delay: 100 })

        // Esperar a que React actualice el estado y habilite el botón
        const joinButton = page.locator('button:has-text("Unirme")')
        await expect(joinButton).toBeEnabled()
        await joinButton.click()

        // 5. Verificar éxito
        await expect(page.getByText(`¡Te has unido a "${groupName}" exitosamente!`)).toBeVisible()

        // Verificar redirección
        await page.waitForURL('/')

        // Verificar que aparece en la lista
        await page.click('button:has-text("Mis grupos"), button:has-text("Grupos")')
        await expect(page.getByText(groupName)).toBeVisible()
    })

    test('debería mostrar mensaje si ya es miembro', async ({ page }) => {
        // 1. Crear grupo
        await page.goto('/groups/create')
        const groupName = `Already Member ${Date.now()}`
        const groupNameInput = page.locator('input#groupName, input[name="groupName"], input[placeholder*="Grupo"]')
        await expect(groupNameInput).toBeVisible()
        await groupNameInput.fill(groupName)
        await page.click('button[type="submit"]')

        // Obtener código
        const codeElement = page.locator('text=/[A-Z0-9]{6,8}/')
        await expect(codeElement).toBeVisible()
        const groupCode = await codeElement.textContent()

        // (Registrar para limpieza)
        const { data: { session } } = await supabase.auth.signInWithPassword({
            email: E2E_CONFIG.user.email,
            password: E2E_CONFIG.user.password,
        })
        const { data: groupData } = await supabase.from('groups').select('id').eq('name', groupName).single()
        if (groupData) createdGroupIds.add(groupData.id)

        // 2. Ir a Join e intentar unirse con el mismo código
        await page.goto('/groups/join')
        await expect(page.getByRole('heading', { name: 'Unirse a un grupo' })).toBeVisible()

        await page.locator('input#groupCode').pressSequentially(groupCode!.trim(), { delay: 100 })

        // Esperar e intentar click
        const joinButton = page.locator('button:has-text("Unirme")')
        await expect(joinButton).toBeEnabled()
        await joinButton.click()

        // 3. Verificar mensaje
        await expect(page.getByText(`Ya eres miembro de "${groupName}"`)).toBeVisible()
    })

    test('debería mostrar error con código inexistente', async ({ page }) => {
        await page.goto('/groups/join')
        // Usar código de 6 chars para cumplir validación
        await page.locator('input#groupCode').pressSequentially('INV999', { delay: 100 })

        const joinButton = page.locator('button:has-text("Unirme")')
        await expect(joinButton).toBeEnabled()
        await joinButton.click()

        await expect(page.getByText('Código incorrecto o grupo no encontrado')).toBeVisible()
    })

    test('debería volver a mis grupos al hacer click en volver', async ({ page }) => {
        await page.goto('/?tab=groups')
        await page.goto('/groups/join')

        await page.click('button:has-text("Volver")')

        // Verificar URL contiene tab=groups o simplemente estamos en home viendo grupos
        await expect(page).toHaveURL(/tab=groups/)
        await expect(page.getByRole('heading', { name: 'Mis grupos' })).toBeVisible()
    })
})
