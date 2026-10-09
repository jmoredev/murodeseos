import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Cierra un modal con el gesto de atrás del móvil, en vez de dejar que el gesto
 * **salga de la aplicación**.
 *
 * Por qué existe: en la PWA, abrir el detalle de un deseo o el formulario **no
 * añade ninguna entrada al historial** —son modales, no rutas— y el
 * `BackHandler` de React Native **no existe en web** (los dos modales lo
 * desactivan a propósito). Así que el gesto de atrás era historial puro del
 * navegador: se comía la entrada anterior, que está **fuera** de la app. En una
 * pestaña eso te saca a otra página; en la app instalada, a pantalla completa y
 * sin barra de direcciones, deja una ventana sin documento, que es la pantalla
 * negra sin una letra.
 *
 * En nativo no hace nada: allí el atrás lo sigue gestionando `BackHandler`.
 *
 * **El estado vive en el módulo, no en cada instancia**, y eso no es estilo: la
 * primera versión lo tenía por instancia y la revisión nativa encontró dos
 * defectos graves (`R3-001` y `R3-002`) que los tests de este fichero reproducen.
 * El invariante que los resuelve es uno solo:
 *
 * > **Mientras haya algún modal en la capa, el historial tiene su paso, y un
 * > gesto cierra exactamente uno —el de arriba—.**
 */
const MARCA = '__murodeseosModal';

type EstadoHistorial = { [MARCA]?: boolean } | null;

interface ModalAbierto {
    id: symbol;
    cerrar: () => void;
}

/** La capa de modales: el último es el de arriba, y es el que cierra un gesto. */
const abiertos: ModalAbierto[] = [];

/** Si el historial tiene ya el paso de la capa. Uno por capa, no uno por modal. */
let entradaPropia = false;

/**
 * El **mismo** objeto `PopStateEvent` llega a todos los escuchadores de `window`.
 * Sin esta marca, un solo gesto cerraba todos los modales a la vez (`R3-001`).
 */
let eventoAtendido: PopStateEvent | null = null;

function empujarEntrada() {
    window.history.pushState({ [MARCA]: true } as EstadoHistorial, '');
    entradaPropia = true;
}

export function useBackToClose(isOpen: boolean, onClose: () => void): void {
    // El callback va en una ref a propósito: los modales lo crean **en línea**, de
    // modo que si estuviera en las dependencias del efecto, cada render empujaría
    // otra entrada de historial y harían falta varios toques de atrás para cerrar.
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (Platform.OS !== 'web' || !isOpen) return undefined;
        if (typeof window === 'undefined' || !window.history?.pushState) return undefined;

        const id = Symbol('modal');
        abiertos.push({ id, cerrar: () => onCloseRef.current() });
        if (!entradaPropia) empujarEntrada();

        const alVolver = (evento: PopStateEvent) => {
            if (eventoAtendido === evento) return;
            eventoAtendido = evento;

            if (abiertos.length === 0) return;

            // El gesto **ya ha consumido** la entrada del historial, así que se
            // suelta aquí y la repone quien corresponda: el cierre del modal si
            // queda capa, o la comprobación diferida si el cierre no llega a
            // ocurrir (el formulario mientras guarda), que es `R3-002`.
            entradaPropia = false;
            abiertos[abiertos.length - 1].cerrar();

            // React aplica el cierre de forma **asíncrona**, así que aquí la capa
            // todavía contiene el modal: decidir ya repondría una entrada que el
            // cierre retiraría acto seguido (un `pushState` + `back` de más).
            setTimeout(() => {
                if (abiertos.length > 0 && !entradaPropia) empujarEntrada();
            }, 0);
        };
        window.addEventListener('popstate', alVolver);

        return () => {
            window.removeEventListener('popstate', alVolver);
            const i = abiertos.findIndex((modal) => modal.id === id);
            if (i !== -1) abiertos.splice(i, 1);

            if (abiertos.length > 0) {
                // Todavía hay capa y el gesto se había llevado la entrada: se repone
                // para que el siguiente atrás cierre el siguiente modal, en lugar de
                // salir de la aplicación.
                if (!entradaPropia) empujarEntrada();
                return;
            }

            // La capa queda **vacía**: sólo entonces se retira la entrada. Retirarla
            // con otro modal abierto lanzaba un `popstate` que lo cerraba sin
            // querer: la segunda mitad de `R3-001`.
            if (entradaPropia) {
                entradaPropia = false;
                window.history.back();
            }
        };
    }, [isOpen]);
}
