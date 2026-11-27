import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from '@/components/OfflineBanner';

/**
 * S8 (decisión del propietario, L8): «Aviso simple, sin prometer datos guardados». La banda del
 * artboard (12 · P4) dice «Ves lo que se guardó el 26 de noviembre a las 8:42», pero la app no
 * guarda una copia de la que fiarse: prometerlo sería mentir. Se conserva la forma (banda, icono,
 * título, detalle y su botón) y se cambia el texto por lo que la app sabe de verdad.
 */
const descriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

function setOnLine(value: boolean) {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

beforeEach(() => {
    setOnLine(false);
});

afterEach(() => {
    if (descriptor) Object.defineProperty(window.navigator, 'onLine', descriptor);
});

describe('OfflineBanner', () => {
    it('sin conexión anuncia que no hay red y ofrece reintentar', () => {
        const onRetry = vi.fn();
        render(<OfflineBanner onRetry={onRetry} />);

        const banda = screen.getByRole('alert');
        expect(banda).toHaveTextContent('Sin conexión');

        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('no promete datos guardados: el detalle habla sólo de la conexión', () => {
        render(<OfflineBanner onRetry={vi.fn()} />);

        const texto = screen.getByRole('alert').textContent ?? '';
        // La copy del artboard que se retira (S8): fechas de guardado o una copia de la que fiarse.
        expect(texto).not.toMatch(/guard(ó|o|ad[oa]s?)\s*(el|los)?\s*\d|se guardó|lo guardado/i);
        expect(texto).toMatch(/conexión/i);
    });

    it('con conexión no ocupa ni un píxel', () => {
        setOnLine(true);
        const { container } = render(<OfflineBanner onRetry={vi.fn()} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('desaparece sola cuando vuelve la conexión', () => {
        render(<OfflineBanner onRetry={vi.fn()} />);
        expect(screen.getByRole('alert')).toBeInTheDocument();

        act(() => {
            setOnLine(true);
            window.dispatchEvent(new Event('online'));
        });

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('no usa hex sueltos: los colores salen de tokens', () => {
        for (const fichero of ['components/OfflineBanner.tsx', 'lib/use-online.ts']) {
            const fuente = readFileSync(join(__dirname, '..', fichero), 'utf8');
            expect(fuente, fichero).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        }
    });
});
