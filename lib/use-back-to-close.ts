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

/**
 * ¿La entrada que está en la cima del historial es la nuestra?
 *
 * Se **pregunta al historial** en vez de recordarlo en una variable, y eso no es
 * un detalle: un booleano de módulo se queda obsoleto en cuanto la aplicación
 * navega (el router empuja su propia entrada y la nuestra deja de estar arriba),
 * y entonces la capa cree tener paso cuando no lo tiene, o al revés. El historial
 * es la única fuente de verdad de lo que hay en el historial.
 */
function entradaEsNuestra(): boolean {
    return (window.history.state as EstadoHistorial)?.[MARCA] === true;
}

/**
 * El **mismo** objeto `PopStateEvent` llega a todos los escuchadores de `window`.
 * Sin esta marca, un solo gesto cerraba todos los modales a la vez (`R3-001`).
 */
let eventoAtendido: PopStateEvent | null = null;

function empujarEntrada() {
    window.history.pushState({ [MARCA]: true } as EstadoHistorial, '');
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
        // Una entrada para toda la capa de modales: mientras haya alguno abierto,
        // el historial tiene su paso.
        if (!entradaEsNuestra()) empujarEntrada();

        const alVolver = (evento: PopStateEvent) => {
            if (eventoAtendido === evento) return;
            eventoAtendido = evento;

            // El gesto consume la entrada que hubiera en la cima; a partir de aqui
            // manda lo que diga el historial.
            if (abiertos.length === 0) return;

            abiertos[abiertos.length - 1].cerrar();

            // React aplica el cierre de forma **asíncrona**, así que aquí la capa
            // todavía contiene el modal: decidir ya repondría una entrada que el
            // cierre retiraría acto seguido (un `pushState` + `back` de más).
            setTimeout(() => {
                if (abiertos.length > 0 && !entradaEsNuestra()) empujarEntrada();
            }, 0);
        };
        window.addEventListener('popstate', alVolver);

        return () => {
            window.removeEventListener('popstate', alVolver);
            const i = abiertos.findIndex((modal) => modal.id === id);
            if (i !== -1) abiertos.splice(i, 1);

            // Mientras quede capa, la entrada no sobra: es el paso que el próximo
            // gesto consumirá. Si el gesto se la había llevado, se repone para que
            // el siguiente atrás cierre el siguiente modal, no para salir de la app
            // (`R3-002`).
            if (abiertos.length > 0 && !entradaEsNuestra()) empujarEntrada();

            // Y si la capa queda **vacía**, no se toca el historial. Antes se
            // llamaba a `history.back()` para retirar la entrada, y eso es lo que
            // abría la carrera: ese back es asíncrono e **indistinguible** de un
            // gesto del usuario, así que si entre medias se abría otro modal, su
            // `popstate` lo cerraba solo (CRITICAL del refutador). Sin back interno
            // no hay carrera posible: la entrada queda «gastada» y la reutiliza el
            // próximo modal; si nadie la usa, un gesto la consume sin cerrar nada.
            // El precio es un toque de atrás que no hace nada tras cerrar un modal
            // con la ✕, y se acepta a cambio de que la carrera sea imposible.
        };
    }, [isOpen]);
}
