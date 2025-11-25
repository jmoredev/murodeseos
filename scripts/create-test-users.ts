/**
 * Script para crear usuarios de prueba en Supabase
 * 
 * IMPORTANTE: Este script requiere la clave de servicio de Supabase
 * 
 * Uso:
 * 1. Crea un archivo .env.local con SUPABASE_SERVICE_ROLE_KEY
 * 2. Ejecuta: npx tsx scripts/create-test-users.ts
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

// Usuarios de prueba
const testUsers = [
    {
        email: 'maria@test.com',
        password: 'Test123!',
        username: 'maria_garcia',
        full_name: 'María García',
        display_name: 'María',
        avatar_url: '👩‍💼'
    },
    {
        email: 'juan@test.com',
        password: 'Test123!',
        username: 'juan_perez',
        full_name: 'Juan Pérez',
        display_name: 'Juan',
        avatar_url: '👨‍💻'
    },
    {
        email: 'ana@test.com',
        password: 'Test123!',
        username: 'ana_lopez',
        full_name: 'Ana López',
        display_name: 'Ana',
        avatar_url: '👩‍🎨'
    },
    {
        email: 'carlos@test.com',
        password: 'Test123!',
        username: 'carlos_ruiz',
        full_name: 'Carlos Ruiz',
        display_name: 'Carlos',
        avatar_url: '👨‍🔧'
    }
]

// Grupos de prueba
const testGroups = [
    { id: 'FAM001', name: 'Familia García', icon: '👨‍👩‍👧‍👦', creatorEmail: 'maria@test.com' },
    { id: 'WORK01', name: 'Amigos del Trabajo', icon: '💼', creatorEmail: 'juan@test.com' },
    { id: 'BOOK01', name: 'Club de Lectura', icon: '📚', creatorEmail: 'ana@test.com' },
    { id: 'SPORT1', name: 'Equipo Fútbol', icon: '⚽', creatorEmail: 'carlos@test.com' }
]

// Membresías de grupos
const groupMemberships = [
    // Familia García
    { groupId: 'FAM001', memberEmail: 'maria@test.com', role: 'admin' },
    { groupId: 'FAM001', memberEmail: 'juan@test.com', role: 'member' },
    { groupId: 'FAM001', memberEmail: 'ana@test.com', role: 'member' },

    // Amigos del Trabajo
    { groupId: 'WORK01', memberEmail: 'juan@test.com', role: 'admin' },
    { groupId: 'WORK01', memberEmail: 'maria@test.com', role: 'member' },
    { groupId: 'WORK01', memberEmail: 'carlos@test.com', role: 'member' },

    // Club de Lectura
    { groupId: 'BOOK01', memberEmail: 'ana@test.com', role: 'admin' },
    { groupId: 'BOOK01', memberEmail: 'maria@test.com', role: 'member' },
    { groupId: 'BOOK01', memberEmail: 'juan@test.com', role: 'member' },

    // Equipo Fútbol
    { groupId: 'SPORT1', memberEmail: 'carlos@test.com', role: 'admin' },
    { groupId: 'SPORT1', memberEmail: 'juan@test.com', role: 'member' },
    { groupId: 'SPORT1', memberEmail: 'ana@test.com', role: 'member' }
]

async function createTestData() {
    console.log('🚀 Iniciando creación de datos de prueba...\n')

    // Mapa para almacenar email -> userId
    const userMap = new Map<string, string>()

    // 1. Crear usuarios
    console.log('👥 Creando usuarios de prueba...')
    for (const user of testUsers) {
        try {
            const { data, error } = await supabase.auth.admin.createUser({
                email: user.email,
                password: user.password,
                email_confirm: true,
                user_metadata: {
                    full_name: user.full_name,
                    avatar_url: user.avatar_url
                }
            })

            if (error) {
                console.error(`   ❌ Error creando ${user.email}:`, error.message)
                continue
            }

            if (data.user) {
                userMap.set(user.email, data.user.id)
                console.log(`   ✅ ${user.email} creado (ID: ${data.user.id})`)

                // Actualizar perfil
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        username: user.username,
                        display_name: user.display_name,
                        avatar_url: user.avatar_url
                    })
                    .eq('id', data.user.id)

                if (profileError) {
                    console.error(`   ⚠️  Error actualizando perfil de ${user.email}:`, profileError.message)
                } else {
                    console.log(`   ✅ Perfil de ${user.email} actualizado`)
                }
            }
        } catch (err) {
            console.error(`   ❌ Excepción creando ${user.email}:`, err)
        }
    }

    console.log('\n📁 Creando grupos de prueba...')
    // 2. Crear grupos
    for (const group of testGroups) {
        const creatorId = userMap.get(group.creatorEmail)
        if (!creatorId) {
            console.error(`   ❌ No se encontró usuario creador para ${group.name}`)
            continue
        }

        try {
            const { error } = await supabase
                .from('groups')
                .insert({
                    id: group.id,
                    name: group.name,
                    icon: group.icon,
                    creator_id: creatorId
                })

            if (error) {
                console.error(`   ❌ Error creando grupo ${group.name}:`, error.message)
            } else {
                console.log(`   ✅ Grupo "${group.name}" creado (ID: ${group.id})`)
            }
        } catch (err) {
            console.error(`   ❌ Excepción creando grupo ${group.name}:`, err)
        }
    }

    console.log('\n👥 Añadiendo miembros a grupos...')
    // 3. Crear membresías
    for (const membership of groupMemberships) {
        const userId = userMap.get(membership.memberEmail)
        if (!userId) {
            console.error(`   ❌ No se encontró usuario ${membership.memberEmail}`)
            continue
        }

        try {
            const { error } = await supabase
                .from('group_members')
                .insert({
                    group_id: membership.groupId,
                    user_id: userId,
                    role: membership.role
                })

            if (error) {
                console.error(`   ❌ Error añadiendo ${membership.memberEmail} a ${membership.groupId}:`, error.message)
            } else {
                console.log(`   ✅ ${membership.memberEmail} añadido a ${membership.groupId} como ${membership.role}`)
            }
        } catch (err) {
            console.error(`   ❌ Excepción añadiendo miembro:`, err)
        }
    }

    console.log('\n✨ ¡Proceso completado!')
    console.log('\n📊 Resumen:')
    console.log(`   - Usuarios creados: ${userMap.size}/${testUsers.length}`)
    console.log(`   - Grupos creados: ${testGroups.length}`)
    console.log(`   - Membresías creadas: ${groupMemberships.length}`)
    console.log('\n🔐 Credenciales de prueba:')
    testUsers.forEach(user => {
        console.log(`   - ${user.email} / ${user.password}`)
    })
}

// Ejecutar
createTestData().catch(console.error)
