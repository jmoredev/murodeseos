import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WishListTab } from '@/components/WishListTab';
import { supabase } from '@/lib/supabase';
import { savePendingDraft, takePendingDraft } from '@/lib/share-draft';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// El «+» navega en vez de abrir el modal, así que el push se controla desde el test.
const push = vi.fn();

/**
 * El foco de la pantalla, que el test tiene que poder disparar a mano.
 *
 * Volver de `/wishlist/add` **no** vuelve a montar la lista, así que «volver» solo se puede
 * probar si el doble de `useFocusEffect` deja emitir un foco: con un `useEffect` de montaje
 * (o con un no-op) «regresa el foco» y «montar» serían indistinguibles desde un test.
 */
const foco = vi.hoisted(() => {
    const oyentes = new Set<() => void>();
    return {
        oyentes,
        emitir: () => {
            Array.from(oyentes).forEach((oyente) => oyente());
        },
    };
});

// `vi.mock` se eleva por encima de los imports, así que el componente recibe estos dobles aunque
// el import esté arriba. El `push` se lee de forma diferida (al renderizar), no al registrar el
// mock.
vi.mock('expo-router', () => {
    /**
     * `useFocusEffect` de verdad: corre el callback al montar y **también** cada vez que la
     * pantalla recupera el foco, con la limpieza del callback anterior entre medias. Un no-op
     * aquí convertiría cualquier efecto de foco en nada.
     */
    function useFocusEffectEnfocado(callback: any) {
        useEffect(() => {
            let limpiar = callback();
            const alEnfocar = () => {
                if (typeof limpiar === 'function') limpiar();
                limpiar = callback();
            };
            foco.oyentes.add(alEnfocar);
            return () => {
                foco.oyentes.delete(alEnfocar);
                if (typeof limpiar === 'function') limpiar();
            };
        }, [callback]);
    }

    return {
        useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), setParams: vi.fn() }),
        useLocalSearchParams: () => ({}),
        useGlobalSearchParams: () => ({}),
        Link: ({ children }: any) => children,
        useFocusEffect: useFocusEffectEnfocado,
        useSegments: () => [],
        usePathname: () => '/',
    };
});

