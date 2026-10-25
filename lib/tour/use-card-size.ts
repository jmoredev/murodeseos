import { useCallback, useRef, useState } from 'react';
import { TARJETA_ESTIMADA, type Size } from './geometry';

/**
 * La medida real de la tarjeta, para colocarla con lo que ocupa y no con lo que se supone que
 * ocupará (S6, S7).
 *
 * El problema que resuelve: la colocación se decide **antes** de pintar la tarjeta —no puede
 * medirse a sí misma antes de existir—, así que se arranca con `TARJETA_ESTIMADA`. Si el texto de
 * la página es más largo que la estimación, la tarjeta crece en la dirección en la que fue anclada
 * y puede acabar encima del hueco. Medir tras el primer `onLayout` y volver a colocar con la medida
 * evita esa sorpresa.
 *
 * Dos reglas que no son obvias:
 *
 * - Una medida `0×0` se ignora. Es el primer layout en nativo y no dice nada de la tarjeta.
 * - Se acepta **una sola corrección por paso**. Colocarla con la medida la encoge (si la medida no
 *   cabía, la colocación la recorta), encogerla dispara otro `onLayout`, y aceptar esa segunda
 *   medida volvería a mover la colocación: un bucle de renders disfrazado de precisión. Con una
 *   corrección por paso, la tarjeta se queda en el alto que decidió la colocación y el texto que no
 *   quepa se lee desplazando.
 */

/** Lo mínimo del evento de `onLayout` que hace falta aquí (así se prueba sin navegador). */
type EventoDeLayout = {
    nativeEvent: { layout: { width: number; height: number } };
};

export type TamanoTarjeta = {
    /** El tamaño con el que hay que colocar la tarjeta: la medida o, mientras no haya, la estimación. */
    size: Size;
    /** Props para el nodo que se mide (la tarjeta). */
    onLayout: (evento: EventoDeLayout) => void;
    /** `true` si `size` ya es una medida real y no la estimación. */
    measured: boolean;
};

export function useTamanoTarjeta(stepId: string | null): TamanoTarjeta {
    const [medida, setMedida] = useState<{ stepId: string | null; size: Size } | null>(null);
    /** El paso cuya medida ya se aceptó. */
    const aceptada = useRef<string | null>(null);

    const onLayout = useCallback(
        (evento: EventoDeLayout) => {
            const { width, height } = evento.nativeEvent.layout;

            // Un layout sin tamaño es el del primer fotograma: ni se acepta ni se descarta el paso.
            if (!(width > 0) || !(height > 0)) return;

            if (aceptada.current === stepId) return;

            aceptada.current = stepId;
            setMedida({ stepId, size: { width, height } });
        },
        [stepId]
    );

    // La medida de un paso anterior no vale para éste: al cambiar de parada se vuelve a estimar y
    // el primer layout del paso nuevo da la medida buena.
    const delPaso = medida !== null && medida.stepId === stepId ? medida.size : null;

    return {
        size: delPaso ?? TARJETA_ESTIMADA,
        onLayout,
        measured: delPaso !== null,
    };
}
