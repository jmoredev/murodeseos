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
import { usePathname } from 'expo-router';
import { stepDestination, type TourDestination } from '@/lib/tour/navigation';
import type { Tab } from '@/lib/tabs';
import { TourOverlay } from './TourOverlay';
import { useTourTargetRegistry } from './TourTargetProvider';

/** La portada, con o sin pestaña pedida: `/`, `/?tab=groups`… */
const PORTADA = /^\/?(?:\?tab=(wishlist|groups|profile))?$/;

/**
 * ¿Esta ruta es la portada? Es lo que separa «volver» de «abrir otra pantalla»: la portada ya está
 * montada debajo de una sub-ruta, así que llegar a ella puede ser deshacer un `push`.
 *
 * Vive aquí y no en `lib/tour/navigation.ts` a propósito: `stepDestination` dice dónde vive la
 * parada (puro, sin historial), pero «volver es un `back`» no es un destino, es un permiso —«el
 * `push` que hay debajo lo hice yo»— y de eso sólo se acuerda el corredor.
 */
function esPortada(ruta: string): boolean {
    return PORTADA.test(ruta);
}

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
    /**
     * Pathname para decidir si hay que cambiar de ruta. Normalmente no se pasa: el corredor lo lee
     * él mismo. Existe por las pruebas, que montan el corredor sin navegador.
     */
    pathname?: string;
    /**
     * Ejecuta el destino. `volver` sólo llega a `true` cuando ir a la portada es deshacer el `push`
     * que abrió esta sub-ruta, y lo afirma el corredor porque recuerda haberlo hecho él.
     */
    onNavigate: (destination: TourDestination, volver?: boolean) => void;
    /** Se avisa **una** vez, cuando el recorrido termina o se salta. */
    onFinish: (status: TourStatus) => void;
    /** S5: sin movimiento, para quien lo pide por accesibilidad. */
    reduceMotion?: boolean;
};

export function TourRunner({
    steps,
    tab,
    pathname: pathnameDePrueba,
    onNavigate,
    onFinish,
    reduceMotion = false,
}: TourRunnerProps) {
    const registro = useTourTargetRegistry();
    /**
     * El pathname se suscribe **aquí** y no en quien decide si hay tour (`TourHost`), y no es un
     * detalle: `TourHost` vive por encima del `Stack` de expo-router, así que cualquier estado suyo
     * que cambie re-renderiza el navegador entero. Con `usePathname` arriba, cada navegación
     * re-montaba la pantalla enfocada y se comía lo que hubiera abierto (un formulario a medio
     * rellenar). Aquí el corredor es hermano del `Stack`: su re-render no toca la pantalla de abajo.
     */
    const pathnameActual = usePathname();
    const pathname = pathnameDePrueba ?? pathnameActual;
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

    /**
     * Las rutas que empujó el tour, de la primera a la última.
     *
     * Volver a la portada deshaciendo el `push` vale si la sub-ruta de debajo la abrió este tour.
     * Si el usuario llegó ahí por su cuenta —un enlace directo, un botón de la app—, debajo no está
     * la portada que el tour dejó y retroceder lo sacaría a donde el tour no ha estado.
     *
     * Es una **pila y no una sola ruta** porque el guion encadena sub-rutas (el grupo de ejemplo y,
     * encima, la lista de una de sus personas, D5): con un solo recuerdo, la vuelta deshacía el
     * último `push` y el recorrido se quedaba dentro del grupo, señalando un objetivo que allí no
     * existe. Se desapila al consumirla: una vuelta por cada empujón, y nunca una vuelta que el tour
     * no creó.
     */
    const rutasEmpujadas = useRef<string[]>([]);

    useEffect(() => {
        if (!paso || paradaAtendida.current === paso.id) return;

        paradaAtendida.current = paso.id;

        const destino = stepDestination(paso, { tab, pathname });

        // `null` es «ya estamos»: no se navega a donde uno está, que montaría otra copia de la
        // pantalla que se está midiendo.
        if (!destino) return;

        if (destino.kind !== 'route') {
            onNavigate(destino);

            return;
        }

        if (!esPortada(destino.route)) {
            // Otra pantalla: es un `push` del tour y se recuerda para poder deshacerlo.
            rutasEmpujadas.current = [...rutasEmpujadas.current, destino.route];
            onNavigate(destino);

            return;
        }

        // La portada: si abrimos nosotros la sub-ruta en la que estamos, la vuelta es un `back`.
        const empujadas = rutasEmpujadas.current;

        if (empujadas[empujadas.length - 1] === pathname) {
            rutasEmpujadas.current = empujadas.slice(0, -1);
            // La parada **no** está atendida: puede quedar otro `push` debajo (dos sub-rutas
            // seguidas), y hasta llegar a la portada esta misma parada tiene que volver a pedir su
            // destino. Con el `ref` sin limpiar, el efecto se plantaba en la primera vuelta.
            paradaAtendida.current = null;
            onNavigate(destino, true);

            return;
        }

        onNavigate(destino);
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
