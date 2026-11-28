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

/**
 * jsdom no deja sustituir `window.location` (es «unforgeable»), así que la única forma de ver
 * una recarga es escuchar su consola virtual: jsdom emite `jsdomError` con «Not implemented:
 * navigation…» en cuanto alguien llama a `location.reload()`. Es API interna de jsdom, de ahí
 * que se compruebe que existe en vez de dar por hecho que el espía funciona.
 */
function escucharNavegaciones() {
    const mensajes: string[] = [];
    const consola = (window as unknown as {
        _virtualConsole?: {
            on(evento: 'jsdomError', escucha: (error: Error) => void): void;
            off(evento: 'jsdomError', escucha: (error: Error) => void): void;
        };
    })._virtualConsole;
    expect(consola, 'jsdom expone su consola virtual').toBeDefined();

    const alError = (error: Error) => mensajes.push(error.message);
    consola?.on('jsdomError', alError);

    return {
        navegaciones: () => mensajes.filter((mensaje) => /navigation/i.test(mensaje)),
        dejarDeEscuchar: () => consola?.off('jsdomError', alError),
    };
}

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

    it('en producción (sin onRetry) «Reintentar» no recarga: vuelve a preguntar y, si sigue sin conexión, lo dice', () => {
        const { navegaciones, dejarDeEscuchar } = escucharNavegaciones();

        try {
            // El armazón (`app/_layout.tsx`) monta `<OfflineBanner />` sin `onRetry`.
            render(<OfflineBanner />);

            fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

            // Recargar sin conexión deja la app en la página «sin conexión» del navegador y
            // tira lo que hubiera sin guardar: la acción no navega.
            expect(navegaciones()).toEqual([]);
            // Retroalimentación honesta, sin prometer datos guardados (S8).
            expect(screen.getByRole('alert')).toHaveTextContent(/sigue sin conexión/i);
            expect(screen.getByRole('alert').textContent ?? '').not.toMatch(/guard(ó|o|ad[oa]s?)/i);

            // Y cuando el navegador vuelve a estar en línea, la banda se va sola.
            act(() => {
                setOnLine(true);
                window.dispatchEvent(new Event('online'));
            });
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        } finally {
            dejarDeEscuchar();
        }
    });

    it('no usa hex sueltos: los colores salen de tokens', () => {
        for (const fichero of ['components/OfflineBanner.tsx', 'lib/use-online.ts']) {
            const fuente = readFileSync(join(__dirname, '..', fichero), 'utf8');
            expect(fuente, fichero).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        }
    });

    it('el camino de producción no tiene ninguna recarga: «Reintentar» pregunta, no navega', () => {
        const fuente = readFileSync(join(__dirname, '..', 'components', 'OfflineBanner.tsx'), 'utf8');
        expect(fuente).not.toMatch(/location\.reload|location\.href\s*=|window\.history/);
    });
});
