import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BootScreen } from '@/components/BootScreen';

/**
 * Primer arranque (12 · P1). Hoy, mientras el árbol de la app no está listo, se pinta un fondo
 * liso (`app/_layout.tsx`) y, cuando toca la portada, un círculo girando con «Cargando...»
 * (`app/index.tsx`). La pantalla de arranque dice **qué** está pasando y cuánto puede tardar.
 */
const raiz = join(__dirname, '..');

function leer(relativo: string) {
    return readFileSync(join(raiz, relativo), 'utf8');
}

const COPY = [
    'Muro de Deseos',
    'Listas de deseos compartidas',
    'Preparando tu muro. La primera vez suele tardar unos segundos.',
];

describe('BootScreen', () => {
    it('dice el nombre de la app, qué es y qué está haciendo', () => {
        render(<BootScreen />);

        for (const texto of COPY) {
            expect(screen.getByText(texto)).toBeInTheDocument();
        }
    });

    it('anuncia el arranque a los lectores de pantalla con un estado', () => {
        render(<BootScreen />);

        const estado = screen.getByRole('status');
        expect(estado).toHaveAttribute('aria-live', 'polite');
        expect(estado).toHaveTextContent('Cargando la aplicación. Preparando tu muro de deseos.');
    });

    it('se puede leer aunque Nunito no haya cargado todavía', () => {
        // Esta pantalla existe justamente mientras las fuentes cargan: si el texto quedara
        // invisible o en una cara que aún no está, sería el mismo hueco vacío con más pasos.
        render(<BootScreen />);

        for (const texto of [...COPY, 'Cargando la aplicación. Preparando tu muro de deseos.']) {
            const nodo = screen.getByText(texto);
            expect(nodo.getAttribute('style') ?? '', texto).toContain('system-ui');
        }
    });

    it('el icono de la marca es decorativo y la rueda de carga también', () => {
        const { container } = render(<BootScreen />);

        for (const decorativo of container.querySelectorAll('[aria-hidden="true"]')) {
            // Ni el tile del icono ni la rueda aportan información por sí solos: el texto ya la da.
            expect(decorativo).toBeInTheDocument();
        }
        expect(container.querySelector('[data-testid="spinner"]')).toHaveAttribute('aria-hidden', 'true');
    });

    it('no usa hex sueltos: el fondo, la tinta y la rueda salen de tokens', () => {
        const fuente = leer('components/BootScreen.tsx');

        expect(fuente).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });

    it('la portada y el layout la usan en vez del círculo con «Cargando...»', () => {
        expect(leer('app/index.tsx')).toMatch(/<BootScreen\s*\/>/);
        // El círculo girando de antes tenía `animate-spin`: ya no queda ninguna rueda suelta.
        expect(leer('app/index.tsx')).not.toContain('animate-spin');
        expect(leer('app/_layout.tsx')).toMatch(/<BootScreen\s*\/>/);
    });
});
