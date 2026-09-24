'use client';

import { useEffect, useRef, useState } from 'react';
import { getLatestUpdate } from '@/lib/updates';
import packageJson from '@/package.json';

export default function WhatsNewModal() {
    const [isOpen, setIsOpen] = useState(false);
    const latestUpdate = getLatestUpdate();
    const currentVersion = packageJson.version;
    const titleRef = useRef<HTMLHeadingElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const lastSeenVersion = localStorage.getItem('lastSeenVersion');

        if (latestUpdate.version === currentVersion && lastSeenVersion !== currentVersion) {
            setIsOpen(true);
        }
    }, [latestUpdate.version, currentVersion]);

    useEffect(() => {
        if (!isOpen) return;

        previouslyFocused.current = document.activeElement as HTMLElement | null;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        const t = window.setTimeout(() => {
            titleRef.current?.focus();
        }, 0);

        return () => {
            window.clearTimeout(t);
            document.removeEventListener('keydown', handleKeyDown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) return;
        previouslyFocused.current?.focus?.();
    }, [isOpen]);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('lastSeenVersion', currentVersion);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-ambient-lg overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-outline-variant/10"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="bg-gradient-to-br from-primary to-primary-container p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-on-primary/15 text-on-primary" aria-hidden>
                            <span className="text-xl">✨</span>
                        </span>
                        <span className="text-xs font-sans-medium text-on-primary/80 bg-on-primary/10 px-2 py-1 rounded-full">
                            v{latestUpdate.version}
                        </span>
                    </div>
                    <h2
                        id="modal-title"
                        ref={titleRef}
                        tabIndex={-1}
                        className="text-2xl font-display text-on-primary mb-1 tracking-tight"
                    >
                        Novedades
                    </h2>
                    <p className="text-sm text-on-primary/85 font-sans">
                        Descubre lo nuevo en esta actualización
                    </p>
                </div>

                <div className="p-6 bg-surface-container-lowest">
                    <div className="space-y-4">
                        <h3 className="text-sm font-sans-semibold text-on-surface/55 uppercase tracking-wider">
                            Cambios realizados
                        </h3>
                        <ul className="space-y-3">
                            {latestUpdate.changes.map((change, index) => (
                                <li key={index} className="flex items-start gap-3 text-on-background font-sans text-sm">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                    <span className="leading-relaxed">{change}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="p-4 bg-surface-container-low flex justify-end">
                    <button
                        onClick={handleClose}
                        className="px-6 py-2.5 bg-primary text-on-primary font-sans-bold rounded-full hover:opacity-90 active:scale-95 transition-all text-sm shadow-ambient"
                    >
                        ¡Entendido!
                    </button>
                </div>
            </div>
        </div>
    );
}
