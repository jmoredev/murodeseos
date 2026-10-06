import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, renderHook } from '@testing-library/react';
import { useIsDesktop } from '@/lib/use-is-desktop';

const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

function setWindowWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

afterEach(() => {
    // Mismo patrón que `__tests__/NotificationMenu.test.tsx`: restauramos la
    // propiedad original de `window` para no contaminar otras pruebas.
    if (originalInnerWidth) {
        Object.defineProperty(window, 'innerWidth', originalInnerWidth);
    } else {
        delete (window as { innerWidth?: unknown }).innerWidth;
    }
});

describe('useIsDesktop', () => {
    it('applies the strict threshold: 768 is mobile, 769 and 1024 are desktop', () => {
        setWindowWidth(768);
        expect(renderHook(useIsDesktop).result.current).toBe(false);

        setWindowWidth(769);
        expect(renderHook(useIsDesktop).result.current).toBe(true);

        setWindowWidth(1024);
        expect(renderHook(useIsDesktop).result.current).toBe(true);
    });

    it('updates the value after a dispatched resize event', () => {
        setWindowWidth(700);
        const { result } = renderHook(useIsDesktop);
        expect(result.current).toBe(false);

        setWindowWidth(1024);
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
        expect(result.current).toBe(true);
    });

    it('renders the server snapshot as false, without touching window', () => {
        // En el cliente, 1024 diría "escritorio"; durante el render de servidor
        // `useSyncExternalStore` usa la captura de servidor (`false`) y no debe
        // lanzar por `window`. Importa porque `expo export` prerenderiza.
        setWindowWidth(1024);
        const Probe = () => React.createElement('span', null, String(useIsDesktop()));

        expect(renderToString(React.createElement(Probe))).toBe('<span>false</span>');
    });

    it('registers its window listeners and removes them on unmount', () => {
        const addSpy = vi.spyOn(window, 'addEventListener');
        const removeSpy = vi.spyOn(window, 'removeEventListener');

        const { unmount } = renderHook(useIsDesktop);
        const added = addSpy.mock.calls.filter(
            ([type]) => type === 'resize' || type === 'orientationchange'
        );
        expect(added.map(([type]) => type)).toEqual(['resize', 'orientationchange']);

        unmount();

        // Cada escucha añadida tiene su baja exacta (mismo tipo y misma función).
        for (const call of added) {
            expect(removeSpy.mock.calls).toContainEqual(call);
        }

        addSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
