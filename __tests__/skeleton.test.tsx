import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Skeleton, SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton';

/**
 * El esqueleto reserva el hueco del contenido mientras carga (12 · P2/P3, nota 1): los títulos y
 * las pestañas son reales y sólo el contenido es un bloque. Es una pieza **decorativa**: el
 * anuncio de «cargando» lo hace la pantalla con un `role="status"`, no cada bloque.
 *
 * S9: en T2a se crea el componente y **no** se conecta a ninguna pestaña (eso es T3/T4/T6/T10);
 * se comprueba abajo, leyendo las tres pestañas.
 */
const raiz = join(__dirname, '..');

function leer(relativo: string) {
    return readFileSync(join(raiz, relativo), 'utf8');
}

function estilo(elemento: Element): CSSStyleDeclaration {
    return (elemento as HTMLElement).style;
}

/**
 * react-native-web descompone `borderRadius` en las cuatro esquinas, así que el radio se lee de
 * la esquina superior izquierda (las cuatro son iguales en un bloque del esqueleto).
 */
function radio(elemento: Element): number {
    return Number.parseFloat(estilo(elemento).borderTopLeftRadius);
}

describe('Skeleton', () => {
    it('es decorativo: no entra en el árbol de accesibilidad y no pinta texto', () => {
        const { container } = render(<Skeleton testID="bloque" />);

        const bloque = container.querySelector('[data-testid="bloque"]') as HTMLElement | null;
        expect(bloque).not.toBeNull();
        expect(bloque).toHaveAttribute('aria-hidden', 'true');
        expect(bloque).toHaveTextContent('');
    });

    it('la forma por defecto es una línea de 15 px con el radio de la ficha', () => {
        const { container } = render(<Skeleton testID="linea" />);
        const linea = estilo(container.querySelector('[data-testid="linea"]')!);

        expect(linea.height).toBe('15px');
        expect(linea.width).toBe('100%');
        expect(radio(container.querySelector('[data-testid="linea"]')!)).toBe(12);
    });

    it('avatar, tile, pastilla y hero toman las medidas del artboard', () => {
        const { container } = render(
            <>
                <Skeleton variant="avatar" testID="avatar" />
                <Skeleton variant="tile" testID="tile" />
                <Skeleton variant="pill" testID="pill" />
                <Skeleton variant="hero" testID="hero" />
            </>,
        );

        const avatar = container.querySelector('[data-testid="avatar"]')!;
        expect([estilo(avatar).width, estilo(avatar).height]).toEqual(['48px', '48px']);
        // Círculo perfecto: radio por encima de la mitad del lado.
        expect(radio(avatar)).toBeGreaterThanOrEqual(24);

        const tile = container.querySelector('[data-testid="tile"]')!;
        expect([estilo(tile).width, estilo(tile).height, radio(tile)]).toEqual(['56px', '56px', 16]);

        const pill = container.querySelector('[data-testid="pill"]')!;
        expect(estilo(pill).height).toBe('28px');
        expect(radio(pill)).toBeGreaterThanOrEqual(14);

        const hero = container.querySelector('[data-testid="hero"]')!;
        expect([estilo(hero).height, radio(hero)]).toEqual(['186px', 20]);
    });

    it('acepta un ancho relativo para las líneas cortas (80 %, 65 %, 50 %, 35 %)', () => {
        const { container } = render(<Skeleton width="65%" testID="corta" />);

        expect(estilo(container.querySelector('[data-testid="corta"]')!).width).toBe('65%');
    });

    it('no usa hex sueltos: el color sale del token `border` de Tailwind', () => {
        const fuente = leer('components/ui/Skeleton.tsx');

        expect(fuente).toContain('bg-border');
        expect(fuente).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });

    it('SkeletonCard y SkeletonRow son el hueco de una tarjeta y de una fila, también decorativos', () => {
        const { container } = render(
            <SkeletonCard testID="tarjeta">
                <SkeletonRow testID="fila">
                    <Skeleton variant="tile" />
                    <Skeleton />
                </SkeletonRow>
            </SkeletonCard>,
        );

        expect(container.querySelector('[data-testid="tarjeta"]')).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelector('[data-testid="fila"]')).toHaveAttribute('aria-hidden', 'true');
        // La fila reparte sus bloques en horizontal: el hueco se lee como una fila, no como una pila.
        expect(estilo(container.querySelector('[data-testid="fila"]')!).flexDirection).toBe('row');
        expect(estilo(container.querySelector('[data-testid="fila"]')!).gap).toBe('12px');
    });

    it('S9: ninguna pestaña lo conecta todavía (cada tramo lo enchufa en el suyo)', () => {
        for (const pestana of ['components/WishListTab.tsx', 'components/GroupsTab.tsx', 'components/ProfileTab.tsx']) {
            expect(leer(pestana)).not.toMatch(/ui\/Skeleton|from '\.\/ui\/Skeleton'/);
        }
    });
});
