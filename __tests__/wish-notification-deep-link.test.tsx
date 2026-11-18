import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserWishlistPage from '@/app/wishlist/[id]/index';
import { supabase } from '@/lib/supabase';

// El parámetro `wish` lo inyecta `NotificationMenu` al abrir una notificación de
// deseo añadido: cada test elige sus params.
let mockParams: Record<string, string> = {};

vi.mock('expo-router', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), setParams: vi.fn() }),
    useLocalSearchParams: () => mockParams,
    useGlobalSearchParams: () => mockParams,
    Link: ({ children }: any) => children,
    useFocusEffect: (cb: any) => React.useEffect(cb, [cb]),
    useSegments: () => [],
    usePathname: () => '/wishlist/u-2',
}));

const filas = [
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
];

describe('deep-link de notificación: abrir el deseo que trajo el enlace (S1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParams = { id: 'u-2', name: 'Ana', wish: 'i-9' };
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const rows = table === 'wishlist_items' ? filas : [];
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

    it('abre el detalle del deseo del parámetro sin click, al cargar la lista', async () => {
        render(<UserWishlistPage />);

        const cerrar = await screen.findByRole('button', { name: 'Cerrar detalle' }, { timeout: 4000 });
        expect(cerrar).toBeInTheDocument();
        await waitFor(() => expect(screen.getAllByText(/25,00\sUS\$/).length).toBeGreaterThan(0));
    });

    it('cerrar el detalle no lo reabre aunque la URL siga trayendo el parámetro', async () => {
        render(<UserWishlistPage />);

        await screen.findByRole('button', { name: 'Cerrar detalle' }, { timeout: 4000 });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
        });

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Cerrar detalle' })).not.toBeInTheDocument();
        });
        // La lista sigue pintada.
        expect(await screen.findByText(/Cafetera/, {}, { timeout: 4000 })).toBeInTheDocument();
    });

    it('un id de deseo que ya no existe deja la lista normal, sin detalle abierto', async () => {
        mockParams = { id: 'u-2', name: 'Ana', wish: 'i-fantasma' };
        render(<UserWishlistPage />);

        expect(await screen.findByText(/Cafetera/, {}, { timeout: 4000 })).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Cerrar detalle' })).not.toBeInTheDocument();
        });
    });
});
