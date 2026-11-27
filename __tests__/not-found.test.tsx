import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import NotFoundScreen from '@/app/+not-found';

/**
 * Página no encontrada (12 · P6): dice qué pasa, da dos salidas —Inicio y Mi lista— y explica lo
 * de los enlaces de invitación, que es la causa más frecuente de llegar aquí.
 *
 * La copy vieja («Esta página no existe.» + un enlace a inicio) se sustituye por la del artboard;
 * los dos destinos son los de siempre: `/` y `/?tab=wishlist`.
 */
const { push, replace, back } = vi.hoisted(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
}));

vi.mock('expo-router', () => ({
    useRouter: () => ({ push, replace, back }),
    Stack: { Screen: () => null },
}));

describe('+not-found', () => {
    it('explica que la dirección no existe', () => {
        render(<NotFoundScreen />);

        expect(screen.getByText('Página no encontrada')).toBeInTheDocument();
        expect(
            screen.getByText(
                'Esta dirección no existe o ha dejado de existir. Si vienes de un enlace, puede que esté mal copiado.',
            ),
        ).toBeInTheDocument();
        expect(screen.queryByText('Esta página no existe.')).not.toBeInTheDocument();
    });

    it('«Ir a Inicio» lleva a la portada', () => {
        render(<NotFoundScreen />);

        fireEvent.click(screen.getByRole('button', { name: 'Ir a Inicio' }));

        expect(push).toHaveBeenCalledWith('/');
    });

    it('«Abrir Mi lista» lleva a la pestaña de la lista', () => {
        render(<NotFoundScreen />);

        fireEvent.click(screen.getByRole('button', { name: 'Abrir Mi lista' }));

        // expo-router compone `pathname` + `params` en `/?tab=wishlist` (el destino que pide el
        // artboard). Se usa la forma tipada porque el proyecto tiene `typedRoutes` activado.
        expect(push).toHaveBeenCalledWith({ pathname: '/', params: { tab: 'wishlist' } });
    });

    it('explica por qué un enlace de invitación puede acabar aquí', () => {
        render(<NotFoundScreen />);

        expect(
            screen.getByText(
                'Los enlaces de invitación abren un grupo concreto. Si esperabas uno, pídelo otra vez a quien te invitó.',
            ),
        ).toBeInTheDocument();
    });

    it('no usa hex sueltos: la pantalla sale de tokens', () => {
        const fuente = readFileSync(join(__dirname, '..', 'app', '+not-found.tsx'), 'utf8');
        expect(fuente).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
});
