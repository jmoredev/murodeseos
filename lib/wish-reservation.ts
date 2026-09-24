import { supabase } from '@/lib/supabase';

export class WishReservationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WishReservationError';
    }
}

export async function reserveWishlistItem(itemId: string, userId: string): Promise<string> {
    const { data, error } = await supabase
        .from('wishlist_items')
        .update({
            reserved_by: userId,
        })
        .eq('id', itemId)
        .is('reserved_by', null)
        .select('reserved_by')
        .maybeSingle();

    if (error) throw error;
    if (!data?.reserved_by) {
        throw new WishReservationError('Este regalo ya no está disponible.');
    }

    return data.reserved_by;
}

export async function cancelWishlistReservation(itemId: string, userId: string): Promise<void> {
    const { data, error } = await supabase
        .from('wishlist_items')
        .update({
            reserved_by: null,
        })
        .eq('id', itemId)
        .eq('reserved_by', userId)
        .select('id')
        .maybeSingle();

    if (error) throw error;
    if (!data) {
        throw new WishReservationError('No se pudo cancelar la reserva.');
    }
}
