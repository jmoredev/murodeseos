import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reserveWishlistItem, cancelWishlistReservation, WishReservationError } from '@/lib/wish-reservation';
import { supabase } from '@/lib/supabase';

describe('wish-reservation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reserves when the row is available', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: { reserved_by: 'user-2' },
            error: null,
        });
        const chain = {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle,
        };
        vi.mocked(supabase.from).mockReturnValue(chain as any);

        const reservedBy = await reserveWishlistItem('wish-1', 'user-2');
        expect(reservedBy).toBe('user-2');
        expect(chain.is).toHaveBeenCalledWith('reserved_by', null);
    });

    it('throws when the item is already reserved', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const chain = {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle,
        };
        vi.mocked(supabase.from).mockReturnValue(chain as any);

        await expect(reserveWishlistItem('wish-1', 'user-2')).rejects.toBeInstanceOf(WishReservationError);
    });

    it('cancels only the current user reservation', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'wish-1' }, error: null });
        const chain = {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle,
        };
        vi.mocked(supabase.from).mockReturnValue(chain as any);

        await expect(cancelWishlistReservation('wish-1', 'user-2')).resolves.toBeUndefined();
        expect(chain.eq).toHaveBeenCalledWith('reserved_by', 'user-2');
    });
});
