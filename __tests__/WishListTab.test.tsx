import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WishListTab } from '@/components/WishListTab';
import { supabase } from '@/lib/supabase';

// Mock WishlistCard to simplify testing
jest.mock('@/components/WishlistCard', () => ({
    WishlistCard: ({ item, onClick, isOwner }) => (
        <div data-testid="wishlist-card" onClick={() => onClick(item)}>
            <span>{item.title}</span>
            <span>{item.price}</span>
            {isOwner && <span>Owner</span>}
        </div>
    ),
    // Export mock enums/types if needed by the component
    Priority: { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' }
}));

// Setup local mocks for Supabase
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

// Overwrite the global mock implementation for this suite
// Note: We need to handle the chainable methods
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn((...args) => {
                mockSelect(...args);
                return {
                    eq: jest.fn((...args) => ({
                        order: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                };
            }),
            insert: jest.fn((...args) => {
                mockInsert(...args);
                return {
                    select: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({ data: { id: 'new-id', title: 'New Item' }, error: null }))
                    }))
                };
            }),
            update: jest.fn((...args) => {
                mockUpdate(...args);
                return {
                    eq: jest.fn(() => Promise.resolve({ error: null }))
                };
            }),
            delete: jest.fn((...args) => {
                mockDelete(...args);
                return {
                    eq: jest.fn(() => Promise.resolve({ error: null }))
                };
            })
        })),
        storage: {
            from: jest.fn(() => ({
                upload: jest.fn((...args) => {
                    mockUpload(...args);
                    return Promise.resolve({ error: null });
                }),
                getPublicUrl: jest.fn((...args) => {
                    mockGetPublicUrl(...args);
                    return { data: { publicUrl: 'https://example.com/image.jpg' } };
                })
            }))
        }
    }
}));

describe('WishListTab', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();

        // Default success for fetches
        (supabase.from as jest.Mock).mockImplementation((table) => {
            if (table === 'wishlist_items') {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            order: jest.fn().mockResolvedValue({
                                data: [
                                    { id: '1', title: 'Item 1', price: '10', priority: 'medium' },
                                    { id: '2', title: 'Item 2', price: '20', priority: 'high' }
                                ],
                                error: null
                            })
                        })
                    }),
                    insert: jest.fn().mockReturnValue({
                        select: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({ data: { id: '3', title: 'New Wish', price: '50', priority: 'medium' }, error: null })
                        })
                    }),
                    update: jest.fn().mockReturnValue({
                        eq: jest.fn().mockResolvedValue({ error: null })
                    }),
                    delete: jest.fn().mockReturnValue({
                        eq: jest.fn().mockResolvedValue({ error: null })
                    })
                };
            }
            return { select: jest.fn() };
        });
    });

    it('renders empty state when no items', async () => {
        // Override mock to return empty list
        (supabase.from as jest.Mock).mockImplementationOnce(() => ({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({ data: [], error: null })
                })
            })
        }));

        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        expect(screen.getByText('Tu lista está vacía')).toBeInTheDocument();
        expect(screen.getByText('🎁')).toBeInTheDocument();
    });

    it('fetches and displays items', async () => {
        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        expect(screen.getByText('Mi lista de deseos')).toBeInTheDocument();
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
        expect(screen.getAllByTestId('wishlist-card')).toHaveLength(2);
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
        fireEvent.change(screen.getByPlaceholderText('Ej: 25.00'), { target: { value: '50' } });

        // Save
        const saveButton = screen.getByText('Guardar');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        // Verify Supabase insert call
        // Note: We check the specific sequence in chain if needed, but here we trust our mock implementation returns success
        // We verify the item appears using mocking behavior

        // Since logic updates state optimistically or re-fetches?
        // In the component: 
        // const newItem = { ... }; setItems([newItem, ...items]);

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
        // Mock window.confirm
        window.confirm = jest.fn(() => true);

        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        // Click to edit
        fireEvent.click(screen.getByText('Item 1'));

        // Click delete
        const deleteBtn = screen.getByLabelText('Eliminar deseo');

        await act(async () => {
            fireEvent.click(deleteBtn);
        });

        expect(window.confirm).toHaveBeenCalled();
        expect(screen.queryByText('Item 1')).not.toBeInTheDocument();

    });

    it('handles image upload', async () => {
        await act(async () => {
            render(<WishListTab userId={userId} />);
        });

        // Open modal
        fireEvent.click(screen.getByLabelText('Nuevo deseo'));

        // Find file input - it's hidden but we can target by type="file"
        // Since it's hidden `display: none` usually, fireEvent.change still works on the element if we can select it.
        // It has a ref, so we can try selecting by container or just `screen.getByLabelText` if we had one.
        // Since no label, we can select by container:
        const container = screen.getByText('Nuevo deseo').closest('div')?.parentElement;
        const fileInput = container?.querySelector('input[type="file"]');

        const file = new File(['(⌐□_□)'], 'chucknorris.png', { type: 'image/png' });

        await act(async () => {
            fireEvent.change(fileInput!, { target: { files: [file] } });
        });

        // Verify upload called
        await waitFor(() => {
            const urlInput = screen.getByPlaceholderText('Pegar URL de imagen...') as HTMLInputElement;
            expect(urlInput.value).toBe('https://example.com/image.jpg');
        });
    });

    it('should sort items by priority', async () => {
        // Mock items with different priorities
        (supabase.from as jest.Mock).mockImplementation((table) => {
            if (table === 'wishlist_items') {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            order: jest.fn().mockResolvedValue({
                                data: [
                                    { id: '1', title: 'A_Low', priority: 'low' },
                                    { id: '2', title: 'B_High', priority: 'high' },
                                    { id: '3', title: 'C_Medium', priority: 'medium' }
                                ],
                                error: null
                            })
                        })
                    })
                };
            }
            return { select: jest.fn() };
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
        const sortBtn = screen.getByText('Por prioridad');
        await act(async () => {
            fireEvent.click(sortBtn);
        });

        // Expect High > Medium > Low
        const sortedItems = screen.getAllByTestId('wishlist-card');
        expect(sortedItems[0]).toHaveTextContent('B_High');
        expect(sortedItems[1]).toHaveTextContent('C_Medium');
        expect(sortedItems[2]).toHaveTextContent('A_Low');
    });
});
