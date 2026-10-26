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
    /** Da de alta el objetivo. Cada llamada es **una pantalla** más que lo reclama, no un reemplazo. */
    register(id: string, measure: TargetMeasure): void;
    /** Da de baja **esa** alta. Las demás pantallas que reclamen el mismo id siguen en pie. */
    unregister(id: string, measure: TargetMeasure): void;
    /** Última medida conocida de la pantalla que manda, sin preguntar al nodo. */
    measure(id: string): TargetRect | null;
    /** Pregunta al nodo y avisa si la medida cambió. Sin id, mide todos los registrados. */
    refresh(id?: string): Promise<void>;
    /** Avisa cuando cambia cualquier medida. Devuelve cómo dejar de escuchar. */
    subscribe(listener: TargetListener): () => void;
};

/**
 * Las altas vivas de **un** identificador, de la primera a la última.
 *
 * Son una pila y no una sola entrada porque varias pantallas pueden reclamar el mismo objetivo a la
 * vez: la portada y, encima, el detalle de un grupo o la lista de otra persona, que pintan el mismo
 * chrome (D5). Manda la última que entró —la pantalla que se ve— y dar de baja una **no** borra las
 * demás. Cuando el registro tenía una sola entrada por id, la baja de la sub-ruta borraba el alta de
 * la portada, que no se vuelve a montar para rehacerla: la parada se quedaba sin medida y el overlay
 * no pintaba nada.
 */
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
    const objetivos = new Map<string, Entrada[]>();
    const oyentes = new Set<TargetListener>();

    /** La pantalla que manda: la última que reclamó el objetivo. */
    function cima(id: string): Entrada | undefined {
        const pila = objetivos.get(id);

        return pila?.[pila.length - 1];
    }

    function avisar() {
        // Copia de la lista: un oyente puede darse de baja al recibir el aviso.
        for (const oyente of [...oyentes]) oyente();
    }

    async function medirUno(id: string) {
        const entrada = cima(id);
        if (!entrada) return;

        const medida = normalizar(await entrada.medir());

        // Mientras se medía, esa pantalla pudo darse de baja o dejar de mandar (otra se montó
        // encima). En los dos casos la medida que llega es de un nodo que ya no manda y no puede
        // resucitarlo ni pisar a la que sí manda.
        if (cima(id) !== entrada) return;

        // Misma medida (aunque sea un objeto nuevo): se conserva la referencia anterior para que
        // `useSyncExternalStore` vea una instantánea estable y no vuelva a renderizar.
        if (mismasCifras(entrada.rect, medida)) return;

        entrada.rect = medida;
        avisar();
    }

    return {
        register(id, measure) {
            const pila = objetivos.get(id) ?? [];
            const anterior = pila[pila.length - 1];

            pila.push({ medir: measure, rect: null });
            objetivos.set(id, pila);

            // Una pantalla nueva por encima es un cambio de nodo: hay que volver a medir. Sólo se
            // avisa si de verdad se olvidó una medida; si no la había, la instantánea no cambió.
            if (anterior && anterior.rect !== null) avisar();
        },

        unregister(id, measure) {
            const pila = objetivos.get(id);
            if (!pila) return;

            // Se da de baja **esta** alta, no el id: puede haber otras pantallas vivas debajo.
            let indice = -1;

            for (let i = pila.length - 1; i >= 0; i -= 1) {
                if (pila[i].medir === measure) {
                    indice = i;

                    break;
                }
            }

            if (indice === -1) return;

            const mandaba = indice === pila.length - 1;

            pila.splice(indice, 1);

            if (pila.length === 0) {
                objetivos.delete(id);
                avisar();

                return;
            }

            // Dar de baja una pantalla de debajo no cambia lo que se ve.
            if (!mandaba) return;

            // La que queda vuelve a mandar, pero su caja es de cuando estaba debajo: se olvida y se
            // vuelve a medir, para no dibujar el hueco donde ya no está.
            const heredada = pila[pila.length - 1];
            const olvidada = heredada.rect;

            heredada.rect = null;

            if (olvidada !== null) avisar();

            void medirUno(id);
        },

        measure(id) {
            return cima(id)?.rect ?? null;
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
