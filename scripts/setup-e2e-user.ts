/**
 * Script para configurar el usuario de test E2E de forma programática.
 * Borra el usuario si existe y lo recrea con su perfil completo.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { E2E_CONFIG } from '../e2e/config'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SERVICE_ROLE_KEY || process.env.EXPO_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan variables de entorno (URL o SERVICE_ROLE_KEY)')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function waitForSupabaseAdminAuthReady(options?: { timeoutMs?: number, intervalMs?: number }) {
    const timeoutMs = options?.timeoutMs ?? 30000
    const intervalMs = options?.intervalMs ?? 1000
    const startedAt = Date.now()

    // Supabase local a veces tarda unos segundos en levantar el endpoint de admin auth.
    // Este "wait" evita fallos intermitentes de `ConnectionRefused`.
    // Usamos listUsers como "probe" porque falla exactamente si admin auth no está listo.
    while (Date.now() - startedAt < timeoutMs) {
        try {
            await supabase.auth.admin.listUsers({ page: 0, perPage: 1 })
            return
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.log(`⏳ Esperando Supabase admin auth... (${message})`)
            await new Promise(resolve => setTimeout(resolve, intervalMs))
        }
    }

    throw new Error(`Supabase admin auth no disponible tras ${timeoutMs}ms`)
}

async function setupE2EUser() {
    console.log('🧪 Verificando configuración E2E...')

    const { user: mainUser, secondaryUser, group: testGroup } = E2E_CONFIG

    await waitForSupabaseAdminAuthReady()

    // --- Helper para crear/verificar usuarios ---
    async function upsertUser(userConfig: typeof mainUser) {
        console.log(`👤 Verificando usuario: ${userConfig.email}...`)

        // 1. Verificar si existe
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) throw new Error(`Error listando usuarios: ${listError.message}`)

        let userId: string
        const existingUser = users.find(u => u.email === userConfig.email)

        if (existingUser) {
            // Actualizar contraseña si existe
            console.log(`   ✨ Usuario existente. Actualizando contraseña...`)
            const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
                password: userConfig.password,
                user_metadata: { display_name: userConfig.displayName, avatar_url: userConfig.avatar }
            })
            if (updateError) throw new Error(`Error actualizando password de ${userConfig.email}: ${updateError.message}`)
            userId = existingUser.id
        } else {
            // Crear usuario
            console.log(`   ➕ Creando nuevo usuario...`)
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: userConfig.email,
                password: userConfig.password,
                email_confirm: true,
                user_metadata: {
                    display_name: userConfig.displayName,
                    avatar_url: userConfig.avatar
                }
            })

            if (createError || !newUser.user) throw new Error(`Error creando usuario ${userConfig.email}: ${createError?.message}`)
            userId = newUser.user.id
            // Esperar un poco más para asegurar que los triggers terminen y no sobreescriban nuestro upsert
            await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // Asegurar perfil de forma robusta
        console.log(`   📝 Asegurando perfil de forma limpia para ${userConfig.email}...`)

        // Borramos por si acaso hay un trigger que creó algo incompleto
        await supabase.from('profiles').delete().eq('id', userId)

        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                display_name: userConfig.displayName,
                avatar_url: userConfig.avatar,
                shirt_size: 'L',
                pants_size: '42',
                favorite_color: 'Gris',
                updated_at: new Date().toISOString()
            })

        if (profileError) throw new Error(`Error insertando perfil de ${userConfig.email}: ${profileError.message}`)

        // Verificación inmediata
        const { data: verify, error: verifyError } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', userId)
            .single()

        if (verifyError || !verify?.display_name) {
            throw new Error(`Fallo la verificación del perfil para ${userConfig.email}`)
        }
        console.log(`      ✅ Perfil verificado para ${userConfig.email}: ${verify.display_name}`)

        return userId
    }

    try {
        // 1. Crear Usuarios
        const mainUserId = await upsertUser(mainUser)
        const secondaryUserId = await upsertUser(secondaryUser)

        // 2. Crear Grupo
        console.log(`🎯 Verificando grupo: ${testGroup.name}...`)
        const { data: existingGroup, error: groupCheckError } = await supabase
            .from('groups')
            .select('id')
            .eq('id', testGroup.id)
            .single()

        // Ignoramos error de "row not found", cualquier otro es real
        if (groupCheckError && groupCheckError.code !== 'PGRST116') {
            throw new Error(`Error buscando grupo: ${groupCheckError.message}`)
        }

        if (!existingGroup) {
            console.log(`   ➕ Creando grupo...`)
            const { error: createGroupError } = await supabase.from('groups').insert({
                id: testGroup.id,
                name: testGroup.name,
                icon: testGroup.icon,
                creator_id: mainUserId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            if (createGroupError) throw new Error(`Error creando grupo: ${createGroupError.message}`)
        } else {
            console.log(`   ✨ Grupo ya existe.`)
        }

        // 3. Gestionar Membresías
        console.log(`👫 Limpiando y verificando membresías...`)

        // LIMPIEZA TOTAL: Borrar todas las membresías de estos dos usuarios para evitar interferencias entre tests
        const { error: deleteMembershipsError } = await supabase
            .from('group_members')
            .delete()
            .or(`user_id.eq.${mainUserId},user_id.eq.${secondaryUserId}`)

        if (deleteMembershipsError) throw new Error(`Error limpiando membresías globales: ${deleteMembershipsError.message}`)

        // LIMPIEZA: Borrar todos los aliases para que los nombres sean predecibles
        const { error: deleteAliasesError } = await supabase
            .from('user_aliases')
            .delete()
            .or(`owner_id.eq.${mainUserId},owner_id.eq.${secondaryUserId},target_user_id.eq.${mainUserId},target_user_id.eq.${secondaryUserId}`)

        if (deleteAliasesError) throw new Error(`Error limpiando aliases: ${deleteAliasesError.message}`)

        const members = [
            { group_id: testGroup.id, user_id: mainUserId, role: 'admin' },
            { group_id: testGroup.id, user_id: secondaryUserId, role: 'member' }
        ]

        for (const member of members) {
            const { error: memberError } = await supabase
                .from('group_members')
                .upsert({
                    group_id: member.group_id,
                    user_id: member.user_id,
                    role: member.role,
                    joined_at: new Date().toISOString()
                }, { onConflict: 'group_id,user_id' })

            if (memberError) throw new Error(`Error asignando miembro ${member.user_id}: ${memberError.message}`)
        }

        console.log('✅ Setup E2E completo y listo.')

    } catch (error: any) {
        console.error('❌ Error fatal en setup:', error.message)
        process.exit(1)
    }
}

setupE2EUser().catch(err => {
    console.error('❌ Error inesperado:', err)
    process.exit(1)
})
