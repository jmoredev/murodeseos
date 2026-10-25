/**
 * La marca del tour en el perfil: leerla y escribirla (D2, D3).
 *
 * La marca vive en `profiles.tour_completed_at` (`timestamp with time zone`, nullable) y la
 * migración dejó marcados a todos los perfiles que ya existían, así que la condición de arranque es
 * una sola en todo el código: `tour_completed_at IS NULL`. No hay fechas de corte repartidas por las
 * pantallas (D3).
 *
 * Hay **tres** respuestas y confundirlas cuesta caro en las dos direcciones:
 *
 * - `null`: la fila existe y la columna está vacía. Cuenta nueva, el tour empieza.
 * - una fecha: ya lo vio. No se le vuelve a enseñar aunque cambie de móvil o reinstale la PWA.
 * - `undefined`: **no se pudo saber** (no hay fila, la consulta falló, el plazo se agotó). Nunca
 *   arranca el tour: enseñárselo a quien ya lo vio es el único error que no se puede deshacer.
 *
 * La base entra por parámetro para que esto se pueda probar sin red, y las dos operaciones van
 * acotadas por un plazo como el resto de la app (`AUTH_SESSION_MS` en `app/index.tsx`): una petición
 * colgada no puede dejar el arranque esperando para siempre.
 */

import { supabase } from '@/lib/supabase';

/**
 * El plazo compartido con el arranque de sesión (`app/index.tsx`). Doce segundos: por debajo de la
 * paciencia de quien espera mirando una pantalla en blanco, por encima de una red móvil lenta.
 */
export const TOUR_FLAG_TIMEOUT_MS = 12_000;

/** La fila del perfil que se lee. */
export type TourFlagRow = { tour_completed_at: string | null };

type TourFlagError = { message: string } | null;

/** Lo mínimo que se le pide a la base: una lectura y una escritura, las dos por usuario. */
export type TourFlagDb = {
    from(table: 'profiles'): {
        select(column: 'tour_completed_at'): {
            eq(column: 'id', value: string): {
                maybeSingle(): PromiseLike<{ data: TourFlagRow | null; error: TourFlagError }>;
            };
        };
        update(values: { tour_completed_at: string }): {
            eq(column: 'id', value: string): PromiseLike<{ error: TourFlagError }>;
        };
    };
};

/**
 * El cliente de verdad, visto con la forma mínima de arriba. Se exporta para que quien inyecte uno
 * falso (las pruebas) y quien use el real no tengan que repetir el moldeado del tipo.
 */
export const TOUR_FLAG_DB = supabase as unknown as TourFlagDb;

/** Distingue «se agotó el plazo» de un resultado que de verdad llegó. */
const AGOTADO = Symbol('tour_flag_timeout');

/**
 * Corre `trabajo` con un plazo máximo. Al agotarse no rechaza: devuelve `AGOTADO`, porque quien
 * llama tiene una respuesta buena para ese caso y una excepción sin dueño sólo tumbaría la pantalla.
 * El temporizador se retira siempre, para no dejar uno vivo por cada arranque.
 */
async function conPlazo<T>(trabajo: PromiseLike<T>): Promise<T | typeof AGOTADO> {
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const plazo = new Promise<typeof AGOTADO>((resolve) => {
        temporizador = setTimeout(() => resolve(AGOTADO), TOUR_FLAG_TIMEOUT_MS);
    });

    try {
        return await Promise.race([Promise.resolve(trabajo), plazo]);
    } finally {
        if (temporizador !== undefined) clearTimeout(temporizador);
    }
}

/**
 * Decide si hay que enseñar el tour. Sólo una cuenta nueva: `null` es exactamente
 * `tour_completed_at IS NULL` (D3). `undefined` —no se pudo saber— **no** arranca.
 */
export function shouldStartTour(flag: string | null | undefined): boolean {
    return flag === null;
}

/**
 * Lee la marca del perfil de `userId`. No lanza nunca: todo lo que no sea una respuesta clara se
 * convierte en `undefined`, que apaga el tour. Un fallo de lectura tampoco se registra en el log a
 * propósito: se repetiría en cada arranque de una cuenta con el perfil roto, y la respuesta segura
 * (`undefined`) ya es la correcta.
 */
export async function readTourCompletedAt(
    db: TourFlagDb = TOUR_FLAG_DB,
    userId: string
): Promise<string | null | undefined> {
    try {
        const resultado = await conPlazo(
            db.from('profiles').select('tour_completed_at').eq('id', userId).maybeSingle()
        );

        if (resultado === AGOTADO) return undefined;
        if (resultado.error || !resultado.data) return undefined;

        // Una columna vacía sigue siendo «cuenta nueva» (D3), no «no se sabe»: son respuestas
        // distintas y esta sólo puede llegar con la fila delante.
        return resultado.data.tour_completed_at ?? null;
    } catch {
        return undefined;
    }
}

/**
 * Marca la cuenta como vista al terminar o saltar el tour (D2). Es **best-effort**: si falla
 * devuelve `false` y deja un aviso en el log, pero no lanza ni bloquea la interfaz. El tour se cierra
 * igual; lo peor que pasa es que esa cuenta lo vuelva a ver en el siguiente arranque, y la marca
 * volverá a intentarse entonces.
 */
export async function markTourCompleted(
    db: TourFlagDb = TOUR_FLAG_DB,
    userId: string
): Promise<boolean> {
    try {
        const resultado = await conPlazo(
            db
                .from('profiles')
                .update({ tour_completed_at: new Date().toISOString() })
                .eq('id', userId)
        );

        if (resultado === AGOTADO) {
            console.error('No se pudo marcar el tour como visto: la escritura no respondió a tiempo');

            return false;
        }

        if (resultado.error) {
            console.error('No se pudo marcar el tour como visto:', resultado.error.message);

            return false;
        }

        return true;
    } catch (error) {
        console.error('No se pudo marcar el tour como visto:', error);

        return false;
    }
}
