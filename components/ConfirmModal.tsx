"use client";

import React, { useEffect, useId, useRef, useState } from 'react';
import { useClientMounted } from '@/lib/use-client-mounted';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { createPortal } from 'react-dom';

/**
 * Confirmación (12 · P10/P11, nota 4). Una sola pieza con dos formas:
 *
 * - **Móvil**: hoja que sube desde abajo, con asa, esquinas superiores de 28 px y velo al 52 %.
 * - **Escritorio**: ventana centrada de 520 px con velo al 30 %.
 *
 * En las dos, **primero «Cancelar» y después la acción**; la destructiva va en rojo y no compite
 * con la secundaria por el color. Máximo dos botones.
 *
 * S9: la forma cambia, **no** la copy que le pasa cada pantalla. `WishListTab` sigue diciendo
 * «Eliminar deseo · ¿Estás seguro de que quieres eliminar este deseo? · Eliminar» hasta T4/T5; por
 * eso este componente no reescribe nada de lo que recibe, y la nota corta del artboard
 * («No se puede deshacer.») es una prop **opcional** que cada tramo podrá pasar cuando toque.
 */

export interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    /** Nota corta bajo el mensaje («No se puede deshacer.»). Opcional: la copy la decide la pantalla. */
    note?: string;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDestructive = false,
    note,
}: ConfirmModalProps) {
    // En el servidor no hay DOM: el modal no se pinta hasta hidratar.
    const mounted = useClientMounted();
    // La misma regla de ancho que el resto de la app (lib/use-is-desktop.ts): hoja hasta 768.
    const isDesktop = useIsDesktop();
    const [visible, setVisible] = useState(false);
    const titleId = useId();
    const messageId = useId();
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            // La entrada va en el siguiente cuadro, para que el primer render pinte el
            // estado cerrado y el cambio dispare la transición.
            const frame = window.requestAnimationFrame(() => setVisible(true));
            return () => window.cancelAnimationFrame(frame);
        }

        const timer = setTimeout(() => setVisible(false), 300);
        return () => clearTimeout(timer);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        previouslyFocused.current = document.activeElement as HTMLElement | null;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    /**
     * El foco se pone en «Cancelar» al abrir **y también al cambiar de forma** (hoja ⇄ ventana):
     * son dos subárboles distintos, así que al cruzar el ancho de escritorio el que se pinta se
     * remonta y el foco caería al documento, dejando la confirmación abierta sin teclado. Se
     * vuelve a poner dentro en vez de mover el foco a un botón concreto que el usuario no eligió.
     */
    useEffect(() => {
        if (!isOpen) return;

        const t = window.requestAnimationFrame(() => {
            document.querySelector<HTMLButtonElement>('[data-confirm-cancel]')?.focus();
        });

        return () => window.cancelAnimationFrame(t);
    }, [isOpen, isDesktop]);

    useEffect(() => {
        if (isOpen) return;
        previouslyFocused.current?.focus?.();
    }, [isOpen]);

    if (!mounted) return null;

    if (!visible && !isOpen) return null;

    const icono = (
        <span
            aria-hidden="true"
            className={`grid h-14 w-14 place-items-center rounded-[18px] ${
                isDestructive ? 'bg-danger-soft text-danger' : 'bg-sand text-sand-ink'
            }`}
        >
            {isDestructive ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.6 6.8h14.8" />
                    <path d="M9.4 6.8V4.9h5.2v1.9" />
                    <path d="m6.6 6.8.9 12.1a1.8 1.8 0 0 0 1.8 1.6h5.4a1.8 1.8 0 0 0 1.8-1.6l.9-12.1" />
                    <path d="M10.2 10.6v6.4M13.8 10.6v6.4" />
                </svg>
            ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                    <circle cx="12" cy="12" r="8.6" />
                    <path d="M9.6 9.4a2.5 2.5 0 1 1 3.2 2.7c-.6.2-.8.7-.8 1.3v.6" />
                    <circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" />
                </svg>
            )}
        </span>
    );

    const cuerpo = (
        <>
            {icono}
            <h2
                id={titleId}
                className={`font-display-extrabold text-ink ${
                    isDesktop
                        ? 'mt-3.5 text-[25px] leading-[1.2] tracking-[-0.02em]'
                        : 'mt-3 text-[23px] leading-[1.2] tracking-[-0.015em]'
                }`}
            >
                {title}
            </h2>
            <p id={messageId} className="mt-2.5 text-[17px] leading-[1.45] text-ink-2">
                {message}
            </p>
            {note ? (
                <p className="mt-2.5 rounded-xl bg-surface px-3 py-2.5 text-[16px] font-bold leading-[1.35] text-ink-2">
                    {note}
                </p>
            ) : null}
        </>
    );

    const botonCancelar = (
        <button
            type="button"
            data-confirm-cancel
            onClick={onClose}
            className="min-h-[48px] rounded-full border-2 border-border-strong bg-surface px-5 py-2.5 text-[17px] font-bold text-ink transition-colors hover:bg-hover-control hover:border-ink-2"
        >
            {cancelText}
        </button>
    );

    const botonConfirmar = (
        <button
            type="button"
            onClick={() => {
                onConfirm();
                onClose();
            }}
            className={`min-h-[48px] rounded-full px-5 py-2.5 text-[17px] font-bold text-white transition-colors ${
                isDestructive
                    ? 'bg-danger shadow-sh-danger hover:bg-danger-dark'
                    : 'bg-primary shadow-sh-cta hover:bg-primary-dark'
            }`}
        >
            {confirmText}
        </button>
    );

    return createPortal(
        <div
            className={`fixed inset-0 z-50 flex transition-opacity duration-300 ${
                isOpen ? 'opacity-100' : 'opacity-0'
            } ${isDesktop ? 'items-center justify-center p-4' : 'items-end'}`}
            role="presentation"
        >
            {/* Velo: 52 % en el móvil y 30 % en el escritorio (§10.9 y §10.10). */}
            <div
                className={`absolute inset-0 cursor-default ${isDesktop ? 'bg-ink/30' : 'bg-ink/[0.52]'}`}
                onClick={onClose}
                aria-hidden
            />

            {isDesktop ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    aria-describedby={messageId}
                    data-layout="dialog"
                    className="relative z-10 w-full max-w-[520px] rounded-3xl bg-surface p-6 shadow-sh-dialog"
                >
                    {cuerpo}
                    <div className="mt-5 flex justify-end gap-2.5">
                        {botonCancelar}
                        {botonConfirmar}
                    </div>
                </div>
            ) : (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    aria-describedby={messageId}
                    data-layout="sheet"
                    className="relative z-10 w-full rounded-t-[28px] bg-surface px-5 pb-7 pt-2.5 shadow-sh-sheet"
                >
                    {/* Asa de 44 × 5 (§10.9): decorativa, marca que la hoja se puede arrastrar. */}
                    <div
                        data-grab-handle
                        aria-hidden="true"
                        className="mx-auto mb-2.5 h-[5px] w-11 rounded-full bg-border-strong"
                    />
                    {cuerpo}
                    <div className="mt-4 grid gap-2.5">
                        {botonCancelar}
                        {botonConfirmar}
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
