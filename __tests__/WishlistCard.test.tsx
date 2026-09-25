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
        reservationState: 'available'
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
        // Enlace recortado y clickeable
        expect(screen.getByRole('link', { name: /example\.com/i })).toBeInTheDocument();
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

    it('does not call onClick when reserving', () => {
        const onReserve = vi.fn();
        render(
            <WishlistCard
                item={{ ...mockItem, reservationState: 'available' }}
                isOwner={false}
                onClick={mockOnClick}
                onReserve={onReserve}
            />
        );

        fireEvent.click(screen.getByTestId('wish-reserve-button'));
        expect(onReserve).toHaveBeenCalledWith(expect.objectContaining({ id: mockItem.id }));
        expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('renders the reserved state for a viewer when another user reserved it', () => {
        const onReserve = vi.fn();
        render(
            <WishlistCard
                item={{ ...mockItem, reservationState: 'reserved_by_other' }}
                isOwner={false}
                onReserve={onReserve}
            />
        );

        expect(screen.getByText('🔒 Reservado')).toBeInTheDocument();
        expect(screen.getByText('No disponible')).toBeInTheDocument();
        expect(screen.queryByTestId('wish-reserve-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('wish-cancel-reserve-button')).not.toBeInTheDocument();
    });

    it('renders the mine state and cancel action for a viewer who reserved it', () => {
        const onCancelReserve = vi.fn();
        render(
            <WishlistCard
                item={{ ...mockItem, reservationState: 'reserved_by_me' }}
                isOwner={false}
                onCancelReserve={onCancelReserve}
            />
        );

        expect(screen.getByText('✓ Reservado por ti')).toBeInTheDocument();
        expect(screen.getByTestId('wish-cancel-reserve-button')).toBeInTheDocument();
        expect(screen.queryByTestId('wish-reserve-button')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('wish-cancel-reserve-button'));
        expect(onCancelReserve).toHaveBeenCalledWith(expect.objectContaining({ id: mockItem.id }));
    });
});
