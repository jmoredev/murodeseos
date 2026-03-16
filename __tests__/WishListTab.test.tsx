import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WishListTab } from '@/components/WishListTab';
import { supabase } from '@/lib/supabase';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();

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

        // Default success for fetches
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'wishlist_items') {
                return createMockChain([
                    { id: '1', title: 'Item 1', price: '10', priority: 'medium' },
                    { id: '2', title: 'Item 2', price: '20', priority: 'high' }
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
            expect(screen.getByText('🎁')).toBeInTheDocument();
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

    it('opens add modal when clicking plus button', async () => {
        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        const addBtn = screen.getByLabelText('Nuevo deseo');
        fireEvent.click(addBtn);

        expect(screen.getByText('Nuevo deseo')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('¿Qué deseas?')).toBeInTheDocument();
    });

    it('adds a new wish successfully', async () => {
        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        // Open modal
        fireEvent.click(screen.getByLabelText('Nuevo deseo'));

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('¿Qué deseas?'), { target: { value: 'New Wish' } });
        fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '50' } });

        // Setup mock for insert
        const chain = createMockChain();
        chain.single = vi.fn().mockResolvedValue({ data: { id: '3', title: 'New Wish', price: '50', priority: 'medium' }, error: null });
        vi.mocked(supabase.from).mockReturnValueOnce(chain as any);

        // Save
        const saveButton = screen.getByText('Guardar');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        expect(screen.getByText('New Wish')).toBeInTheDocument();
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
});
