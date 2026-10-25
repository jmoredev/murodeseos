import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    TourTargetProvider,
    useTourTarget,
    useTourTargetRegistry,
    type TourTargetProps,
} from '@/components/tour/TourTargetProvider';
import type { TargetRect, TargetRegistry } from '@/lib/tour/targets';
import { View } from 'react-native';

/**
 * El enganche de React sobre el registro: le da a cualquier `View`/`Pressable` un `ref` y un
 * `onLayout` que registran la parada y la vuelven a medir. Aquí se prueba a través de sus props,
 * no de la tienda: lo que importa es que el nodo que todavía no existe no rompa, que el desmontaje
 * limpie y que un cambio de layout refresque la medida (rotación, cambio de pestaña).
 */

const RECT: TargetRect = { x: 10, y: 20, width: 100, height: 40 };
const OTRO_RECT: TargetRect = { x: 0, y: 0, width: 360, height: 56 };

/** Lo que la sonda deja ver del enganche: la tienda del proveedor y las props a esparcir. */
type SondaApi = {
    registro: TargetRegistry;
    props: TourTargetProps;
};

type SondaRef = { current: SondaApi | null };

/**
 * La sonda no puede escribir en una variable de fuera durante el render (React lo prohíbe y el
 * lint lo dice), así que deja lo que ve en un `ref` desde un efecto. `render` espera a los efectos,
 * así que el `ref` ya está lleno al volver.
 */
function Sonda({ sondaRef }: { sondaRef: SondaRef }) {
    const registro = useTourTargetRegistry();
    const objetivo = useTourTarget('tab-deseos');

    useEffect(() => {
        sondaRef.current = { registro, props: objetivo };
    }, [sondaRef, registro, objetivo]);

    return null;
}

function leer(sondaRef: SondaRef): SondaApi {
    if (!sondaRef.current) throw new Error('La sonda no se ha montado');

    return sondaRef.current;
}

function nodoMedible(rect: TargetRect) {
    return {
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
            callback(rect.x, rect.y, rect.width, rect.height),
    };
}

describe('useTourTarget', () => {
    it('tolera que el nodo todavía no exista y mide en cuanto aparece', async () => {
        const api: SondaRef = { current: null };
        const { unmount } = render(
            <TourTargetProvider>
                <Sonda sondaRef={api} />
            </TourTargetProvider>
        );

        // Registrado desde el primer render, aunque la pantalla aún no haya montado el nodo.
        await act(async () => {
            await leer(api).registro.refresh('tab-deseos');
        });
        expect(leer(api).registro.measure('tab-deseos')).toBeNull();

        // El nodo llega después (montaje diferido, cambio de pestaña): al llegar se mide.
        await act(async () => {
            leer(api).props.ref(nodoMedible(RECT));
        });
        expect(leer(api).registro.measure('tab-deseos')).toEqual(RECT);

        unmount();
    });

    it('vuelve a medir cuando cambia el layout', async () => {
        const api: SondaRef = { current: null };
        render(
            <TourTargetProvider>
                <Sonda sondaRef={api} />
            </TourTargetProvider>
        );

        await act(async () => {
            leer(api).props.ref(nodoMedible(RECT));
        });
        expect(leer(api).registro.measure('tab-deseos')).toEqual(RECT);

        // Rotación o cambio de pestaña: el mismo nodo, otra caja, y `onLayout` avisa.
        await act(async () => {
            leer(api).props.ref(nodoMedible(OTRO_RECT));
            leer(api).props.onLayout();
        });
        expect(leer(api).registro.measure('tab-deseos')).toEqual(OTRO_RECT);
    });

    it('sin nodo no mide y no revienta', async () => {
        const api: SondaRef = { current: null };
        render(
            <TourTargetProvider>
                <Sonda sondaRef={api} />
            </TourTargetProvider>
        );

        await act(async () => {
            leer(api).props.ref(null);
            leer(api).props.onLayout();
            await leer(api).registro.refresh('tab-deseos');
        });

        expect(leer(api).registro.measure('tab-deseos')).toBeNull();
    });

    it('al desmontar se da de baja y olvida la medida', async () => {
        const api: SondaRef = { current: null };
        const { unmount } = render(
            <TourTargetProvider>
                <Sonda sondaRef={api} />
            </TourTargetProvider>
        );

        await act(async () => {
            leer(api).props.ref(nodoMedible(RECT));
        });
        expect(leer(api).registro.measure('tab-deseos')).toEqual(RECT);

        unmount();

        expect(leer(api).registro.measure('tab-deseos')).toBeNull();
    });

    it('las props se pueden esparcir en un View: son su ref y su onLayout', () => {
        // Contrato de tipos: en T5 esto se esparce tal cual (`<Pressable {...objetivo} />`). Si el
        // `ref` o el `onLayout` del enganche no encajaran en los de un `View`, esto no compila.
        const propsDeView: Pick<React.ComponentPropsWithRef<typeof View>, 'ref' | 'onLayout'> =
            {} as TourTargetProps;

        expect(propsDeView).toEqual({});
    });

    it('sin TourTargetProvider avisa en vez de fallar en silencio', () => {
        // Un tour sin registro no se pinta nunca; el error dice qué falta en vez de dejar el
        // overlay mudo para siempre.
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => render(<Sonda sondaRef={{ current: null }} />)).toThrow(/TourTargetProvider/);

        error.mockRestore();
    });
});
