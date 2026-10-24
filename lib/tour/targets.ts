/**
 * Registro de objetivos del tour: una **tienda normal**, sin React.
 *
 * Cada pantalla registra «cómo se mide» su objetivo (una pestaña, un botón) y este módulo guarda la
 * última medida conocida. El motor nunca lleva coordenadas: pide un `targetId` y aquí se resuelve.
 * El motivo está en la decisión S7: en móvil las pestañas son un dock y en escritorio una tablist, y
 * las dos formas tienen que poder resaltarse sin números escritos a mano.
 *
 * La capa de React (`useTourTarget`) sólo envuelve estas cuatro operaciones. Todo lo que se puede
 * romper —medir dos veces, desregistrar mientras se mide, avisar de más y provocar renders en
 * bucle— se decide y se prueba aquí.
 */

import type { Rect } from './geometry';

/** La caja de un objetivo, en píxeles de pantalla (lo que devuelve `measureInWindow`). */
export type TargetRect = Rect;

/**
 * Cómo se mide un objetivo. Devuelve `null` cuando el nodo todavía no existe o ya no se puede
 * medir; puede ser asíncrona porque `measureInWindow` en nativo responde por callback.
 */
export type TargetMeasure = () => TargetRect | null | Promise<TargetRect | null>;

export type TargetListener = () => void;

export type TargetRegistry = {
    /** Da de alta (o reemplaza) el objetivo. Registrar dos veces el mismo id es un cambio de nodo. */
    register(id: string, measure: TargetMeasure): void;
    /** Da de baja el objetivo y olvida su medida. */
    unregister(id: string): void;
    /** Última medida conocida, sin preguntar al nodo. `null` si no hay o no se pudo medir. */
    measure(id: string): TargetRect | null;
    /** Pregunta al nodo y avisa si la medida cambió. Sin id, mide todos los registrados. */
    refresh(id?: string): Promise<void>;
    /** Avisa cuando cambia cualquier medida. Devuelve cómo dejar de escuchar. */
    subscribe(listener: TargetListener): () => void;
};

type Entrada = {
    medir: TargetMeasure;
    rect: TargetRect | null;
};

/** Una medida sólo vale si sus cuatro números lo son; si no, es que el nodo aún no está. */
function normalizar(rect: TargetRect | null | undefined): TargetRect | null {
    if (!rect) return null;

    const { x, y, width, height } = rect;

    if (![x, y, width, height].every(Number.isFinite)) return null;

    return { x, y, width, height };
}

function mismasCifras(a: TargetRect | null, b: TargetRect | null): boolean {
    if (a === null || b === null) return a === b;

    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function createTargetRegistry(): TargetRegistry {
    const objetivos = new Map<string, Entrada>();
    const oyentes = new Set<TargetListener>();

    function avisar() {
        // Copia de la lista: un oyente puede darse de baja al recibir el aviso.
        for (const oyente of [...oyentes]) oyente();
    }

    async function medirUno(id: string) {
        const entrada = objetivos.get(id);
        if (!entrada) return;

        const medida = normalizar(await entrada.medir());
        const actual = objetivos.get(id);

        // Mientras se medía, el objetivo pudo desregistrarse o registrar otro nodo. En ese caso la
        // medida que llega es de un nodo que ya no está y no puede resucitarlo.
        if (!actual || actual.medir !== entrada.medir) return;

        // Misma medida (aunque sea un objeto nuevo): se conserva la referencia anterior para que
        // `useSyncExternalStore` vea una instantánea estable y no vuelva a renderizar.
        if (mismasCifras(actual.rect, medida)) return;

        actual.rect = medida;
        avisar();
    }

    return {
        register(id, measure) {
            const anterior = objetivos.get(id);

            objetivos.set(id, { medir: measure, rect: null });

            // Un nodo nuevo no conserva la caja del viejo: hay que volver a medir. Sólo se avisa si
            // de verdad se olvidó una medida; si no había nada, la instantánea no ha cambiado.
            if (anterior && anterior.rect !== null) avisar();
        },

        unregister(id) {
            if (!objetivos.delete(id)) return;

            avisar();
        },

        measure(id) {
            return objetivos.get(id)?.rect ?? null;
        },

        async refresh(id) {
            if (id !== undefined) {
                await medirUno(id);
                return;
            }

            for (const clave of [...objetivos.keys()]) await medirUno(clave);
        },

        subscribe(listener) {
            oyentes.add(listener);

            return () => {
                oyentes.delete(listener);
            };
        },
    };
}
