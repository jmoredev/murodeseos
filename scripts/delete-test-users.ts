/**
 * Script para eliminar usuarios de prueba de Supabase
 * 
 * IMPORTANTE: Este script requiere la clave de servicio de Supabase
 * 
 * Uso:
 * 1. Crea un archivo .env.local con SUPABASE_SERVICE_ROLE_KEY
 * 2. Ejecuta: npx tsx scripts/delete-test-users.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan variables de entorno:')
    console.error('   - NEXT_PUBLIC_SUPABASE_URL')
    console.error('   - SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

// Emails de usuarios de prueba a eliminar
const testUserEmails = [
    'maria@test.com',
    'juan@test.com',
    'ana@test.com',
    'carlos@test.com'
]

async function deleteTestData() {
    console.log('🗑️  Iniciando eliminación de datos de prueba...\n')

    // 1. Obtener IDs de usuarios de prueba
    console.log('🔍 Buscando usuarios de prueba...')
    const { data: users, error: fetchError } = await supabase.auth.admin.listUsers()

    if (fetchError) {
        console.error('❌ Error obteniendo usuarios:', fetchError.message)
        return
    }

    const testUsers = users.users.filter(user =>
        testUserEmails.includes(user.email || '')
    )

    console.log(`   ✅ Encontrados ${testUsers.length} usuarios de prueba\n`)

    if (testUsers.length === 0) {
        console.log('ℹ️  No hay usuarios de prueba para eliminar')
        return
    }

    // 2. Eliminar membresías de grupos
    console.log('🗑️  Eliminando membresías de grupos...')
    const userIds = testUsers.map(u => u.id)

    const { error: membersError } = await supabase
        .from('group_members')
        .delete()
        .in('user_id', userIds)

    if (membersError) {
        console.error('   ❌ Error eliminando membresías:', membersError.message)
    } else {
        console.log('   ✅ Membresías eliminadas')
    }

    // 3. Eliminar grupos creados por usuarios de prueba
    console.log('\n🗑️  Eliminando grupos...')
    const { error: groupsError } = await supabase
        .from('groups')
        .delete()
        .in('creator_id', userIds)

    if (groupsError) {
        console.error('   ❌ Error eliminando grupos:', groupsError.message)
    } else {
        console.log('   ✅ Grupos eliminados')
    }

    // 4. Eliminar perfiles
    console.log('\n🗑️  Eliminando perfiles...')
    const { error: profilesError } = await supabase
        .from('profiles')
        .delete()
        .in('id', userIds)

    if (profilesError) {
        console.error('   ❌ Error eliminando perfiles:', profilesError.message)
    } else {
        console.log('   ✅ Perfiles eliminados')
    }

    // 5. Eliminar usuarios de auth
    console.log('\n🗑️  Eliminando usuarios de autenticación...')
    for (const user of testUsers) {
        try {
            const { error } = await supabase.auth.admin.deleteUser(user.id)

            if (error) {
                console.error(`   ❌ Error eliminando ${user.email}:`, error.message)
            } else {
                console.log(`   ✅ ${user.email} eliminado`)
            }
        } catch (err) {
            console.error(`   ❌ Excepción eliminando ${user.email}:`, err)
        }
    }

    console.log('\n✨ ¡Proceso de limpieza completado!')
}

// Ejecutar
deleteTestData().catch(console.error)
