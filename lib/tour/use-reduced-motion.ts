import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * «¿Este usuario ha pedido menos movimiento?» (S5, accesibilidad).
 *
 * Es una pregunta de **presentación**, no del motor del tour: el motor decide qué parada toca y el
 * overlay decide si el cambio se anima o se salta. Por eso vive aquí y no en `engine.ts` (Log L5).
 *
 * La respuesta depende de dónde corra el tour:
 *
 * - **Web**: `prefers-reduced-motion: reduce` es síncrona, así que ya está disponible en el primer
 *   render y el primer cambio de parada sale sin animar. Se escucha `change` para que activar la
 *   preferencia con el tour abierto surta efecto sin recargar. En servidor (`expo export` y
 *   `expo start --web` con render de servidor) no hay `window` y se responde que no: tocar `window`
 *   ahí rompería la prerenderización.
 * - **Nativo**: `AccessibilityInfo` responde por promesa, así que se empieza por «no» y se corrige
 *   en cuanto llega; animar de más durante un fotograma es menos grave que retrasar el tour
 *   esperando una consulta. El evento `reduceMotionChanged` mantiene el valor al día y su suscripción
 *   se suelta al desmontar: sin eso, cada montaje del tour dejaría un oyente vivo.
 */

/** La consulta estándar, con un solo literal en todo el módulo. */
const CONSULTA_REDUCIDO = '(prefers-reduced-motion: reduce)';

function prefiereReducidoEnWeb(): boolean {
    // En el servidor no hay ventana que consultar.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;

    return window.matchMedia(CONSULTA_REDUCIDO).matches;
}

export function useReducedMotion(): boolean {
    const [reducido, setReducido] = useState(() =>
        Platform.OS === 'web' ? prefiereReducidoEnWeb() : false
    );

    useEffect(() => {
        if (Platform.OS === 'web') {
            if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

            const consulta = window.matchMedia(CONSULTA_REDUCIDO);
            const alCambiar = (evento: MediaQueryListEvent) => setReducido(evento.matches);

            // El valor inicial ya lo leyó el `useState` durante el render: aquí sólo hay que
            // escuchar. Si la preferencia cambia antes de que este efecto se suscriba, el primer
            // evento `change` posterior vuelve a poner el valor al día igualmente.
            consulta.addEventListener('change', alCambiar);

            return () => consulta.removeEventListener('change', alCambiar);
        }

        let vigente = true;

        void AccessibilityInfo.isReduceMotionEnabled()
            .then((valor) => {
                if (vigente) setReducido(valor);
            })
            // Una consulta que falla deja el valor en «no»: el tour se anima como siempre.
            .catch(() => {});

        const suscripcion = AccessibilityInfo.addEventListener('reduceMotionChanged', (valor) => {
            setReducido(valor);
        });

        return () => {
            vigente = false;
            // En nativo la suscripción siempre existe; en el blanco de react-native-web puede ser
            // `undefined`, y entonces no hay nada que soltar.
            suscripcion?.remove();
        };
    }, []);

    return reducido;
}
