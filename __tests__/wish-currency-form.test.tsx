import React, { useEffect } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WishListTab } from '@/components/WishListTab';
import { supabase } from '@/lib/supabase';
import { savePendingDraft } from '@/lib/share-draft';

vi.mock('expo-router', () => {
    function useFocusEffect(cb: any) {
        useEffect(() => {
            const l = cb();
            return () => {
                if (typeof l === 'function') l();
            };
        }, [cb]);
    }
    return {
        useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), setParams: vi.fn() }),
        useLocalSearchParams: () => ({}),
        useGlobalSearchParams: () => ({}),
        Link: ({ children }: any) => children,
        useFocusEffect,
        useSegments: () => [],
        usePathname: () => '/',
    };
});

const Q = { title: '¿Qué deseas?', price: '0,00' };

function createChain(data: any = []) {
    return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then(resolve: any) {
            return Promise.resolve({ data, error: null }).then(resolve);
        },
    };
}

async function montar(draft: any = {}) {
    savePendingDraft(draft);
    await act(async () => {
        render(<WishListTab userId="u-1" />);
    });
}

async function guardar(row: Record<string, unknown>) {
    const c: any = createChain(row);
    vi.mocked(supabase.from).mockReturnValueOnce(c as any);
    await act(async () => {
        fireEvent.click(screen.getByText('Guardar'));
    });
    return { c };
}

const insertado = (c: any) => c.insert.mock.calls[0][0];

beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(supabase.from).mockImplementation(() => createChain([]) as any);
});

describe('moneda del deseo (T7 · S6)', () => {
    it('sin elegir nada con precio guarda EUR, que es el valor por defecto', async () => {
        await montar({});
        fireEvent.change(screen.getByPlaceholderText(Q.title), { target: { value: 'R' } });
        fireEvent.change(screen.getByPlaceholderText(Q.price), { target: { value: '50' } });
        const { c } = await guardar({ id: '9', title: 'R', price_numeric: 50, currency: 'EUR', priority: 'medium' });
        expect(insertado(c)).toMatchObject({ price_numeric: 50, currency: 'EUR' });
    });

    it('guarda la moneda que el usuario elige', async () => {
        await montar({});
        fireEvent.change(screen.getByPlaceholderText(Q.title), { target: { value: 'R' } });
        fireEvent.change(screen.getByPlaceholderText(Q.price), { target: { value: '50' } });
        await act(async () => {
            fireEvent.click(screen.getByText('US$'));
        });
        const { c } = await guardar({ id: '9', title: 'R', price_numeric: 50, currency: 'USD', priority: 'medium' });
        expect(insertado(c)).toMatchObject({ currency: 'USD' });
    });

    it('sin precio no guarda moneda: no hay nada que denominar', async () => {
        await montar({});
        fireEvent.change(screen.getByPlaceholderText(Q.title), { target: { value: 'Solo' } });
        const { c } = await guardar({ id: '11', title: 'Solo', priority: 'medium' });
        expect(insertado(c)).toMatchObject({ price_numeric: null, currency: null });
    });

    it('elegir «Sin moneda» guarda currency null y no se lo pisa con EUR', async () => {
        await montar({});
        fireEvent.change(screen.getByPlaceholderText(Q.title), { target: { value: 'R' } });
        fireEvent.change(screen.getByPlaceholderText(Q.price), { target: { value: '50' } });
        await act(async () => {
            fireEvent.click(screen.getByText('Sin moneda'));
        });
        expect(screen.getByText('Sin moneda').closest('[aria-pressed]')).toHaveAttribute('aria-pressed', 'true');
        const { c } = await guardar({ id: '9', title: 'R', price_numeric: 50, currency: null, priority: 'medium' });
        expect(insertado(c)).toMatchObject({ price_numeric: 50, currency: null });
    });

    it('un borrador compartido sin moneda no se convierte en EUR', async () => {
        await montar({ title: 'Auris', priceText: '10,00', currency: null });
        expect(screen.getByText('Sin moneda').closest('[aria-pressed]')).toHaveAttribute('aria-pressed', 'true');
        const { c } = await guardar({ id: '10', title: 'Auris', price_numeric: 10, currency: null, priority: 'medium' });
        expect(insertado(c)).toMatchObject({ currency: null });
    });

    it('regresión: las notas arrancan vacías y se siguen guardando', async () => {
        await montar({ title: 'Lámpara', priceText: '89,99', currency: 'EUR' });
        expect(screen.getByPlaceholderText('Talla, color, detalles...')).toHaveValue('');
        fireEvent.change(screen.getByPlaceholderText('Talla, color, detalles...'), { target: { value: 'Talla M' } });
        const { c } = await guardar({
            id: '13',
            title: 'Lámpara',
            price_numeric: 89.99,
            currency: 'EUR',
            priority: 'medium',
            notes: 'Talla M',
        });
        expect(insertado(c)).toMatchObject({ notes: 'Talla M' });
    });

    it('regresión: el campo de precio sigue mostrando un número pelado', async () => {
        await montar({ title: 'Lámpara', priceText: '89,99', currency: 'USD' });
        expect(screen.getByPlaceholderText(Q.price)).toHaveValue('89,99');
    });
});
