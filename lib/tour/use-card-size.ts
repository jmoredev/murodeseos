import { useCallback, useState } from 'react';
import { TARJETA_ESTIMADA, cardHeightForContent, type Size } from './geometry';

/**
 * La medida de la tarjeta, para colocarla con lo que ocupa y no con lo que se supone que ocupará.
 *
 * El problema que resuelve: la colocación se decide **antes** de pintar la tarjeta —no puede medirse
 * a sí misma antes de existir—, así que se arranca con `TARJETA_ESTIMADA`. Si el texto de la página
 * no cabe en esa estimación, hay que recolocar con el tamaño de verdad.
 *
 * El alto **no** se mide en la tarjeta: `onLayout` de la tarjeta devuelve la altura que le impuso la
 * colocación, así que la medida sería circular y no corregiría nada. Medido en Chromium: la tarjeta
 * se quedaba en 152 px con un contenido de 190 porque la colocación ya había decidido esos 152, y el
 * texto seguía desplazándose 38 px (odd/tasks/tour-ajustes-visuales.md, D4). Lo que se mide es el
 * contenido: `onContentSizeChange` del `ScrollView` da el alto natural del texto, independiente del
 * alto de la tarjeta, y la tarjeta necesita `cardHeightForContent` de eso.
 *
 * Reglas que no son obvias:
 *
 * - Una medida `0×0` se ignora, tanto en el ancho como en el contenido. Es el primer layout en
 *   nativo y no dice nada de la tarjeta.
 * - El **ancho** viene del `onLayout` de la tarjeta y se acepta **una sola vez por página**:
 *   colocarla con la medida la puede encoger (si la medida no cabía, la colocación la recorta),
 *   encogerla dispara otro `onLayout`, y aceptar esa segunda medida volvería a mover la colocación.
 * - El **alto** sí admite correcciones, cuando el contenido cambia de más de un píxel. La regla de
 *   «una corrección por clave» existía para cortar ese ida y vuelta, y aquí no puede darse: el alto
 *   del contenido no depende del alto de la tarjeta —el `ScrollView` desplaza lo que no cabe, no
 *   encoge el texto—, así que aceptar la medida nueva no realimenta nada. Y cambia de verdad: al
 *   llegar la medida definitiva después de las fuentes, por ejemplo.
 * - La clave es **por página**, no por parada: `stepId#pageIndex`. El alto de una página no dice
 *   nada del de la siguiente, y congelarlo por parada era lo que dejaba la segunda página de un paso
 *   con el alto de la primera y obligaba a desplazar su texto (D3).
 */

/** Lo mínimo del evento de `onLayout` que hace falta aquí (así se prueba sin navegador). */
type EventoDeLayout = {
    nativeEvent: { layout: { width: number; height: number } };
};

/** La medida de una página: el ancho lo da la tarjeta y el alto, su contenido. */
type Medida = {
    /** La página a la que pertenece la medida. */
    clave: string | null;
    /** El ancho de la tarjeta, o `null` mientras no se haya medido. */
    ancho: number | null;
    /** El alto natural del contenido (sin el relleno), o `null` mientras no se haya medido. */
    altoContenido: number | null;
};

export type TamanoTarjeta = {
    /** El tamaño con el que hay que colocar la tarjeta: la medida o, mientras no haya, la estimación. */
    size: Size;
    /** Props para el nodo que se mide (la tarjeta). */
    onLayout: (evento: EventoDeLayout) => void;
    /** Props para el `ScrollView` del contenido: su alto natural sale de aquí. */
    onContentSizeChange: (anchoContenido: number, altoContenido: number) => void;
    /** `true` si `size` ya es una medida real (ancho y alto) y no la estimación. */
    measured: boolean;
};

/** Cuánto puede cambiar el contenido sin que merezca la pena recolocar (redondeo del navegador). */
const TOLERANCIA_DE_ALTO = 1;

export function useTamanoTarjeta(clave: string | null): TamanoTarjeta {
    const [medida, setMedida] = useState<Medida | null>(null);

    const onLayout = useCallback(
        (evento: EventoDeLayout) => {
            const { width } = evento.nativeEvent.layout;

            // Un layout sin tamaño es el del primer fotograma: ni se acepta ni se descarta la clave.
            if (!(width > 0)) return;

            setMedida((actual) => {
                const deLaClave = actual !== null && actual.clave === clave ? actual : null;

                // Ya hay ancho para esta página: no se vuelve a aceptar.
                if (deLaClave !== null && deLaClave.ancho !== null) return actual;

                return { clave, ancho: width, altoContenido: deLaClave?.altoContenido ?? null };
            });
        },
        [clave]
    );

    const onContentSizeChange = useCallback(
        (_anchoContenido: number, altoContenido: number) => {
            // Un contenido sin alto es el del primer fotograma en nativo: no dice nada.
            if (!(altoContenido > 0)) return;

            setMedida((actual) => {
                const deLaClave = actual !== null && actual.clave === clave ? actual : null;
                const anterior = deLaClave?.altoContenido ?? null;

                if (anterior !== null && Math.abs(anterior - altoContenido) <= TOLERANCIA_DE_ALTO) {
                    return actual;
                }

                return { clave, ancho: deLaClave?.ancho ?? null, altoContenido };
            });
        },
        [clave]
    );

    // La medida de una página anterior no vale para ésta: al cambiar de página se vuelve a estimar
    // y las medidas de la página nueva dan el tamaño bueno.
    const deLaPagina = medida !== null && medida.clave === clave ? medida : null;

    return {
        size:
            deLaPagina === null
                ? TARJETA_ESTIMADA
                : {
                      width: deLaPagina.ancho ?? TARJETA_ESTIMADA.width,
                      height:
                          deLaPagina.altoContenido === null
                              ? TARJETA_ESTIMADA.height
                              : cardHeightForContent(deLaPagina.altoContenido),
                  },
        onLayout,
        onContentSizeChange,
        measured: deLaPagina?.ancho != null && deLaPagina.altoContenido !== null,
    };
}
