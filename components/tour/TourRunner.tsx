'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    createTourState,
    current,
    next,
    previous,
    skip,
    type TourState,
    type TourStatus,
    type TourStep,
} from '@/lib/tour/engine';
import { stepDestination, type TourDestination } from '@/lib/tour/navigation';
import type { Tab } from '@/lib/tabs';
import { TourOverlay } from './TourOverlay';
import { useTourTargetRegistry } from './TourTargetProvider';

/**
 * El corredor del tour: dueño del estado y de la navegación entre paradas (S3).
 *
 * No sabe navegar. Recibe `onNavigate` y le entrega el destino ya calculado por
 * `lib/tour/navigation.ts`: así esto se puede probar sin expo-router (y sin pantalla), y quien
 * monta el tour (T6) decide si el destino es un `router.push`, un `setActiveTab` o las dos cosas.
 * Tampoco sabe qué pantalla hay debajo: cada parada apunta a un objetivo que la pantalla registra
 * sola (S7), y aquí sólo se pide que se vuelva a medir cuando el objetivo aún no aparece.
 *
 * Tiene que estar dentro de un `TourTargetProvider`: sin registro no hay dónde medir y el overlay
 * no pintaría nunca.
 */

export type TourRunnerProps = {
    steps: readonly TourStep[];
    /** Pestaña activa ahora mismo, para decidir si hay que cambiar de pestaña. */
    tab: Tab;
    /** Pathname actual de expo-router, para decidir si hay que cambiar de ruta. */
    pathname: string;
    onNavigate: (destination: TourDestination) => void;
    /** Se avisa **una** vez, cuando el recorrido termina o se salta. */
    onFinish: (status: TourStatus) => void;
    /** S5: sin movimiento, para quien lo pide por accesibilidad. */
    reduceMotion?: boolean;
};

export function TourRunner({
    steps,
    tab,
    pathname,
    onNavigate,
    onFinish,
    reduceMotion = false,
}: TourRunnerProps) {
    const registro = useTourTargetRegistry();
    const [estado, setEstado] = useState<TourState>(() => createTourState(steps));

    const parada = current(estado);
    const paso = parada?.step ?? null;

    const avanzar = useCallback(() => setEstado((actual) => next(actual)), []);
    const retroceder = useCallback(() => setEstado((actual) => previous(actual)), []);
    const saltar = useCallback(() => setEstado((actual) => skip(actual)), []);

    /**
     * Navegación: **una vez por parada**, no por render.
     *
     * El efecto se vuelve a ejecutar cuando cambian la pestaña o el pathname (que es justo lo que
     * pasa después de navegar), así que sin memoria esto sería un bucle: navega, el padre repinta,
     * el efecto vuelve a pedir el mismo destino. El `ref` guarda la última parada atendida; una
     * parada nueva —y sólo una— vuelve a pedir su destino.
     */
    const paradaAtendida = useRef<string | null>(null);

    useEffect(() => {
        if (!paso || paradaAtendida.current === paso.id) return;

        paradaAtendida.current = paso.id;

        const destino = stepDestination(paso, { tab, pathname });

        // `null` es «ya estamos»: no se navega a donde uno está, que montaría otra copia de la
        // pantalla que se está midiendo.
        if (destino) onNavigate(destino);
    }, [paso, tab, pathname, onNavigate]);

    /**
     * El objetivo puede montarse tarde (una pestaña que se abre, una lista que carga). Cuando el
     * overlay avisa de que falta, se pide una medida nueva; el `ref` limita los reintentos a uno
     * por parada, porque un `refresh` que se repite en cada render es un bucle de renders
     * disfrazado de reintento.
     */
    const paradaRefrescada = useRef<string | null>(null);

    const alFaltarObjetivo = useCallback(() => {
        const id = paso?.id;
        if (!id || paradaRefrescada.current === id) return;

        paradaRefrescada.current = id;
        void registro.refresh();
    }, [paso, registro]);

    /**
     * El final se anuncia una sola vez. El motor deja el estado quieto cuando el tour ya no está
     * activo, pero el padre puede repintar antes de desmontarlo, y guardar dos veces «terminado» en
     * el perfil no es gratis.
     */
    const finalAnunciado = useRef<TourStatus | null>(null);

    useEffect(() => {
        if (estado.status === 'active') {
            finalAnunciado.current = null;
            return;
        }

        if (finalAnunciado.current === estado.status) return;

        finalAnunciado.current = estado.status;
        onFinish(estado.status);
    }, [estado.status, onFinish]);

    // Terminado o saltado, el velo se va con él: un tour cerrado que deja la pantalla oscurecida es
    // peor que no haberlo abierto nunca. Quien monte el corredor puede desmontarlo cuando quiera,
    // pero no tiene que acordarse de hacerlo para que esto se vea bien.
    if (estado.status !== 'active') return null;

    return (
        <TourOverlay
            current={parada}
            onNext={avanzar}
            onPrevious={retroceder}
            onSkip={saltar}
            reduceMotion={reduceMotion}
            onTargetMissing={alFaltarObjetivo}
        />
    );
}
