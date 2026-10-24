/**
 * Deja un usuario de pruebas en el estado exacto de "recién registrado": existe en
 * auth con el correo confirmado y su fila de `profiles` está sin nombre.
 *
 * Ese estado es el que mira la puerta de entrada: `app/(auth)/login/index.tsx` lee
 * `profiles.display_name` y, si está vacío, manda a `/profile/setup` en vez del muro.
 * Con el perfil ya guardado esa pantalla no se puede volver a ver, así que este
 * comando borra el usuario y lo recrea para repetir el alta completa —perfil,
 * grupos, deseos— tantas veces como haga falta.
 *
 * Uso:
 *   pnpm run user:new
 *   pnpm run user:new -- --email otro@test.com --password OtraClave123!
 *
 * Solo toca el usuario indicado: no reinicia el resto de la base de datos
 * (para eso está `pnpm run seed`).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DEFAULT_EMAIL = 'nuevo@test.com'
// Cumple el mínimo de 8 de `supabase/config.toml` y de `lib/password.ts`.
const DEFAULT_PASSWORD = 'NuevoTest123!'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_SERVICE_ROLE_KEY ||
    process.env.EXPO_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error(
        '❌ Faltan variables de entorno en .env.local: ' +
            'EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY',
    )
    process.exit(1)
}

/** Lee `--clave=valor` de la línea de comandos. */
function readFlag(name: string): string | undefined {
    const prefix = `--${name}=`
    const found = process.argv.slice(2).find(arg => arg.startsWith(prefix))
    return found?.slice(prefix.length)
}

const hasFlag = (name: string) => process.argv.slice(2).includes(`--${name}`)

// La clave de servicio se salta RLS y borra datos: el script se niega a correr
// contra un Supabase que no sea el local, salvo que se pida de forma explícita.
function assertLocalTarget() {
    const host = new URL(supabaseUrl!).hostname
    const isLocal = host === '127.0.0.1' || host === 'localhost' || host === '::1'
    if (isLocal || hasFlag('allow-remote')) return
    console.error(
        `❌ ${supabaseUrl} no es un Supabase local. Este script borra un usuario y sus datos.\n` +
            '   Si estás seguro, repite con --allow-remote.',
    )
    process.exit(1)
}

const email = readFlag('email') ?? DEFAULT_EMAIL
const password = readFlag('password') ?? DEFAULT_PASSWORD

// El cliente de administración nunca inicia sesión: la comprobación de
// credenciales usa un cliente propio (misma regla que `e2e/supabase-admin.ts`).
const admin = createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
})

async function waitForAdminAuthReady(timeoutMs = 30_000) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
        try {
            await admin.auth.admin.listUsers({ page: 0, perPage: 1 })
            return
        } catch {
            // `supabase start` tarda unos segundos en levantar el endpoint de admin.
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }
    throw new Error(`Admin auth no disponible tras ${timeoutMs}ms`)
}

async function findUserByEmail(targetEmail: string) {
    const perPage = 1000
    for (let page = 0; ; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
        if (error) throw new Error(`Error listando usuarios: ${error.message}`)
        const users = data.users ?? []
        const match = users.find(user => user.email === targetEmail)
        if (match) return match
        if (users.length < perPage) return null
    }
}

/**
 * Borra las filas del usuario en orden de dependencias. `profiles`,
 * `groups.creator_id` y `wishlist_items.user_id` no tienen `on delete cascade`
 * (migración `20260102122206_estructura_inicial.sql`), así que el borrado del
 * usuario de auth falla si esas filas siguen ahí. Lo que sí cae en cascada
 * —membresías, alias, reservas, notificaciones, cuotas— se deja al motor.
 */
async function deleteUserData(userId: string) {
    const steps: { table: string; column: string }[] = [
        { table: 'wishlist_items', column: 'user_id' },
        { table: 'groups', column: 'creator_id' },
        { table: 'profiles', column: 'id' },
    ]

    for (const step of steps) {
        const { error } = await admin.from(step.table).delete().eq(step.column, userId)
        if (error) throw new Error(`Error borrando ${step.table}: ${error.message}`)
    }

    // Imágenes del usuario en Storage: la ruta es `<userId>/<archivo>` (lib/wish-image-upload.ts).
    const { data: files, error: listError } = await admin.storage.from('wishlist-images').list(userId)
    if (!listError && files && files.length > 0) {
        const { error: removeError } = await admin.storage
            .from('wishlist-images')
            .remove(files.map(file => `${userId}/${file.name}`))
        if (removeError) console.warn(`⚠️  No se pudieron borrar las imágenes: ${removeError.message}`)
    }
}

/**
 * Comprueba el estado con las mismas credenciales que usará el navegador:
 * inicia sesión y lee el perfil como lo hace la puerta de entrada del login.
 */
async function verifyFreshState() {
    const client = createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
    })
    if (signInError || !signIn.user) {
        throw new Error(`No se pudo iniciar sesión con el usuario nuevo: ${signInError?.message}`)
    }

    const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('display_name')
        .eq('id', signIn.user.id)
        .single()
    await client.auth.signOut()

    if (profileError) throw new Error(`Error leyendo el perfil: ${profileError.message}`)
    if (!profile) throw new Error('El perfil no existe: el trigger handle_new_user no creó la fila')
    if ((profile.display_name ?? '').trim() !== '') {
        throw new Error(`El perfil no está vacío: display_name = ${JSON.stringify(profile.display_name)}`)
    }

    return signIn.user.id
}

async function main() {
    assertLocalTarget()
    console.log(`🧪 Preparando usuario "recién registrado": ${email}\n`)

    await waitForAdminAuthReady()

    const existing = await findUserByEmail(email)
    if (existing) {
        console.log(`   🗑️  Borrando el usuario anterior (${existing.id}) y sus datos...`)
        await deleteUserData(existing.id)
        const { error } = await admin.auth.admin.deleteUser(existing.id)
        if (error) throw new Error(`Error borrando el usuario de auth: ${error.message}`)
    } else {
        console.log('   ✨ No existía: se crea desde cero.')
    }

    console.log('   ➕ Creando el usuario con el correo ya confirmado...')
    // Sin `user_metadata.display_name`: el trigger `private.handle_new_user`
    // copia ese metadata a `profiles`, y vacío es justo el estado buscado.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })
    if (createError || !created.user) {
        throw new Error(`Error creando el usuario: ${createError?.message}`)
    }

    const userId = await verifyFreshState()

    // Comprobación de que no quedó nada colgando de un uso anterior.
    for (const table of ['wishlist_items', 'group_members', 'user_aliases']) {
        const column = table === 'wishlist_items' ? 'user_id' : table === 'group_members' ? 'user_id' : 'owner_id'
        const { count, error } = await admin
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq(column, userId)
        if (error) throw new Error(`Error contando ${table}: ${error.message}`)
        if ((count ?? 0) > 0) throw new Error(`${table} tiene ${count} fila(s) del usuario; debería estar vacío`)
    }

    console.log('\n✅ Usuario de pruebas listo, en estado de recién registrado.')
    console.log(`   Correo:     ${email}`)
    console.log(`   Contraseña: ${password}`)
    console.log(`   id:         ${userId}`)
    console.log(
        '\n   Al iniciar sesión, la app abre /profile/setup (no el muro) hasta que guardes el perfil.' +
            '\n   Vuelve a ejecutar este comando para regresar a este mismo punto.' +
            '\n',
    )
}

main().catch(error => {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
})
