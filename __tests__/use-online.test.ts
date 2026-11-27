import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConnectivityStore, useOnline } from '@/lib/use-online';

/**
 * La app no tenía ninguna detección de conexión (Log L8). En web basta con `navigator.onLine` y
 * los eventos `online`/`offline`; en nativo el hook es inerte y responde siempre «en línea»,
 * porque no hay una fuente equivalente sin añadir una dependencia (S8: aviso simple, sin prometer
 * datos guardados).
 */
const descriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

function setOnLine(value: boolean) {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

beforeEach(() => {
    setOnLine(true);
});

afterEach(() => {
    if (descriptor) Object.defineProperty(window.navigator, 'onLine', descriptor);
});

describe('createConnectivityStore', () => {
    it('en web lee `navigator.onLine` y avisa de los eventos online/offline', () => {
        const store = createConnectivityStore('web');
        const onChange = vi.fn();
        const unsubscribe = store.subscribe(onChange);

        expect(store.supported).toBe(true);
        expect(store.getSnapshot()).toBe(true);

        act(() => {
            setOnLine(false);
            window.dispatchEvent(new Event('offline'));
        });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot()).toBe(false);

        act(() => {
            setOnLine(true);
            window.dispatchEvent(new Event('online'));
        });
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(store.getSnapshot()).toBe(true);

        unsubscribe();
        window.dispatchEvent(new Event('offline'));
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('en nativo no se suscribe a nada y responde siempre «en línea»', () => {
        const store = createConnectivityStore('ios');
        const onChange = vi.fn();
        const unsubscribe = store.subscribe(onChange);

        expect(store.supported).toBe(false);
        expect(store.getSnapshot()).toBe(true);

        setOnLine(false);
        window.dispatchEvent(new Event('offline'));
        expect(onChange).not.toHaveBeenCalled();
        expect(store.getSnapshot()).toBe(true);

        expect(() => unsubscribe()).not.toThrow();
    });
});

describe('useOnline', () => {
    it('arranca con el estado real y reacciona a los eventos, sin recargar la pantalla', () => {
        const { result } = renderHook(() => useOnline());
        expect(result.current).toBe(true);

        act(() => {
            setOnLine(false);
            window.dispatchEvent(new Event('offline'));
        });
        expect(result.current).toBe(false);

        act(() => {
            setOnLine(true);
            window.dispatchEvent(new Event('online'));
        });
        expect(result.current).toBe(true);
    });

    it('si el navegador no expone `navigator.onLine`, no inventa un estado sin conexión', () => {
        Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: undefined });

        const { result } = renderHook(() => useOnline());

        expect(result.current).toBe(true);
    });
});
