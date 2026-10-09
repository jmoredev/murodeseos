import React, { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBackToClose } from '@/lib/use-back-to-close';

/**
 * Arnés mínimo, con la misma forma que los modales reales: un estado `abierto` y
 * un cierre. El `onClose` se crea **en línea** a propósito, como hacen
 * `WishListTab` y `WishDetailModal`: si el hook dependiera del callback,
 * re-renderizar empujaría una entrada de historial nueva en cada render.
 */
function ModalDePrueba({ onCerrar }: { onCerrar: () => void }) {
    const [abierto, setAbierto] = useState(false);
    useBackToClose(abierto, () => {
        setAbierto(false);
        onCerrar();
    });

    return (
        <div>
            <button onClick={() => setAbierto(true)}>abrir</button>
            <button onClick={() => setAbierto(false)}>cerrar con la X</button>
            <span data-testid="estado">{abierto ? 'abierto' : 'cerrado'}</span>
        </div>
    );
}

describe('useBackToClose: el gesto de atrás cierra lo que abriste', () => {
    let pushState: ReturnType<typeof vi.spyOn>;
    let back: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Aislar cada caso: el historial de jsdom es global al fichero.
        window.history.replaceState(null, '');
        pushState = vi.spyOn(window.history, 'pushState');
        back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('abrir empuja UNA entrada de historial', () => {
        render(<ModalDePrueba onCerrar={vi.fn()} />);

        fireEvent.click(screen.getByText('abrir'));

        expect(screen.getByTestId('estado').textContent).toBe('abierto');
        expect(pushState).toHaveBeenCalledTimes(1);
    });

    it('re-renderizar mientras está abierto NO empuja otra entrada', () => {
        // El fallo clásico de este patrón: un callback en las dependencias del
        // efecto hace que cada render empuje otra entrada y el gesto necesite
        // varios toques para cerrar.
        const { rerender } = render(<ModalDePrueba onCerrar={vi.fn()} />);
        fireEvent.click(screen.getByText('abrir'));
        expect(pushState).toHaveBeenCalledTimes(1);

        rerender(<ModalDePrueba onCerrar={vi.fn()} />);
        fireEvent.click(screen.getByText('cerrar con la X'));
        fireEvent.click(screen.getByText('abrir'));
        // La segunda apertura empuja la segunda entrada; no más.
        expect(pushState).toHaveBeenCalledTimes(2);
    });

    it('el gesto de atrás CIERRA el modal, en vez de salir de la app', () => {
        const onCerrar = vi.fn();
        render(<ModalDePrueba onCerrar={onCerrar} />);
        fireEvent.click(screen.getByText('abrir'));

        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });

        expect(screen.getByTestId('estado').textContent).toBe('cerrado');
        expect(onCerrar).toHaveBeenCalledTimes(1);
        // El gesto ya consumió la entrada: no hay que retirar nada.
        expect(back).not.toHaveBeenCalled();
    });

    it('cerrar con la X retira la entrada que se empujó, para no dejar un hueco', () => {
        render(<ModalDePrueba onCerrar={vi.fn()} />);
        fireEvent.click(screen.getByText('abrir'));

        fireEvent.click(screen.getByText('cerrar con la X'));

        expect(screen.getByTestId('estado').textContent).toBe('cerrado');
        // Sin esto, cada apertura dejaría una entrada muerta en el historial y el
        // usuario tendría que pulsar atrás varias veces para salir de la pantalla.
        expect(back).toHaveBeenCalledTimes(1);
    });

    it('si no está abierto, no toca el historial', () => {
        render(<ModalDePrueba onCerrar={vi.fn()} />);

        expect(pushState).not.toHaveBeenCalled();
        expect(back).not.toHaveBeenCalled();
    });
});