// Mock WishlistCard to simplify testing
vi.mock('@/components/WishlistCard', () => ({
    WishlistCard: ({ item, onClick, isOwner }: { item: any, onClick: (item: any) => void, isOwner: boolean }) => (
        <div data-testid="wishlist-card" onClick={() => onClick(item)}>
            <span>{item.title}</span>
            <span>{item.price}</span>
            {isOwner && <span>Owner</span>}
        </div>
    ),
    // Export mock enums/types if needed by the component
    Priority: { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' }
}));

// Mocks handled globally in vitest.setup.ts

describe('WishListTab', () => {
    const userId = 'user-123';

    const createMockChain = (data: any = [], error: any = null) => {
        const chain: any = {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            single: vi.fn().mockImplementation(() => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error })),
            maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error })),
            then(resolve: any) {
                return Promise.resolve({ data, error }).then(resolve)
            }
        };
        chain.select.mockReturnValue(chain);
        chain.insert.mockReturnValue(chain);
        chain.update.mockReturnValue(chain);
        chain.delete.mockReturnValue(chain);
        return chain;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // El borrador pendiente vive en `sessionStorage` (el del setup), que no se limpia solo.
        sessionStorage.clear();
        // Los oyentes de foco del test anterior, si alguno quedó, no tienen a quién avisar.
        foco.oyentes.clear();

        // Default success for fetches
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'wishlist_items') {
                return createMockChain([
                    { id: '1', title: 'Item 1', price_numeric: 10, priority: 'medium' },
                    { id: '2', title: 'Item 2', price_numeric: 20, priority: 'high' }
                ]);
            }
            return createMockChain([]);
        });

        (supabase.storage.from as any).mockReturnValue({
            upload: vi.fn().mockResolvedValue({ data: { path: 'test.png' }, error: null }),
            getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'http://example.com/test.png' } })
        });
    });

    it('renders empty state when no items', async () => {
        // Override mock to return empty list
        vi.mocked(supabase.from).mockImplementationOnce(() => createMockChain([]));

        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        await waitFor(() => {
            expect(screen.getByText('Tu lista está vacía')).toBeInTheDocument();
            expect(screen.getByTestId('wishlist-empty-icon')).toBeInTheDocument();
        });
    });

    it('fetches and displays items', async () => {
        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        await waitFor(() => {
            expect(screen.getByText('Deseos')).toBeInTheDocument();
            expect(screen.getByText('Item 1')).toBeInTheDocument();
            expect(screen.getByText('Item 2')).toBeInTheDocument();
            expect(screen.getAllByTestId('wishlist-card')).toHaveLength(2);
        });
    });

    it('el «+» lleva a la pantalla del enlace en vez de abrir el formulario', async () => {
        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        fireEvent.click(screen.getByLabelText('Nuevo deseo'));

        // El formulario no se abre acá: la pantalla del enlace decide **si hay enlace** y qué se
        // pudo leer antes de abrirlo.
        expect(push).toHaveBeenCalledWith('/wishlist/add');
        expect(screen.queryByPlaceholderText('¿Qué deseas?')).not.toBeInTheDocument();
    });

    it('adds a new wish successfully', async () => {
        // El formulario se abre desde un borrador pendiente, que es como lo deja la pantalla del
        // enlace. Se escribe con el módulo real (`savePendingDraft`), sin doblarlo.
        savePendingDraft({ title: 'Borrador inicial', links: ['https://tienda.example/p/1'] });

        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        // El borrador abre el formulario con lo que traía.
        expect(screen.getByPlaceholderText('¿Qué deseas?')).toHaveValue('Borrador inicial');

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('¿Qué deseas?'), { target: { value: 'New Wish' } });
        fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '50' } });

        // Setup mock for insert
        const chain = createMockChain();
        chain.single = vi.fn().mockResolvedValue({ data: { id: '3', title: 'New Wish', price_numeric: 50, priority: 'medium' }, error: null });
        vi.mocked(supabase.from).mockReturnValueOnce(chain as any);

        // Save
        const saveButton = screen.getByText('Guardar');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        expect(screen.getByText('New Wish')).toBeInTheDocument();
    });

    it('un borrador vacío abre el formulario vacío, como el «+» de antes', async () => {
        // `{}` es lo que deja «No tengo enlace»: es un borrador válido, no «no hay nada», y el
        // formulario tiene que abrirse igual que siempre.
        savePendingDraft({});

        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        expect(screen.getByText('Nuevo deseo')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('¿Qué deseas?')).toHaveValue('');
        expect(screen.getByPlaceholderText('https://tienda.com/articulo')).toHaveValue('');
    });

    it('al volver a una lista ya montada se consume el borrador que dejó la pantalla del enlace', async () => {
        // Ir a `/wishlist/add` y volver **no** vuelve a montar la lista: si el borrador solo se
        // leyera al montar, el deseo que esa pantalla acaba de preparar se quedaría sin abrir.
        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        expect(screen.queryByPlaceholderText('¿Qué deseas?')).not.toBeInTheDocument();

        // Es lo que deja `/wishlist/add` justo antes de volver.
        savePendingDraft({ title: 'Vuelto del enlace', links: ['https://tienda.example/p/2'] });

        await act(async () => {
            foco.emitir();
        });

        expect(screen.getByPlaceholderText('¿Qué deseas?')).toHaveValue('Vuelto del enlace');
        expect(screen.getByPlaceholderText('https://tienda.com/articulo')).toHaveValue('https://tienda.example/p/2');
        // Se consume una sola vez: un segundo foco sin borrador no vuelve a abrir nada.
        expect(takePendingDraft()).toBeNull();
    });

    it('edits a wish successfully', async () => {
        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        // Click on "Item 1" card
        fireEvent.click(screen.getByText('Item 1'));

        expect(screen.getByText('Editar deseo')).toBeInTheDocument();
        const titleInput = screen.getByDisplayValue('Item 1');

        fireEvent.change(titleInput, { target: { value: 'Item 1 Updated' } });

        await act(async () => {
            fireEvent.click(screen.getByText('Guardar'));
        });

        expect(screen.getByText('Item 1 Updated')).toBeInTheDocument();
    });

    it('deletes a wish successfully', async () => {
        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        // Click to edit
        fireEvent.click(screen.getByText('Item 1'));

        // Click delete button in form
        const deleteBtn = screen.getByLabelText('Eliminar deseo');

        await act(async () => {
            fireEvent.click(deleteBtn);
        });

        // Verify ConfirmModal appears
        expect(screen.getByText('Eliminar deseo')).toBeInTheDocument();
        expect(screen.getByText(/¿Estás seguro de que quieres eliminar este deseo?/)).toBeInTheDocument();

        // Click confirm in modal
        const confirmBtn = screen.getByRole('button', { name: 'Eliminar' });
        await act(async () => {
            fireEvent.click(confirmBtn);
        });

        // Verify item is gone
        expect(screen.queryByText('Item 1')).not.toBeInTheDocument();

        // El borrado va contra wishlist_items y no inserta aviso: lo hace el trigger de la base.
        expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('wishlist_items');
        expect(vi.mocked(supabase.from).mock.calls.map(([table]) => table)).not.toContain('notifications');
    });

    it('should sort items by priority', async () => {
        // Mock items with different priorities
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'wishlist_items') {
                return createMockChain([
                    { id: '1', title: 'A_Low', priority: 'low' },
                    { id: '2', title: 'B_High', priority: 'high' },
                    { id: '3', title: 'C_Medium', priority: 'medium' }
                ]);
            }
            return createMockChain([]);
        });

        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        // Initial render (by name A, B, C)
        const items = screen.getAllByTestId('wishlist-card');
        expect(items[0]).toHaveTextContent('A_Low');
        expect(items[1]).toHaveTextContent('B_High');
        expect(items[2]).toHaveTextContent('C_Medium');

        // Click sort by priority
        const sortBtn = screen.getByLabelText('Ordenar por prioridad');
        await act(async () => {
            fireEvent.click(sortBtn);
        });

        // Expect High > Medium > Low
        await waitFor(() => {
            const sortedItems = screen.getAllByTestId('wishlist-card');
            expect(sortedItems[0]).toHaveTextContent('B_High');
            expect(sortedItems[1]).toHaveTextContent('C_Medium');
            expect(sortedItems[2]).toHaveTextContent('A_Low');
        });
    });

    describe('la moneda del precio (T7)', () => {
        const cadenaDelGuardado = (fila: Record<string, unknown>) => {
            const chain = createMockChain();
            chain.single = vi.fn().mockResolvedValue({ data: fila, error: null });
            vi.mocked(supabase.from).mockReturnValueOnce(chain as any);
            return chain;
        };

        it('con precio y sin elegir moneda guarda EUR, que es el valor por defecto', async () => {
            savePendingDraft({});
            await act(async () => {
                render(<WishListTab userId={userId} />);
            });

            fireEvent.change(screen.getByPlaceholderText('¿Qué deseas?'), { target: { value: 'Regalo' } });
            fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '50' } });

            const chain = cadenaDelGuardado({ id: '9', title: 'Regalo', price_numeric: 50, currency: 'EUR', priority: 'medium' });
            await act(async () => {
                fireEvent.click(screen.getByText('Guardar'));
            });

            expect(chain.insert.mock.calls[0][0]).toMatchObject({ price_numeric: 50, currency: 'EUR' });
        });

        it('guarda la moneda que elige el usuario en el selector', async () => {
            savePendingDraft({});
            await act(async () => {
                render(<WishListTab userId={userId} />);
            });

            fireEvent.change(screen.getByPlaceholderText('¿Qué deseas?'), { target: { value: 'Regalo' } });
            fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '50' } });
            await act(async () => {
                fireEvent.click(screen.getByText('US$'));
            });

            const chain = cadenaDelGuardado({ id: '9', title: 'Regalo', price_numeric: 50, currency: 'USD', priority: 'medium' });
            await act(async () => {
                fireEvent.click(screen.getByText('Guardar'));
            });

            expect(chain.insert.mock.calls[0][0]).toMatchObject({ currency: 'USD' });
        });

        it('sin precio no guarda moneda: no hay nada que denominar', async () => {
            savePendingDraft({});
            await act(async () => {
                render(<WishListTab userId={userId} />);
            });

            fireEvent.change(screen.getByPlaceholderText('¿Qué deseas?'), { target: { value: 'Solo titulo' } });

            const chain = cadenaDelGuardado({ id: '10', title: 'Solo titulo', priority: 'medium' });
            await act(async () => {
                fireEvent.click(screen.getByText('Guardar'));
            });

            expect(chain.insert.mock.calls[0][0]).toMatchObject({ price_numeric: null, currency: null });
        });

        it('el selector arranca en EUR al abrir un deseo nuevo', async () => {
            savePendingDraft({});
            await act(async () => {
                render(<WishListTab userId={userId} />);
            });

            expect(screen.getByText('€ EUR').closest('[aria-pressed]')).toHaveAttribute('aria-pressed', 'true');
        });
    });
});
