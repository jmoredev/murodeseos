"use client";

import React, { useEffect, useId, useRef } from 'react';

interface RevealModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupName: string;
    receiverName: string;
    receiverAvatar?: string;
}

export function RevealModal({ isOpen, onClose, groupName, receiverName, receiverAvatar }: RevealModalProps) {
    const titleId = useId();
    const previouslyFocused = useRef<HTMLElement | null>(null);

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
            document.getElementById(titleId)?.focus?.();
        });

        return () => {
            window.cancelAnimationFrame(t);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen, onClose, titleId]);

    useEffect(() => {
        if (isOpen) return;
        previouslyFocused.current?.focus?.();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-md animate-in fade-in duration-300"
            role="presentation"
        >
            <div className="absolute inset-0 cursor-default" aria-hidden onClick={onClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative z-10 w-full max-w-sm bg-surface-container-lowest rounded-3xl shadow-ambient-lg overflow-hidden transform animate-in zoom-in-95 duration-300 flex flex-col items-center p-8 ring-1 ring-outline-variant/10"
            >
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" aria-hidden />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary-container/20 rounded-full blur-3xl pointer-events-none" aria-hidden />

                <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-container rounded-2xl flex items-center justify-center text-4xl shadow-ambient-lg mb-6 relative animate-bounce" aria-hidden>
                    🎁
                </div>

                <h2 id={titleId} tabIndex={-1} className="text-2xl font-display text-on-background text-center mb-2 leading-tight tracking-tight outline-none">
                    ¡Sorteo realizado!
                </h2>
                <p className="text-on-surface/65 text-center text-sm mb-8 px-4 font-sans">
                    Se ha realizado el Amigo Invisible en el grupo <span className="font-sans-bold text-on-background">{groupName}</span>.
                </p>

                <div className="w-full bg-surface-container-low rounded-2xl p-6 flex flex-col items-center mb-8">
                    <p className="text-[10px] font-sans-bold text-on-surface/45 uppercase tracking-widest mb-4">Te ha tocado regalar a:</p>

                    <div className="w-24 h-24 rounded-full bg-surface-container-lowest ring-2 ring-primary/25 shadow-ambient flex items-center justify-center mb-4 overflow-hidden">
                        {receiverAvatar && receiverAvatar.startsWith('http') ? (
                            <img src={receiverAvatar} alt={receiverName} className="w-full h-full object-cover" />
                        ) : receiverAvatar ? (
                            <span className="text-4xl" aria-hidden>{receiverAvatar}</span>
                        ) : (
                            <span className="text-3xl font-display text-primary" aria-hidden>{receiverName.charAt(0).toUpperCase()}</span>
                        )}
                    </div>

                    <h3 className="text-xl font-display text-on-background text-center">
                        {receiverName}
                    </h3>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-4 bg-on-background text-surface-container-lowest font-sans-bold rounded-full shadow-ambient-lg hover:opacity-95 active:scale-[0.98] transition-all"
                >
                    ¡Entendido!
                </button>

                <p className="mt-4 text-[10px] text-on-surface/45 text-center font-sans">
                    Podrás volver a consultar este resultado en el detalle del grupo.
                </p>
            </div>
        </div>
    );
}
