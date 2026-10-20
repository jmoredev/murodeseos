import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { WishlistCard } from '@/components/WishlistCard';
import { WishDetailModal } from '@/components/WishDetailModal';

const item = (extra: any = {}) => ({
    id: 'i-1',
    title: 'Cafetera',
    links: [],
    price: 25,
    priority: 'high' as const,
    ...extra,
});

describe('precio con moneda en las superficies que lo pintan (T7 · S6)', () => {
    it('tarjeta sin moneda: sólo el número', () => {
        render(<WishlistCard item={item() as any} isOwner />);
        expect(screen.getByText('25,00')).toBeInTheDocument();
    });

    it('tarjeta con EUR: el símbolo del euro', () => {
        render(<WishlistCard item={item({ currency: 'EUR' }) as any} isOwner />);
        expect(screen.getByText(/^25,00\s€$/)).toBeInTheDocument();
    });

    it('tarjeta con USD: el símbolo del dólar y ningún euro', () => {
        render(<WishlistCard item={item({ currency: 'USD' }) as any} isOwner />);
        expect(screen.getByText(/25,00\sUS\$/)).toBeInTheDocument();
        expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    });

    it('detalle sin moneda: sólo el número', () => {
        render(<WishDetailModal visible item={item() as any} onClose={() => {}} isOwner />);
        expect(screen.getByText('25,00')).toBeInTheDocument();
        expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    });

    it('detalle con EUR: el símbolo aparece una sola vez', () => {
        render(<WishDetailModal visible item={item({ currency: 'EUR' }) as any} onClose={() => {}} isOwner />);
        expect(screen.getByText(/^25,00\s€$/)).toBeInTheDocument();
        expect(screen.queryByText(/€\s*€/)).not.toBeInTheDocument();
    });

    it('detalle con USD: el símbolo del dólar y ningún euro', () => {
        render(<WishDetailModal visible item={item({ currency: 'USD' }) as any} onClose={() => {}} isOwner />);
        expect(screen.getByText(/25,00\sUS\$/)).toBeInTheDocument();
        expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    });
});
