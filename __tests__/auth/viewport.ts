import { act } from '@testing-library/react';

/**
 * `useIsDesktop` lee `window.innerWidth` dentro de un `useSyncExternalStore` que
 * escucha `resize`; por eso el ancho de las pruebas se fija así, sin mocks del
 * módulo. jsdom arranca en 1024 px, que ya cuenta como escritorio (`> 768`).
 *
 * Cada fichero que lo use guarda el descriptor original en `beforeEach` y lo
 * restaura en `afterEach`: el ancho es estado global del entorno de jsdom y
 * dejarlo cambiado hace que la siguiente prueba mida otra cosa.
 */
export function setViewportWidth(width: number): void {
    act(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
        window.dispatchEvent(new Event('resize'));
    });
}
