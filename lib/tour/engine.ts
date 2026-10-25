/**
 * Motor del tour: una máquina de estados **pura**.
 *
 * Recibe un estado y devuelve otro, sin React, sin DOM, sin temporizadores y sin animaciones. El
 * motivo es doble: el recorrido se puede probar entero sin montar nada, y el overlay (que sí tiene
 * movimiento) se queda con lo único que le toca — pintar lo que este módulo ya decidió.
 *
 * El motor nunca guarda coordenadas: una parada apunta a un `targetId` que la pantalla registra,
 * porque en móvil las pestañas son un dock y en escritorio una tablist, y las dos formas tienen
 * que poder resaltarse sin números escritos a mano.
 */

import type { Tab } from '@/lib/tabs';

export type TourStep = {
    /** Identidad estable: sirve para depurar y para no repetir paradas. */
    id: string;
    /** Objetivo registrado en pantalla (`useTourTarget`), no coordenadas. */
    targetId: string;
    /**
     * Pestaña de la pantalla principal en la que vive la parada.
     *
     * Es distinto de `route`, y por eso son dos campos: las pestañas de la portada no son rutas del
     * navegador, son estado (`setActiveTab`). Pedir `/` para ir de «Deseos» a «Grupos» recargaría la
     * pantalla y volvería a montar la lista que se está midiendo.
     */
    tab?: Tab;
    /** Ruta de expo-router en la que vive la parada, si no es la pantalla principal. */
    route?: string;
    /** Páginas del cuadro de diálogo. Al menos una. */
    pages: readonly string[];
};

export type TourStatus = 'active' | 'completed' | 'skipped';

export type TourState = {
    /**
     * El catálogo de paradas. Es de sólo lectura y el tipo lo exige: se comparte por referencia entre
     * todos los estados, así que una escritura accidental aquí la vería el recorrido entero.
     */
    steps: readonly TourStep[];
    status: TourStatus;
    stepIndex: number;
    pageIndex: number;
};

/** Lo que el overlay necesita para pintar la parada actual, ya calculado. */
export type TourCurrent = {
    step: TourStep;
    page: string;
    stepIndex: number;
    pageIndex: number;
    stepCount: number;
    pageCount: number;
    /** `Paso 2 de 7`, en el idioma de la interfaz. */
    stepLabel: string;
    pageLabel: string;
};

/**
 * Prepara el recorrido. Sin paradas nace terminado: no hay nada que caminar y la pantalla que lo
 * abra tiene que cerrarse sola, no quedarse en un tour vacío.
 *
 * Un paso sin páginas no es entrada del usuario sino un catálogo mal escrito, así que falla aquí y
 * el mensaje nombra el paso: quien lo lea arregla el catálogo sin abrir el depurador.
 */
export function createTourState(steps: readonly TourStep[]): TourState {
    const sinPaginas = steps.find((step) => step.pages.length === 0);

    if (sinPaginas) {
        throw new Error(`El paso «${sinPaginas.id}» no tiene páginas que explicar`);
    }

    return {
        steps,
        status: steps.length === 0 ? 'completed' : 'active',
        stepIndex: 0,
        pageIndex: 0,
    };
}

/**
 * Siguiente: una página. Al agotar un paso salta a la primera página del siguiente, y al agotar el
 * último termina con los índices donde estaban, para que el cierre conserve el contexto en pantalla.
 */
export function next(state: TourState): TourState {
    if (state.status !== 'active') return state;

    const step = state.steps[state.stepIndex];

    if (state.pageIndex < step.pages.length - 1) {
        return { ...state, pageIndex: state.pageIndex + 1 };
    }

    if (state.stepIndex < state.steps.length - 1) {
        return { ...state, stepIndex: state.stepIndex + 1, pageIndex: 0 };
    }

    return { ...state, status: 'completed' };
}

/**
 * Anterior: una página. Al agotar el paso hacia atrás entra por la **última** página del anterior,
 * porque el usuario que retrocede espera ver el final de lo que ya leyó, no su principio.
 */
export function previous(state: TourState): TourState {
    if (state.status !== 'active') return state;

    if (state.pageIndex > 0) {
        return { ...state, pageIndex: state.pageIndex - 1 };
    }

    // Principio del tour: no se envuelve al final ni se lanza, simplemente no se mueve.
    if (state.stepIndex === 0) return state;

    const anterior = state.steps[state.stepIndex - 1];

    return { ...state, stepIndex: state.stepIndex - 1, pageIndex: anterior.pages.length - 1 };
}

/**
 * Saltar: deja el tour en `skipped` desde cualquier posición. Sólo desde una posición activa: un
 * tour ya terminado no se convierte en saltado, porque eso cambiaría lo que se guarda en el perfil.
 */
export function skip(state: TourState): TourState {
    if (state.status !== 'active') return state;

    return { ...state, status: 'skipped' };
}

/**
 * La parada actual con sus etiquetas ya montadas. Devuelve `null` cuando no hay paradas: así el
 * tipo avisa al overlay de que no hay nada que pintar en vez de mentirle con un paso inventado.
 */
export function current(state: TourState): TourCurrent | null {
    if (state.steps.length === 0) return null;

    const step = state.steps[state.stepIndex];

    return {
        step,
        page: step.pages[state.pageIndex],
        stepIndex: state.stepIndex,
        pageIndex: state.pageIndex,
        stepCount: state.steps.length,
        pageCount: step.pages.length,
        stepLabel: `Paso ${state.stepIndex + 1} de ${state.steps.length}`,
        pageLabel: `Página ${state.pageIndex + 1} de ${step.pages.length}`,
    };
}
