import { useSyncExternalStore } from 'react';

/**
 * Regla de producto (decisión del propietario): umbral único y estricto
 * **`width > 768`** — 768 incluido sigue perteneciendo a la banda móvil. Este
 * módulo es el único lugar del código donde vive el literal: antes el umbral
 * estaba copiado a mano en nueve sitios (siete componentes y dos pantallas),
 * uno de ellos con su propia tienda `useSyncExternalStore` en
 * `NotificationMenu`.
 *
 * Se lee con `useSyncExternalStore` y no con un efecto que fija estado, por lo
 * mismo que en `lib/use-client-mounted.ts`: una captura booleana estable sin
 * renders extra, y la misma semántica que ya tenía aquella tienda local (el
 * render reacciona a los eventos, no a un estado duplicado). La captura de
 * servidor es `false` y la de cliente no lanza aunque `window` no esté
 * disponible.
 *
 * Suscribimos también a `orientationchange`: en móvil la rotación cambia el
 * ancho sin que siempre medie un evento `resize`.
 */

type OnStoreChange = () => void;

function subscribe(onStoreChange: OnStoreChange) {
    window.addEventListener('resize', onStoreChange);
    window.addEventListener('orientationchange', onStoreChange);
    return () => {
        window.removeEventListener('resize', onStoreChange);
        window.removeEventListener('orientationchange', onStoreChange);
    };
}

function getClientSnapshot() {
    return typeof window !== 'undefined' && window.innerWidth > 768;
}

function getServerSnapshot() {
    return false;
}

export function useIsDesktop(): boolean {
    return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
