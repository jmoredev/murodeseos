import { useSyncExternalStore } from 'react';

/**
 * `true` solo en el cliente. En el servidor no hay DOM, así que los modales y menús que
 * se pintan con portales no deben aparecer hasta hidratar.
 *
 * Es un estado externo leído con `useSyncExternalStore`, no un efecto que fija estado:
 * así la primera pintura del cliente coincide con la del servidor y no hay desajuste de
 * hidratación. Vive aquí porque lo usan tres componentes con el mismo texto.
 */

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useClientMounted(): boolean {
    return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
