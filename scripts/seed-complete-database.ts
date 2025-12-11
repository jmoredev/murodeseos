/**
 * Script completo para resetear y poblar la base de datos de prueba
 * Crea: usuarios, perfiles, grupos, membresías y listas de deseos
 * 
 * Uso: npx tsx scripts/seed-complete-database.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan variables de entorno')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

// Datos de usuarios
const USERS = [
    { email: 'juan@test.com', password: 'Test123!', displayName: 'Juan Pérez', avatar: '👨‍💻' },
    { email: 'maria@test.com', password: 'Test123!', displayName: 'María García', avatar: '👩‍💼' },
    { email: 'ana@test.com', password: 'Test123!', displayName: 'Ana López', avatar: '👩‍🎨' },
    { email: 'carlos@test.com', password: 'Test123!', displayName: 'Carlos Ruiz', avatar: '👨‍🔧' },
    // Usuario E2E para tests automáticos
    { email: 'e2e-test@test.com', password: 'E2ETest123!', displayName: 'E2E Test User', avatar: '🤖' }
]

// Datos de grupos
const GROUPS = [
    { id: 'FAM001', name: 'Familia García', icon: '👨‍👩‍👧‍👦', creatorEmail: 'maria@test.com' },
    { id: 'WORK01', name: 'Amigos del Trabajo', icon: '💼', creatorEmail: 'juan@test.com' },
    { id: 'BOOK01', name: 'Club de Lectura', icon: '📚', creatorEmail: 'ana@test.com' },
    // Grupo E2E para tests automáticos
    { id: 'E2E001', name: 'E2E Test Group', icon: '🧪', creatorEmail: 'e2e-test@test.com' }
]

// Datos de wishlist items
const WISHLIST_ITEMS = [
    { title: 'Auriculares Sony WH-1000XM5', price: '349.00', image_url: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=500', priority: 'high' },
    { title: 'Libro: El Archivo de las Tormentas', price: '25.00', image_url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=500', priority: 'medium' },
    { title: 'Zapatillas Nike Air Max', price: '120.00', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=500', priority: 'high' },
    { title: 'Cafetera Italiana Bialetti', price: '35.00', image_url: 'https://images.unsplash.com/photo-1561882468-489833355708?auto=format&fit=crop&q=80&w=500', priority: 'low' },
    { title: 'Set de LEGO Star Wars', price: '89.99', image_url: 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?auto=format&fit=crop&q=80&w=500', priority: 'medium' }
]

// Wishlist items predecibles para usuario E2E
const E2E_WISHLIST_ITEMS = [
    { title: 'E2E Test Item 1', price: '100.00', image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=500', priority: 'high' },
    { title: 'E2E Test Item 2', price: '50.00', image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=500', priority: 'medium' },
    { title: 'E2E Test Item 3', price: '25.00', image_url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=500', priority: 'low' }
]

async function cleanDatabase() {
    console.log('🗑️  Limpiando base de datos...\n')

    // Eliminar en orden correcto (respetando foreign keys)
    await supabase.from('wishlist_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('group_members').delete().neq('group_id', '00000000')
    await supabase.from('groups').delete().neq('id', '00000000')
    await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const { data: allUsers } = await supabase.auth.admin.listUsers()
    if (allUsers?.users) {
        for (const user of allUsers.users) {
            await supabase.auth.admin.deleteUser(user.id)
        }
    }

    console.log('✅ Base de datos limpiada\n')
}

async function createUsers() {
    console.log('👥 Creando usuarios...\n')
    const userMap = new Map<string, string>() // email -> userId

    for (const user of USERS) {
        const { data: newUser, error } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: {
                display_name: user.displayName,
                avatar_url: user.avatar,
            }
        })

        if (error || !newUser.user) {
            console.error(`❌ Error creando ${user.email}:`, error?.message)
            continue
        }

        const userId = newUser.user.id
        userMap.set(user.email, userId)

        // Esperar un momento para que el trigger cree el perfil
        await new Promise(resolve => setTimeout(resolve, 100))

        // Verificar que el perfil se creó correctamente
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

        if (profileError || !profile) {
            console.error(`❌ Error: perfil no creado para ${user.email}`)
            continue
        }

        // Si el perfil no tiene display_name, actualizarlo
        if (!profile.display_name) {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    display_name: user.displayName,
                    avatar_url: user.avatar,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId)

            if (updateError) {
                console.error(`❌ Error actualizando perfil para ${user.email}:`, updateError.message)
                continue
            }
        }

        console.log(`✅ ${user.avatar} ${user.displayName} (${user.email})`)
    }

    console.log('')
    return userMap
}

async function createGroups(userMap: Map<string, string>) {
    console.log('🎯 Creando grupos...\n')
    const groupMap = new Map<string, { id: string; creatorId: string }>()

    for (const group of GROUPS) {
        const creatorId = userMap.get(group.creatorEmail)
        if (!creatorId) {
            console.error(`❌ No se encontró el creador ${group.creatorEmail}`)
            continue
        }

        const { error } = await supabase.from('groups').insert({
            id: group.id,
            name: group.name,
            icon: group.icon,
            creator_id: creatorId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })

        if (error) {
            console.error(`❌ Error creando grupo ${group.name}:`, error.message)
            continue
        }

        groupMap.set(group.id, { id: group.id, creatorId })
        console.log(`✅ ${group.icon} ${group.name} (${group.id})`)
    }

    console.log('')
    return groupMap
}

async function createGroupMembers(userMap: Map<string, string>, groupMap: Map<string, { id: string; creatorId: string }>) {
    console.log('👫 Asignando miembros a grupos...\n')

    // Familia García: María (admin), Juan, Ana
    const famGroup = groupMap.get('FAM001')
    if (famGroup) {
        await supabase.from('group_members').insert([
            { group_id: 'FAM001', user_id: famGroup.creatorId, role: 'admin', joined_at: new Date().toISOString() },
            { group_id: 'FAM001', user_id: userMap.get('juan@test.com')!, role: 'member', joined_at: new Date().toISOString() },
            { group_id: 'FAM001', user_id: userMap.get('ana@test.com')!, role: 'member', joined_at: new Date().toISOString() },
        ])
        console.log('✅ Familia García: María (admin), Juan, Ana')
    }

    // Amigos del Trabajo: Juan (admin), María, Carlos
    const workGroup = groupMap.get('WORK01')
    if (workGroup) {
        await supabase.from('group_members').insert([
            { group_id: 'WORK01', user_id: workGroup.creatorId, role: 'admin', joined_at: new Date().toISOString() },
            { group_id: 'WORK01', user_id: userMap.get('maria@test.com')!, role: 'member', joined_at: new Date().toISOString() },
            { group_id: 'WORK01', user_id: userMap.get('carlos@test.com')!, role: 'member', joined_at: new Date().toISOString() },
        ])
        console.log('✅ Amigos del Trabajo: Juan (admin), María, Carlos')
    }

    // Club de Lectura: Ana (admin), María, Juan
    const bookGroup = groupMap.get('BOOK01')
    if (bookGroup) {
        await supabase.from('group_members').insert([
            { group_id: 'BOOK01', user_id: bookGroup.creatorId, role: 'admin', joined_at: new Date().toISOString() },
            { group_id: 'BOOK01', user_id: userMap.get('maria@test.com')!, role: 'member', joined_at: new Date().toISOString() },
            { group_id: 'BOOK01', user_id: userMap.get('juan@test.com')!, role: 'member', joined_at: new Date().toISOString() },
        ])
        console.log('✅ Club de Lectura: Ana (admin), María, Juan')
    }

    // Grupo E2E: Solo el usuario E2E (admin)
    const e2eGroup = groupMap.get('E2E001')
    if (e2eGroup) {
        await supabase.from('group_members').insert([
            { group_id: 'E2E001', user_id: e2eGroup.creatorId, role: 'admin', joined_at: new Date().toISOString() },
        ])
        console.log('✅ E2E Test Group: E2E Test User (admin)')
    }

    console.log('')
}

async function createWishlists(userMap: Map<string, string>) {
    console.log('🎁 Creando listas de deseos...\n')

    const allUserIds = Array.from(userMap.values())
    const e2eUserId = userMap.get('e2e-test@test.com')

    for (const [email, userId] of userMap.entries()) {
        let items = []

        // Usuario E2E: items predecibles y sin reservas
        if (email === 'e2e-test@test.com') {
            items = E2E_WISHLIST_ITEMS.map(item => ({
                user_id: userId,
                title: item.title,
                price: item.price,
                image_url: item.image_url,
                links: [],
                notes: '',
                priority: item.priority,
                reserved_by: null // Nunca reservado para tests
            }))
        } else {
            // Usuarios normales: items aleatorios
            const numItems = Math.floor(Math.random() * 3) + 2 // 2-4 items por usuario

            for (let i = 0; i < numItems; i++) {
                const item = WISHLIST_ITEMS[Math.floor(Math.random() * WISHLIST_ITEMS.length)]

                // 30% probabilidad de estar reservado
                let reservedBy = null
                if (Math.random() < 0.3) {
                    const otherUsers = allUserIds.filter(id => id !== userId)
                    if (otherUsers.length > 0) {
                        reservedBy = otherUsers[Math.floor(Math.random() * otherUsers.length)]
                    }
                }

                items.push({
                    user_id: userId,
                    title: item.title,
                    price: item.price,
                    image_url: item.image_url,
                    links: [],
                    notes: '',
                    priority: item.priority,
                    reserved_by: reservedBy
                })
            }
        }

        const { error } = await supabase.from('wishlist_items').insert(items)

        if (error) {
            console.error(`❌ Error creando wishlist para ${email}:`, error.message)
        } else {
            const reserved = items.filter(i => i.reserved_by).length
            console.log(`✅ ${email}: ${items.length} deseos (${reserved} reservados)`)
        }
    }

    console.log('')
}

async function main() {
    console.log('🚀 INICIANDO SEED COMPLETO DE BASE DE DATOS\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    try {
        await cleanDatabase()
        const userMap = await createUsers()
        const groupMap = await createGroups(userMap)
        await createGroupMembers(userMap, groupMap)
        await createWishlists(userMap)

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('✨ ¡SEED COMPLETADO EXITOSAMENTE!\n')
        console.log('📋 Credenciales de acceso:')
        console.log('   Todos los usuarios: password = Test123!\n')
        console.log('👥 Usuarios creados:')
        USERS.forEach(u => console.log(`   - ${u.email} (${u.displayName})`))
        console.log('\n🎯 Grupos creados:')
        GROUPS.forEach(g => console.log(`   - ${g.name} (${g.id})`))
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    } catch (error) {
        console.error('❌ Error inesperado:', error)
        process.exit(1)
    }
}

main().catch(console.error)
