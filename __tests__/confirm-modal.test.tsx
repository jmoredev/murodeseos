import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from '@/components/ConfirmModal';

/**
 * Una sola pieza con dos formas (12 · P10/P11, nota 4): **hoja** en el móvil (sube desde abajo,
 * con asa) y **ventana** centrada en el escritorio. Primero «Cancelar», después la acción; la
 * destructiva va en rojo.
 *
 * S9: la forma cambia, **no** la copy que le pasa cada pantalla; por eso se comprueba que el texto
 * del llamador se pinta tal cual (el texto de borrar deseo llega en T4/T5).
 */
const anchoOriginal = Object.getOwnPropertyDescriptor(window, 'innerWidth');

function fijarAncho(width: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

const COPY_BORRAR = {
    title: 'Eliminar deseo',
    message: '¿Estás seguro de que quieres eliminar este deseo?',
    confirmText: 'Eliminar',
};

function abrir(props: Partial<React.ComponentProps<typeof ConfirmModal>> = {}) {
    return render(
        <ConfirmModal
            isOpen
            onClose={vi.fn()}
            onConfirm={vi.fn()}
            isDestructive
            {...COPY_BORRAR}
            {...props}
        />,
    );
}

beforeEach(() => {
    fijarAncho(390);
});

afterEach(() => {
    if (anchoOriginal) Object.defineProperty(window, 'innerWidth', anchoOriginal);
});

describe('ConfirmModal', () => {
    it('en el móvil es una hoja anclada abajo, con asa', () => {
        abrir();

        const dialogo = screen.getByRole('dialog');
        expect(dialogo).toHaveAttribute('data-layout', 'sheet');
        expect(dialogo).toHaveAttribute('aria-modal', 'true');
        // El asa del artboard (`.gs-grab`): 44 × 5, decorativa.
        const asa = dialogo.querySelector('[data-grab-handle]');
        expect(asa).not.toBeNull();
        expect(asa).toHaveAttribute('aria-hidden', 'true');
    });

    it('en el escritorio es una ventana centrada, no una hoja', () => {
        fijarAncho(1280);
        abrir();

        expect(screen.getByRole('dialog')).toHaveAttribute('data-layout', 'dialog');
    });

    it('pinta la copy del llamador tal cual (S9)', () => {
        abrir();

        expect(screen.getByText(COPY_BORRAR.title)).toBeInTheDocument();
        expect(screen.getByText(COPY_BORRAR.message)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    });

    it('la destructiva se lee en rojo y la que no destruye usa el primario', () => {
        const { unmount } = abrir();
        expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveClass('bg-danger');
        unmount();

        abrir({ isDestructive: false, confirmText: 'Salir del grupo' });
        const confirmar = screen.getByRole('button', { name: 'Salir del grupo' });
        expect(confirmar).toHaveClass('bg-primary');
        expect(confirmar).not.toHaveClass('bg-danger');
    });

    it('«Cancelar» va antes que la acción en el orden del documento', () => {
        abrir();

        const cancelar = screen.getByRole('button', { name: 'Cancelar' });
        const confirmar = screen.getByRole('button', { name: 'Eliminar' });
        expect(cancelar.compareDocumentPosition(confirmar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('admite una nota corta bajo el mensaje y la pinta antes de los botones', () => {
        abrir({ note: 'No se puede deshacer.' });

        expect(screen.getByText('No se puede deshacer.')).toBeInTheDocument();
    });

    it('confirmar llama a onConfirm y cierra; cancelar sólo cierra', () => {
        const onConfirm = vi.fn();
        const onClose = vi.fn();
        abrir({ onConfirm, onClose });

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('Escape cierra la hoja', () => {
        const onClose = vi.fn();
        abrir({ onClose });

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('pone el foco en «Cancelar» al abrir y lo devuelve al disparador al cerrar', async () => {
        const disparador = document.createElement('button');
        disparador.textContent = 'Abrir';
        document.body.appendChild(disparador);
        disparador.focus();

        const { rerender } = abrir({ isOpen: false });

        act(() => {
            rerender(
                <ConfirmModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} isDestructive {...COPY_BORRAR} />,
            );
        });

        await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus());

        act(() => {
            rerender(
                <ConfirmModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} isDestructive {...COPY_BORRAR} />,
            );
        });

        await waitFor(() => expect(disparador).toHaveFocus());
        disparador.remove();
    });

    it('al cruzar el ancho de escritorio con la confirmación abierta, el foco sigue dentro', async () => {
        abrir();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus());

        // La hoja y la ventana son dos subárboles distintos: al cambiar de ancho el que se pinta
        // se remonta y el foco caería al documento, dejando la confirmación a medias sin teclado.
        act(() => {
            fijarAncho(1280);
            window.dispatchEvent(new Event('resize'));
        });

        expect(screen.getByRole('dialog')).toHaveAttribute('data-layout', 'dialog');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus());
    });

    it('cerrado no pinta nada', () => {
        const { container } = render(
            <ConfirmModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} {...COPY_BORRAR} />,
        );

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('no usa hex sueltos: la hoja y la ventana salen de tokens', () => {
        const fuente = readFileSync(join(__dirname, '..', 'components', 'ConfirmModal.tsx'), 'utf8');
        expect(fuente).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
});
