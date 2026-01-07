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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan variables de entorno (URL o SERVICE_ROLE_KEY)')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function setupE2EUser() {
    console.log('🧪 Verificando configuración E2E...')

    const { user: mainUser, secondaryUser, group: testGroup } = E2E_CONFIG

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
            // Esperar trigger de perfil
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        // Asegurar perfil
        console.log(`   📝 Asegurando perfil...`)
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                display_name: userConfig.displayName,
                avatar_url: userConfig.avatar,
                shirt_size: 'L',
                pants_size: '42',
                favorite_color: 'Gris',
                updated_at: new Date().toISOString()
            })

        if (profileError) throw new Error(`Error en perfil de ${userConfig.email}: ${profileError.message}`)

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
        console.log(`👫 Verificando membresías...`)

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
