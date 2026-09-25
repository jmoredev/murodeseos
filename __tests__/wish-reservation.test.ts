import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    reserveWishlistItem,
    cancelWishlistReservation,
    getWishlistReservationStates,
    WishReservationError,
} from '@/lib/wish-reservation';
import { supabase } from '@/lib/supabase';

describe('wish-reservation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // El mock global de Supabase no declara `rpc`; se añade aquí.
        (supabase as any).rpc = vi.fn();
    });

    it('reserves by inserting item_id and reserver_id, no legacy column', async () => {
        const insert = vi.fn().mockResolvedValue({ error: null });
        vi.mocked(supabase.from).mockReturnValue({ insert } as any);

        await expect(reserveWishlistItem('wish-1', 'user-2')).resolves.toBe('user-2');

        expect(supabase.from).toHaveBeenCalledWith('wishlist_reservations');
        expect(insert).toHaveBeenCalledWith({ item_id: 'wish-1', reserver_id: 'user-2' });
        // El payload tiene exactamente estas dos claves: ninguna columna heredada.
        expect(Object.keys(insert.mock.calls[0][0]).sort()).toEqual(['item_id', 'reserver_id']);
    });

    it('maps 23505 (already reserved) to WishReservationError', async () => {
        const insert = vi.fn().mockResolvedValue({
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        });
        vi.mocked(supabase.from).mockReturnValue({ insert } as any);

        await expect(reserveWishlistItem('wish-1', 'user-2')).rejects.toBeInstanceOf(WishReservationError);
    });

    it('maps 42501 (RLS: not visible or own wish) to WishReservationError', async () => {
        const insert = vi.fn().mockResolvedValue({
            error: { code: '42501', message: 'new row violates row-level security policy' },
        });
        vi.mocked(supabase.from).mockReturnValue({ insert } as any);

        await expect(reserveWishlistItem('wish-1', 'user-2')).rejects.toBeInstanceOf(WishReservationError);
    });

    it('rethrows unrelated errors', async () => {
        const insert = vi.fn().mockResolvedValue({
            error: { code: '500', message: 'boom' },
        });
        vi.mocked(supabase.from).mockReturnValue({ insert } as any);

        await expect(reserveWishlistItem('wish-1', 'user-2')).rejects.toMatchObject({ code: '500' });
    });

    it('cancels the current user reservation', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({ data: { item_id: 'wish-1' }, error: null });
        const chain = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle,
        };
        vi.mocked(supabase.from).mockReturnValue(chain as any);

        await expect(cancelWishlistReservation('wish-1', 'user-2')).resolves.toBeUndefined();

        expect(supabase.from).toHaveBeenCalledWith('wishlist_reservations');
        expect(chain.eq).toHaveBeenCalledWith('item_id', 'wish-1');
        expect(chain.eq).toHaveBeenCalledWith('reserver_id', 'user-2');
        expect(chain.select).toHaveBeenCalledWith('item_id');
    });

    it('throws when the cancel delete returns no row', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const chain = {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle,
        };
        vi.mocked(supabase.from).mockReturnValue(chain as any);

        await expect(cancelWishlistReservation('wish-1', 'user-2')).rejects.toBeInstanceOf(
            WishReservationError
        );
    });

    it('builds the reservation state map from the RPC rows', async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: [
                { item_id: 'wish-1', reserved_by_me: true },
                { item_id: 'wish-2', reserved_by_me: false },
            ],
            error: null,
        });
        (supabase as any).rpc = rpc;

        const states = await getWishlistReservationStates('owner-1');

        expect(rpc).toHaveBeenCalledWith('get_wishlist_reservation_states', { owner_uuid: 'owner-1' });
        expect(states.get('wish-1')).toBe(true);
        expect(states.get('wish-2')).toBe(false);
        expect(states.has('wish-3')).toBe(false);
    });

    it('throws when the reservation state RPC fails instead of returning an empty map', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'nope' } });
        (supabase as any).rpc = rpc;

        await expect(getWishlistReservationStates('owner-1')).rejects.toMatchObject({ message: 'nope' });
    });
});
