import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast, useToast } from '@/components/Toast';

/**
 * El brindis (12 · P7–P9, nota 3). Lo que cambia respecto al de hoy:
 *
 * 1. lleva **acción** («Deshacer»/«Reintentar») cuando hay algo que deshacer o reintentar, y
 *    entonces **no** lleva además una ×: dos botones competirían por el mismo sitio;
 * 2. el de **error no se va solo**: si desapareciera sin más, el aviso se quedaría sin leer y sin
 *    decir por qué;
 * 3. la API sigue siendo la misma para los cuatro llamadores de hoy (ninguno pasa acción).
 */
function avanzar(ms: number) {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('Toast', () => {
    it('sin acción se va solo y se cierra con la × (API de hoy, sin cambios)', () => {
        const onClose = vi.fn();
        render(<Toast message="Deseo guardado" onClose={onClose} />);

        expect(screen.getByText('Deseo guardado')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cerrar el aviso' })).toBeInTheDocument();

        avanzar(3000);
        avanzar(300);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('con acción, la acción sustituye a la ×', () => {
        const onClose = vi.fn();
        const onPress = vi.fn();
        render(
            <Toast
                message="«Cafetera italiana Bialetti» se ha movido a Recibidos"
                action={{ label: 'Deshacer', onPress }}
                onClose={onClose}
            />,
        );

        const accion = screen.getByRole('button', { name: 'Deshacer' });
        expect(accion).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cerrar el aviso' })).not.toBeInTheDocument();

        fireEvent.click(accion);
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('la acción da tiempo a pulsarla: sigue en pantalla más allá de los 3 s del cierre normal', () => {
        const onClose = vi.fn();
        render(
            <Toast
                message="Se ha movido a Recibidos"
                action={{ label: 'Deshacer', onPress: vi.fn() }}
                onClose={onClose}
            />,
        );

        avanzar(6000);
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument();
    });

    it('el brindis de error no se va solo: espera a que se cierre o se reintente', () => {
        const onClose = vi.fn();
        render(<Toast message="No se ha podido marcar como leído" type="error" onClose={onClose} />);

        expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido marcar como leído');

        avanzar(60_000);
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Cerrar el aviso' }));
        avanzar(300);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('el de error con «Reintentar» tampoco se va solo y se anuncia como alerta', () => {
        const onPress = vi.fn();
        render(
            <Toast
                message="No se ha podido marcar como leído"
                type="error"
                action={{ label: 'Reintentar', onPress }}
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByRole('alert')).toBeInTheDocument();
        avanzar(60_000);
        expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('el de confirmación se anuncia como estado, sin robar el foco', () => {
        render(<Toast message="Deseo guardado" onClose={vi.fn()} />);

        const estado = screen.getByRole('status');
        expect(estado).toHaveAttribute('aria-live', 'polite');
        expect(estado).toHaveTextContent('Deseo guardado');
    });

    it('useToast sigue devolviendo lo de siempre y admite la acción como tercer argumento', () => {
        function Demo() {
            const { showToast, ToastComponent } = useToast();
            const onPress = vi.fn();
            return (
                <div>
                    <button type="button" onClick={() => showToast('Se ha movido a Recibidos', 'success', { action: { label: 'Deshacer', onPress } })}>
                        mostrar
                    </button>
                    {ToastComponent}
                </div>
            );
        }
        render(<Demo />);

        fireEvent.click(screen.getByRole('button', { name: 'mostrar' }));
        expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument();
    });

    it('no usa hex sueltos: el brindis oscuro sale del token `ink`', () => {
        const fuente = readFileSync(join(__dirname, '..', 'components', 'Toast.tsx'), 'utf8');
        expect(fuente).toContain('bg-ink');
        expect(fuente).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
});
