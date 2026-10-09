import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

/**
 * La app no exportaba ningún `ErrorBoundary`, así que un error de render
 * desmontaba el árbol de React y dejaba una pantalla vacía, sin texto y sin
 * salida: eso es la mitad del «pantallazo negro» que reportó el propietario.
 *
 * Se cubren las dos partes: que exista el **enganche** con `expo-router` (que es
 * lo que faltaba) y que la **pantalla** sea legible y tenga salidas de verdad.
 */
describe('AppErrorBoundary', () => {
    it('enseña el error con dos salidas: reintentar y recargar', () => {
        const retry = vi.fn();
        const recargar = vi.fn();
        render(<AppErrorBoundary error={new Error('boom')} retry={retry} onReload={recargar} />);

        expect(screen.getByText('Algo ha ido mal')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Reintentar'));
        expect(retry).toHaveBeenCalledTimes(1);

        // La segunda salida importa: hay fallos de los que no se sale re-montando.
        fireEvent.click(screen.getByLabelText('Recargar'));
        expect(recargar).toHaveBeenCalledTimes(1);
    });

    it('no depende de las fuentes de la marca', () => {
        // Si el error ocurre antes de que carguen las fuentes —o son ellas la
        // causa—, una pantalla de error con texto invisible sería el mismo vacío
        // con más pasos. Todo el texto fija una pila del sistema.
        render(<AppErrorBoundary error={new Error('boom')} retry={vi.fn()} onReload={vi.fn()} />);

        for (const texto of screen.getAllByText(/.+/)) {
            expect(texto.getAttribute('style') ?? '').toContain('system-ui');
        }
    });

    it('la raíz de la app exporta el ErrorBoundary que expo-router recoge', () => {
        // `expo-router` envuelve una ruta SÓLO si su módulo exporta `ErrorBoundary`
        // (node_modules/expo-router/build/useScreens.js: fromImport). Sin este
        // enganche, el componente de arriba sería código muerto.
        const layout = readFileSync(join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');

        expect(layout).toMatch(/export\s+(function\s+ErrorBoundary|const\s+ErrorBoundary|\{[^}]*ErrorBoundary)/);
    });
});
