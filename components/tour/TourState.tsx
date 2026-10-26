'use client';

import React, { createContext, useContext, useEffect } from 'react';
import type { Tab } from '@/lib/tabs';

/**
 * El estado del tour que las pantallas necesitan saber, sin arrastrar el tour entero.
 *
 * Vive aparte de `TourHost` por una razón medida: `TourHost` monta el corredor y el velo, y el velo
 * usa `reanimated`. Mientras estos enganches vivían en `TourHost`, cualquier pantalla que sólo
 * quería preguntar «¿hay tour?» importaba el host completo y, con él, `reanimated` —lo que reventaba
 * al importar `app/wishlist/[id]` en pruebas que no tienen por qué saber de animaciones
 * (`__tests__/wish-currency-shared.test.tsx`, que pasó a fallar al entrar el grupo de ejemplo, D5).
 *
 * La regla es la misma que la del registro de objetivos: **sin `TourStateProvider` por encima estos
 * enganches son inertes**, y una pantalla se pinta igual. Quien los alimenta es `TourHost`, que es
 * el único que decide si el tour está en marcha.
 */

export type TourStateValue = {
    active: boolean;
    requestedTab: Tab | null;
    /** La portada dice qué pestaña está enseñando. */
    reportTab: (tab: Tab | null) => void;
};

const TourStateContext = createContext<TourStateValue | null>(null);

export function TourStateProvider({
    value,
    children,
}: {
    value: TourStateValue;
    children?: React.ReactNode;
}) {
    return <TourStateContext.Provider value={value}>{children}</TourStateContext.Provider>;
}

/** ¿Está el tour en marcha? Sin `TourHost` por encima, no: la app se pinta como siempre. */
export function useTourActive(): boolean {
    return useContext(TourStateContext)?.active ?? false;
}

/** La pestaña que pide la parada actual, o `null` si no hay que cambiar de pestaña. */
export function useTourRequestedTab(): Tab | null {
    return useContext(TourStateContext)?.requestedTab ?? null;
}

/**
 * La portada informa de la pestaña que está enseñando.
 *
 * El corredor no puede adivinarla: en la portada las pestañas son **estado**, no rutas, así que el
 * pathname no cambia al cambiar de pestaña. Sin este aviso no sabría si la parada siguiente está
 * delante o hay que pedirla.
 *
 * No se limpia al desmontar a propósito: cuando una sub-ruta se abre encima de la portada, la
 * pestaña de debajo sigue siendo la pestaña de la app, y es la que hay que conservar para calcular el
 * destino de la parada siguiente.
 */
export function useTourTabReporter(tab: Tab): void {
    const reportar = useContext(TourStateContext)?.reportTab;

    useEffect(() => {
        if (!reportar) return;

        reportar(tab);
    }, [reportar, tab]);
}
