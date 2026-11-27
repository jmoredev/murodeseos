import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * ¿Hay conexión? (12 · P4, S8.)
 *
 * Hoy la app no detecta la conexión en ningún sitio (Log L8). En **web** basta con
 * `navigator.onLine` y los eventos `online`/`offline` del navegador: son la única fuente que no
 * añade dependencias ni inventa estado. En **nativo** no hay una fuente equivalente sin una
 * librería nueva, así que el hook es inerte y responde siempre «en línea»: mejor no avisar que
 * avisar en falso (S8: aviso simple, sin prometer datos guardados).
 *
 * Se lee con `useSyncExternalStore` por el mismo motivo que `lib/use-is-desktop.ts`: una captura
 * estable sin renders extra, sin un efecto que fije estado, y con captura de servidor explícita
 * (en el servidor no hay `navigator`: «en línea», que es lo que no pinta nada raro al hidratar).
 */

export interface ConnectivityStore {
    /** `true` sólo si la plataforma puede saberlo (web). */
    readonly supported: boolean;
    /** Estado actual; «en línea» cuando no hay fuente. */
    getSnapshot(): boolean;
    /** Se suscribe a los cambios; devuelve la baja. */
    subscribe(onChange: () => void): () => void;
}

/**
 * Fábrica con la plataforma como argumento para poder probar las dos ramas sin tocar el runtime.
 * La instancia de producción se crea abajo con `Platform.OS`.
 */
export function createConnectivityStore(platformOS: string): ConnectivityStore {
    const supported = platformOS === 'web';

    const getSnapshot = (): boolean => {
        if (!supported) return true;
        if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return true;
        return navigator.onLine;
    };

    const subscribe = (onChange: () => void): (() => void) => {
        if (!supported || typeof window === 'undefined') return () => {};
        window.addEventListener('online', onChange);
        window.addEventListener('offline', onChange);
        return () => {
            window.removeEventListener('online', onChange);
            window.removeEventListener('offline', onChange);
        };
    };

    return { supported, getSnapshot, subscribe };
}

/** La instancia real: en web escucha al navegador; en nativo es inerte. */
export const connectivity = createConnectivityStore(Platform.OS);

const getServerSnapshot = (): boolean => true;

export function useOnline(): boolean {
    return useSyncExternalStore(connectivity.subscribe, connectivity.getSnapshot, getServerSnapshot);
}
