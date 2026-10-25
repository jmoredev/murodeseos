import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessibilityInfo, Platform } from 'react-native';
import { useReducedMotion } from '@/lib/tour/use-reduced-motion';

/**
 * «¿Este usuario pide menos movimiento?» (S5, accesibilidad).
 *
 * La pregunta tiene dos respuestas según dónde corra el tour: en web la contesta
 * `prefers-reduced-motion`, en nativo `AccessibilityInfo`. Lo que se ancla aquí es el contrato que
 * el `TourHost` necesita: el valor llega ya en el primer render (para que el tour no anime su primer
 * cambio), los cambios del sistema se escuchan de verdad y la escucha se suelta al desmontar. Sin
 * la baja, cada montaje del tour dejaría un oyente vivo en `window` o en `AccessibilityInfo`.
 */

type OyenteMedio = (evento: { matches: boolean }) => void;

/** Un `matchMedia` de mentira con la misma forma que el del navegador. */
function medios(prefiere: boolean) {
    const oyentes = new Set<OyenteMedio>();

    const lista = {
        matches: prefiere,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: (tipo: string, oyente: OyenteMedio) => {
            if (tipo === 'change') oyentes.add(oyente);
        },
        removeEventListener: (tipo: string, oyente: OyenteMedio) => {
            if (tipo === 'change') oyentes.delete(oyente);
        },
        // Safari antiguo: el enganche del repo usa la API moderna, pero un navegador que sólo
        // tenga `addListener` no puede reventar por eso.
        addListener: (oyente: OyenteMedio) => oyentes.add(oyente),
        removeListener: (oyente: OyenteMedio) => oyentes.delete(oyente),
        dispatchEvent: () => true,
    };

    return {
        lista,
        oyentes,
        cambiar(valor: boolean) {
            lista.matches = valor;

            for (const oyente of [...oyentes]) oyente({ matches: valor });
        },
    };
}

function instalarMedios(prefiere: boolean) {
    const medio = medios(prefiere);

    (window as unknown as { matchMedia: unknown }).matchMedia = vi.fn(() => medio.lista);

    return medio;
}

const descriptorMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

afterEach(() => {
    if (descriptorMatchMedia) {
        Object.defineProperty(window, 'matchMedia', descriptorMatchMedia);
    } else {
        delete (window as { matchMedia?: unknown }).matchMedia;
    }
});

describe('useReducedMotion en web', () => {
    it('empieza con lo que ya dice la preferencia del sistema', () => {
        instalarMedios(true);

        expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
    });

    it('reacciona al cambio de preferencia y se da de baja al desmontar', () => {
        const medio = instalarMedios(false);
        const { result, unmount } = renderHook(() => useReducedMotion());

        expect(result.current).toBe(false);

        act(() => medio.cambiar(true));
        expect(result.current).toBe(true);

        unmount();
        // Sin la baja, un tour que se abre y se cierra dejaría un oyente más por montaje.
        expect(medio.oyentes.size).toBe(0);
    });

    it('sin `matchMedia` responde que no y no revienta: también corre en servidor', () => {
        delete (window as { matchMedia?: unknown }).matchMedia;

        expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
    });
});

describe('useReducedMotion en nativo', () => {
    const sistemaOriginal = Platform.OS;

    afterEach(() => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: sistemaOriginal });
        vi.restoreAllMocks();
    });

    it('pregunta a AccessibilityInfo, escucha sus cambios y suelta la escucha al desmontar', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

        const preguntar = vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
        const quitar = vi.fn();
        let oyente: ((valor: boolean) => void) | null = null;
        const escuchar = vi
            .spyOn(AccessibilityInfo, 'addEventListener')
            // `addEventListener` está sobrecargado en los tipos de React Native (anuncios y
            // cambios de accesibilidad); el doble cubre sólo la firma que usa el enganche.
            .mockImplementation((((evento: string, manejador: unknown) => {
                if (evento === 'reduceMotionChanged') {
                    oyente = manejador as (valor: boolean) => void;
                }

                return { remove: quitar } as unknown as ReturnType<
                    typeof AccessibilityInfo.addEventListener
                >;
            }) as unknown) as typeof AccessibilityInfo.addEventListener);

        const { result, unmount } = renderHook(() => useReducedMotion());

        // En nativo la respuesta es asíncrona: hasta que llega, se responde que no y no se anima
        // de más.
        expect(result.current).toBe(false);

        await act(async () => {
            await Promise.resolve();
        });

        expect(preguntar).toHaveBeenCalledTimes(1);
        expect(result.current).toBe(true);

        act(() => oyente?.(false));
        expect(result.current).toBe(false);

        unmount();

        expect(escuchar).toHaveBeenCalledWith('reduceMotionChanged', expect.any(Function));
        expect(quitar).toHaveBeenCalledTimes(1);
    });
});
