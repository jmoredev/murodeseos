"use client";

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    isDestructive = false
}: ConfirmModalProps) {
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const titleId = useId();
    const messageId = useId();
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            const timer = setTimeout(() => setVisible(false), 300);
            return () => clearTimeout(timer);
        }
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

        const t = window.requestAnimationFrame(() => {
            document.querySelector<HTMLButtonElement>('[data-confirm-cancel]')?.focus();
        });

        return () => {
            window.cancelAnimationFrame(t);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) return;
        previouslyFocused.current?.focus?.();
    }, [isOpen]);

    if (!mounted) return null;

    if (!visible && !isOpen) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
            role="presentation"
        >
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default"
                onClick={onClose}
                aria-hidden
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={messageId}
                className={`relative z-10 w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-ambient-lg p-6 transform transition-all duration-300 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
            >
                <div className="mb-6">
                    <h3 id={titleId} className="text-xl font-sans-bold text-on-background mb-2">
                        {title}
                    </h3>
                    <p id={messageId} className="text-on-surface/65 leading-relaxed font-sans">
                        {message}
                    </p>
                </div>

                <div className="flex gap-3 justify-end">
                    <button
                        type="button"
                        data-confirm-cancel
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-full text-sm font-sans-semibold text-primary active:opacity-70 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-4 py-2.5 rounded-full text-sm font-sans-semibold text-on-primary shadow-ambient transition-all active:scale-95 ${isDestructive
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-primary hover:opacity-90'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
