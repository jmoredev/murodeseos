import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserWishlistPage from '@/app/wishlist/[id]/index';
import { supabase } from '@/lib/supabase';

vi.mock('expo-router', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), setParams: vi.fn() }),
    useLocalSearchParams: () => ({ id: 'u-2', name: 'Ana' }),
    useGlobalSearchParams: () => ({ id: 'u-2' }),
    Link: ({ children }: any) => children,
    useFocusEffect: (cb: any) => React.useEffect(cb, [cb]),
    useSegments: () => [],
    usePathname: () => '/wishlist/u-2',
}));

describe('moneda en la lista compartida (T7 · S6)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const rows =
                table === 'wishlist_items'
                    ? [
                          {
                              id: 'i-9',
                              title: 'Cafetera',
                              links: [],
                              image_url: null,
                              price_numeric: 25,
                              currency: 'USD',
                              notes: null,
                              priority: 'high',
                              excluded_group_ids: [],
                          },
                      ]
                    : [];
            const chain: any = {
                select: vi.fn().mockReturnThis(),
                insert: vi.fn().mockReturnThis(),
                update: vi.fn().mockReturnThis(),
                delete: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
                maybeSingle: vi.fn().mockResolvedValue({ data: table === 'profiles' ? { display_name: 'Ana' } : null, error: null }),
                then: (resolve: any) => Promise.resolve({ data: rows, error: null }).then(resolve),
            };
            return chain;
        });
        vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null } as any);
        (supabase as any).channel = vi.fn(() => {
            const ch: any = { on: () => ch, subscribe: () => ch, unsubscribe: () => ch };
            return ch;
        });
        (supabase as any).removeChannel = vi.fn();
    });

    it('el detalle de la lista de otro miembro pinta la moneda guardada', async () => {
        render(<UserWishlistPage />);
        const card = await screen.findByText(/Cafetera/, {}, { timeout: 4000 });
        await act(async () => {
            fireEvent.click(card);
        });
        await waitFor(() => expect(screen.getAllByText(/25,00\sUS\$/).length).toBeGreaterThan(0));
        expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    });
});
