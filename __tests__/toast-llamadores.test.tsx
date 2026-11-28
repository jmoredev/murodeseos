import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '@/components/Toast';

/**
 * Los cuatro llamadores reales (WishListTab, GroupsTab, WishLinkChip y el detalle
 * de deseo) usan `useToast` con `showToast(mensaje, tipo)`. El rediseño de T2a
 * cambió el brindis por dentro; esto fija que ese camino sigue igual para ellos.
 */
function Llamadores() {
    const { showToast, ToastComponent } = useToast();
    return (
        <div>
            <button type="button" onClick={() => showToast('Deseo guardado')}>ok</button>
            <button type="button" onClick={() => showToast('Error al guardar el deseo.', 'error')}>err</button>
            {ToastComponent}
        </div>
    );
}

describe('Toast · camino de los llamadores reales (S7, riesgo 3)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('un brindis de éxito con showToast(message) desaparece a los 3 s', () => {
        render(<Llamadores />);
        fireEvent.click(screen.getByText('ok'));
        expect(screen.getByText('Deseo guardado')).toBeInTheDocument();
        act(() => { vi.advanceTimersByTime(3000); });
        act(() => { vi.advanceTimersByTime(300); });
        expect(screen.queryByText('Deseo guardado')).not.toBeInTheDocument();
    });

    it('el de error se queda, pero siempre se puede cerrar (no deja un aviso atrapado)', () => {
        render(<Llamadores />);
        fireEvent.click(screen.getByText('err'));
        act(() => { vi.advanceTimersByTime(120_000); });
        expect(screen.getByRole('alert')).toHaveTextContent('Error al guardar el deseo.');
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar el aviso' }));
        act(() => { vi.advanceTimersByTime(400); });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
