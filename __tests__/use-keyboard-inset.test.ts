import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useKeyboardInset } from '@/lib/use-keyboard-inset';

type Listener = (event?: unknown) => void;

// jsdom no implementa `window.visualViewport`; instalamos un doble con
// espías de escuchas y la aritmética controlada por cada prueba.
function installFakeViewport() {
    const listeners = new Map<string, Set<Listener>>();
    const fake = {
        height: 700,
        offsetTop: 0,
        addEventListener: vi.fn((type: string, listener: Listener) => {
            const set = listeners.get(type) ?? new Set<Listener>();
            set.add(listener);
            listeners.set(type, set);
        }),
        removeEventListener: vi.fn((type: string, listener: Listener) => {
            listeners.get(type)?.delete(listener);
        }),
        dispatch(type: string) {
            listeners.get(type)?.forEach((listener) => listener());
        },
    };
    Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: fake,
        writable: true,
    });
    return fake;
}

function setInnerHeight(value: number) {
    Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value,
    });
}

afterEach(() => {
    // `delete` sobre la propia instancia de `window`: la propiedad fue creada
    // (o redefinida) con `configurable: true`, así que se puede eliminar.
    delete (window as { visualViewport?: unknown }).visualViewport;
    vi.restoreAllMocks();
});

describe('useKeyboardInset', () => {
    it('returns 0 when window.visualViewport is undefined', () => {
        expect(window.visualViewport).toBeUndefined();
        const { result } = renderHook(() => useKeyboardInset());
        expect(result.current).toBe(0);
    });

    it('returns 0 when disabled and registers no listeners', () => {
        const crane = installFakeViewport();
        const { result } = renderHook(() => useKeyboardInset(false));
        expect(result.current).toBe(0);
        expect(crane.addEventListener).not.toHaveBeenCalled();
    });

    it('computes the overlap from innerHeight, height and offsetTop', () => {
        const crane = installFakeViewport();
        setInnerHeight(800);
        crane.height = 300;
        crane.offsetTop = 100;

        const { result } = renderHook(() => useKeyboardInset());

        // overlap = max(0, round(800 - (300 + 100))) = 400
        expect(result.current).toBe(400);
    });

    it('clamps to 0 when the visual viewport is taller than innerHeight', () => {
        const crane = installFakeViewport();
        setInnerHeight(800);
        crane.height = 900;
        crane.offsetTop = 0;

        const { result } = renderHook(() => useKeyboardInset());
        expect(result.current).toBe(0);
    });

    it('re-renders with the new value after a viewport resize event', () => {
        const crane = installFakeViewport();
        setInnerHeight(800);
        crane.height = 700;
        crane.offsetTop = 0;

        const { result } = renderHook(() => useKeyboardInset());
        // 800 - (700 + 0) = 100: solape inicial medido al montar.
        expect(result.current).toBe(100);

        crane.height = 350;
        act(() => {
            crane.dispatch('resize');
        });

        expect(result.current).toBe(450); // 800 - (350 + 0)
    });

    it('returns to 0 when enabled flips to false', () => {
        const crane = installFakeViewport();
        setInnerHeight(800);
        crane.height = 700;
        crane.offsetTop = 0;

        const { result, rerender } = renderHook(({ enabled }: { enabled?: boolean }) => useKeyboardInset(enabled), {
            initialProps: { enabled: true },
        });
        // 800 - (700 + 0) = 100: solape que no debe sobrevivir a la desactivación.
        expect(result.current).toBe(100);

        rerender({ enabled: false });

        expect(result.current).toBe(0);
    });

    it('removes every listener on unmount', () => {
        const crane = installFakeViewport();
        const removeWindowSpy = vi.spyOn(window, 'removeEventListener');

        const { unmount } = renderHook(() => useKeyboardInset());
        const viewportTypes = crane.addEventListener.mock.calls.map((call) => call[0]);
        expect(viewportTypes).toEqual(['resize', 'scroll']);

        unmount();

        const viewportRemoved = crane.removeEventListener.mock.calls.map((call) => call[0]);
        expect(viewportRemoved).toEqual(['resize', 'scroll']);
        const windowRemoved = removeWindowSpy.mock.calls.map((call) => call[0]);
        expect(windowRemoved).toEqual(['resize', 'orientationchange']);
    });
});
