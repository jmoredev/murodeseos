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
 * Cómo: al abrir se empuja una entrada marcada, el gesto la consume y cierra el
 * modal, y si el modal se cierra con la ✕ se retira esa entrada para que cada
 * apertura no deje un paso muerto que el usuario tenga que deshacer.
 *
 * En nativo no hace nada: allí el atrás lo sigue gestionando `BackHandler`.
 */
const MARCA = '__murodeseosModal';

type EstadoHistorial = { [MARCA]?: boolean } | null;

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

        window.history.pushState({ [MARCA]: true } as EstadoHistorial, '');

        let consumidaPorElGesto = false;
        const alVolver = () => {
            consumidaPorElGesto = true;
            onCloseRef.current();
        };
        window.addEventListener('popstate', alVolver);

        return () => {
            window.removeEventListener('popstate', alVolver);
            const estado = window.history.state as EstadoHistorial;
            // Sólo se retira si la entrada sigue siendo la nuestra: si el gesto ya
            // la consumió, `history.back()` se llevaría por delante un paso de
            // navegación real.
            if (!consumidaPorElGesto && estado?.[MARCA]) {
                window.history.back();
            }
        };
    }, [isOpen]);
}
