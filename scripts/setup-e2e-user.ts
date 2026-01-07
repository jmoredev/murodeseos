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
    console.log('🧪 Verificando usuario E2E...')

    const { user: testUser } = E2E_CONFIG

    // 1. Buscar si el usuario ya existe
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) {
        console.error('❌ Error listando usuarios:', listError.message)
        process.exit(1)
    }

    let userId: string
    const existingUser = users.find(u => u.email === testUser.email)

    if (existingUser) {
        console.log(`✨ El usuario ${testUser.email} ya existe.`)
        userId = existingUser.id
    } else {
        // 2. Crear Usuario si no existe
        console.log(`➕ Creando nuevo usuario: ${testUser.email}...`)
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: testUser.email,
            password: testUser.password,
            email_confirm: true,
            user_metadata: {
                display_name: testUser.displayName,
                avatar_url: testUser.avatar
            }
        })

        if (createError || !newUser.user) {
            console.error('❌ Error creando usuario:', createError?.message)
            process.exit(1)
        }
        userId = newUser.user.id
        // Esperar un poco al trigger de perfiles
        await new Promise(resolve => setTimeout(resolve, 500))
    }

    // 3. Actualizar perfil y estilo (siempre para asegurar que los datos son correctos)
    console.log('📝 Asegurando perfil y estilo actualizados...')
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            display_name: testUser.displayName,
            avatar_url: testUser.avatar,
            shirt_size: 'L',
            pants_size: '42',
            shoe_size: '44',
            favorite_brands: 'Google, Apple',
            favorite_color: 'Gris',
            updated_at: new Date().toISOString()
        })

    if (profileError) {
        console.error('❌ Error actualizando perfil:', profileError.message)
        process.exit(1)
    }

    console.log('✅ Usuario E2E listo para los tests.')
}

setupE2EUser().catch(err => {
    console.error('❌ Error inesperado:', err)
    process.exit(1)
})
