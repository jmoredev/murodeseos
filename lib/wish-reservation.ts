import { supabase } from '@/lib/supabase';

export class WishReservationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WishReservationError';
    }
}

export type ReservationState = 'available' | 'reserved_by_me' | 'reserved_by_other' | 'unknown';

/**
 * Error de cliente desactualizado: el código servido ya no coincide con el
 * esquema (migación unidireccional de reservas). Conserva el error original en
 * `cause` para los logs y muestra un mensaje accionable al usuario.
 */
export class WishSchemaMismatchError extends Error {
    constructor(message: string, cause: unknown) {
        super(message, { cause });
        this.name = 'WishSchemaMismatchError';
    }
}

// 42703: columna inexistente; 42P01: tabla inexistente; 42883: función
// inexistente. PGRST202/PGRST204: sus equivalentes en PostgREST.
const SCHEMA_MISMATCH_CODES = new Set(['42703', '42P01', '42883', 'PGRST202', 'PGRST204']);

const SCHEMA_MISMATCH_MESSAGE = 'La aplicación no está actualizada. Recarga la página para continuar.';

/** Clasificador de errores "el cliente es más antiguo que el esquema". */
export function isWishSchemaMismatchError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof code === 'string' && SCHEMA_MISMATCH_CODES.has(code)) return true;
    // Solo si la forma no trae `code`: el código explícito dentro del mensaje.
    return (
        typeof message === 'string' &&
        Array.from(SCHEMA_MISMATCH_CODES).some((c) => message.includes(c))
    );
}

function throwIfSchemaMismatch(error: unknown): void {
    if (isWishSchemaMismatchError(error)) {
        throw new WishSchemaMismatchError(SCHEMA_MISMATCH_MESSAGE, error);
    }
}

/**
 * Reserva un deseo en la tabla dedicada. `item_id` es clave primaria, así que la
 * unicidad la garantiza la base: gana la primera reserva y la segunda falla.
 */
export async function reserveWishlistItem(itemId: string, userId: string): Promise<string> {
    const { error } = await supabase
        .from('wishlist_reservations')
        .insert({
            item_id: itemId,
            reserver_id: userId,
        });

    if (error) {
        throwIfSchemaMismatch(error);
        // 23505: ya existe una reserva para ese deseo. 42501: RLS, el deseo no es
        // visible para el viewer o es su propio deseo.
        if (error.code === '23505' || error.code === '42501') {
            throw new WishReservationError('Este regalo ya no está disponible.');
        }
        throw error;
    }

    return userId;
}

/**
 * Cancela la reserva propia de un deseo. `.maybeSingle()` sobre `item_id` hace
 * detectable un delete rechazado: sin fila devuelta no se puede afirmar que se
 * canceló.
 */
export async function cancelWishlistReservation(itemId: string, userId: string): Promise<void> {
    const { data, error } = await supabase
        .from('wishlist_reservations')
        .delete()
        .eq('item_id', itemId)
        .eq('reserver_id', userId)
        .select('item_id')
        .maybeSingle();

    if (error) {
        throwIfSchemaMismatch(error);
        throw error;
    }
    if (!data) {
        throw new WishReservationError('No se pudo cancelar la reserva.');
    }
}

/**
 * Estado de reserva visible para el viewer sobre los deseos del dueño indicado.
 * La función de la base solo devuelve `item_id` y si la reserva es mía, nunca la
 * autoría, y no devuelve nada de los deseos del propio dueño. El error se
 * propaga: un mapa vacío pintaría todos los deseos como disponibles.
 */
export async function getWishlistReservationStates(ownerUserId: string): Promise<Map<string, boolean>> {
    const { data, error } = await supabase.rpc('get_wishlist_reservation_states', {
        owner_uuid: ownerUserId,
    });

    if (error) throw error;

    const states = new Map<string, boolean>();
    for (const row of data ?? []) {
        states.set(row.item_id, row.reserved_by_me);
    }
    return states;
}

/**
 * Variante sin excepciones de `getWishlistReservationStates`: si la lectura
 * falla (RPC ausente, timeout, caída puntual), devuelve `degraded: true` con
 * un mapa vacío en lugar de abortar la pantalla completa. Un estado ausente
 * con `degraded` debe tratarse como desconocido, nunca como disponible.
 */
export async function getWishlistReservationStatesSafe(
    ownerUserId: string
): Promise<{ states: Map<string, boolean>; degraded: boolean }> {
    try {
        return { states: await getWishlistReservationStates(ownerUserId), degraded: false };
    } catch (err) {
        console.error('No se pudo leer el estado de reservas; se muestran como desconocidas:', err);
        return { states: new Map(), degraded: true };
    }
}
