import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WishlistCard, GiftItem } from '@/components/WishlistCard';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('WishlistCard', () => {
    const mockItem: GiftItem = {
        id: '1',
        title: 'Test Gift',
        links: ['https://example.com'],
        imageUrl: 'https://example.com/image.jpg',
        price: '25',
        notes: 'Some notes',
        priority: 'high',
        reservedBy: null
    };

    const mockOnClick = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly with all props', () => {
        render(<WishlistCard item={mockItem} isOwner={true} onClick={mockOnClick} />);

        expect(screen.getByText('Test Gift')).toBeInTheDocument();
        expect(screen.getByText('Some notes')).toBeInTheDocument();
        // Priority badge
        expect(screen.getByText(/Prioridad Alta/i)).toBeInTheDocument();
        // Link count
        expect(screen.getByText(/🔗 1/)).toBeInTheDocument();
        // Image
        const img = screen.getByLabelText(mockItem.title);
        expect(img).toBeInTheDocument();
    });

    it('formats price with Euro symbol correctly', () => {
        render(<WishlistCard item={mockItem} isOwner={true} />);
        expect(screen.getByText('25 €')).toBeInTheDocument();
    });

    it('displays "Sin precio" when price is missing', () => {
        const itemWithoutPrice = { ...mockItem, price: undefined };
        render(<WishlistCard item={itemWithoutPrice} isOwner={true} />);
        expect(screen.getByText('Sin precio')).toBeInTheDocument();
    });

    it('renders different priority badges', () => {
        const lowPriorityItem: GiftItem = { ...mockItem, priority: 'low' };
        const { rerender } = render(<WishlistCard item={lowPriorityItem} isOwner={true} />);
        expect(screen.getByText(/Prioridad Baja/i)).toBeInTheDocument();

        const mediumPriorityItem: GiftItem = { ...mockItem, priority: 'medium' };
        rerender(<WishlistCard item={mediumPriorityItem} isOwner={true} />);
        expect(screen.getByText(/Prioridad Media/i)).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        render(<WishlistCard item={mockItem} isOwner={true} onClick={mockOnClick} />);

        fireEvent.click(screen.getByText('Test Gift'));
        expect(mockOnClick).toHaveBeenCalledWith(mockItem);
    });
});
