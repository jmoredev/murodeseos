/**
 * A dónde hay que ir para llegar a una parada del tour (S3).
 *
 * El motor (`lib/tour/engine.ts`) dice **qué** parada toca; esto dice **dónde** vive. Se decide sin
 * React y sin expo-router a propósito: el corredor recibe el destino ya calculado y lo ejecuta, así
 * que el caso raro —una parada en una sub-ruta, una URL con barra final, volver de una sub-ruta a la
 * portada— se prueba con cadenas, sin montar la app ni un navegador.
 *
 * La diferencia entre «pestaña» y «ruta» no es cosmética. En la portada (`/`) las pestañas son
 * estado, no rutas: cambiar de pestaña no debe recargar ni volver a montar la pantalla que ya se
 * está midiendo. Desde una sub-ruta, en cambio, hay que volver a la portada de verdad, y la pestaña
 * se conserva en `?tab=` (el parámetro que ya lee `lib/tabs.ts`).
 */

import type { TourStep } from './engine';
import type { Tab } from '@/lib/tabs';

/** Lo que el corredor tiene que ejecutar. `null` = ya estamos en la parada. */
export type TourDestination =
    | { kind: 'tab'; tab: Tab }
    | { kind: 'route'; route: string }
    | null;

/** Dónde está el usuario ahora: la pestaña activa y el pathname de expo-router. */
export type TourHere = {
    tab: Tab;
    pathname: string;
};

/**
 * Ignora **una** barra final. `/wishlist/add/` y `/wishlist/add` son la misma pantalla para
 * expo-router, y sin esto la parada pediría navegar a donde ya está: un `push` a la misma ruta,
 * otro documento montado encima y el hueco midiendo la copia de atrás.
 */
function sinBarraFinal(ruta: string): string {
    if (ruta.length <= 1 || !ruta.endsWith('/')) return ruta;

    return ruta.slice(0, -1);
}

export function stepDestination(step: TourStep, here: TourHere): TourDestination {
    const pathname = sinBarraFinal(here.pathname);

    // La ruta manda: es la más específica de las dos, y si una parada la declara es porque vive
    // allí aunque comparta pestaña con la portada.
    if (step.route !== undefined) {
        return pathname === sinBarraFinal(step.route)
            ? null
            : { kind: 'route', route: step.route };
    }

    if (step.tab === undefined) return null;

    if (pathname !== '/') {
        // Sub-ruta: hay que volver a la portada. Si la pestaña ya es la de la parada, la URL corta
        // (`/`) basta y es la que el usuario reconoce; si no, se pide en el parámetro.
        return { kind: 'route', route: here.tab === step.tab ? '/' : `/?tab=${step.tab}` };
    }

    // En la portada la pestaña es estado: se cambia sin tocar la ruta.
    return here.tab === step.tab ? null : { kind: 'tab', tab: step.tab };
}
