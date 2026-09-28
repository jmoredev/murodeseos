import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente con la clave de servicio para preparar y limpiar datos de prueba.
 *
 * Es una instancia **compartida** por todos los specs del mismo worker, así que no
 * sirve para iniciar sesión: una sesión dejada aquí haría que las peticiones de
 * los siguientes specs viajaran como ese usuario (sujetas a RLS) en vez de con la
 * clave de servicio. Para comprobar credenciales, usa un cliente propio.
 *
 * La comprobación de variables vive aquí una sola vez: antes cada spec repetía el
 * mismo bloque y una variable ausente se leía como un fallo de ese spec en vez de
 * como un error de preparación con nombre propio.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
    process.env.NEXT_SERVICE_ROLE_KEY ||
    process.env.EXPO_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    const missing = [
        !supabaseUrl ? 'EXPO_PUBLIC_SUPABASE_URL' : null,
        !supabaseServiceRoleKey
            ? 'NEXT_SERVICE_ROLE_KEY / EXPO_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY'
            : null,
    ].filter((name): name is string => name !== null);

    throw new Error(
        `Faltan variables de entorno para los E2E: ${missing.join('; ')}. ` +
            'Se cargan desde .env.local, así que lanza la suite con "pnpm run test:e2e", ' +
            'que además levanta el stack local y lo siembra.',
    );
}

/**
 * Vista de datos y administración: `auth.admin` sí, el inicio de sesión no.
 *
 * La instancia es **compartida** por todos los specs del mismo worker, así que una sesión
 * iniciada aquí haría que las peticiones de los siguientes specs viajaran como ese usuario
 * (sujetas a RLS) en vez de con la clave de servicio. Ya ocurrió una vez. El tipo lo impide:
 * `signInWithPassword` y compañía no existen en esta vista, mientras que crear, listar y
 * borrar usuarios —que es lo que los specs necesitan— sí.
 */
type DataAndAdminClient = Omit<SupabaseClient, 'auth'> & {
    auth: { admin: SupabaseClient['auth']['admin'] };
};

export const supabaseAdmin: DataAndAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// La guardia, comprobada: si alguien ensanchara el tipo, esta línea dejaría de fallar y
// `@ts-expect-error` se convertiría en un error de compilación. Una prueba que no se ve
// fallar no prueba nada.
// @ts-expect-error La vista compartida no ofrece inicio de sesión.
void supabaseAdmin.auth.signInWithPassword;
