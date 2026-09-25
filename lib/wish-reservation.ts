import { supabase } from '@/lib/supabase';

export class WishReservationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WishReservationError';
    }
}

export type ReservationState = 'available' | 'reserved_by_me' | 'reserved_by_other';

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

    if (error) throw error;
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
