'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LAST_SEEN_UPDATE_ID_KEY, getLatestUpdate, shouldAnnounceUpdate } from '@/lib/updates';

/**
 * Novedades de la versión (12 · P12). La lógica no cambia: se anuncia una vez por **entrada**
 * (`lib/updates.ts`) y al cerrarse se guarda su `id`. Lo que entra en T2a es la estética del
 * artboard: cabecera sobre `--primary-soft` con el destello en un tile blanco y la etiqueta
 * `v<release>` en píldora, subtítulo nuevo y la etiqueta «En esta versión» sobre la lista.
 *
 * S9: **no** se añade el enlace «Ver todo el historial en Avisos»; eso llega en T8, cuando Avisos
 * exista como pestaña y con historial.
 *
 * La cabecera y el pie quedan fijos y **solo** la lista hace scroll: con ocho novedades la tarjeta
 * es más alta que una pantalla de 720 px y sin esto el botón para cerrar caía fuera del viewport
 * (medido en CI el 2026-10-21, con captura: el `click` de Playwright agotaba sus 30 s). En un móvil
 * no hay Escape que lo salve: el modal era una trampa.
 */
export default function WhatsNewModal() {
    const latestUpdate = getLatestUpdate();
    const titleRef = useRef<HTMLHeadingElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);
    const [dismissed, setDismissed] = useState(false);

    // Leer localStorage no puede ocurrir en el render del servidor, así que el snapshot
    // del servidor dice «no anunciar» y el cliente lo decide al hidratar. La condición vive en
    // `lib/updates.ts` y se prueba sola: acá sólo se le pasa lo que el dispositivo recuerda.
    const shouldAnnounce = useSyncExternalStore(
        () => () => {},
        () => shouldAnnounceUpdate(latestUpdate, localStorage.getItem(LAST_SEEN_UPDATE_ID_KEY)),
        () => false,
    );

    const isOpen = shouldAnnounce && !dismissed;

    const handleClose = useCallback(() => {
        setDismissed(true);
        // Se guarda el `id` de la entrada, no una versión: es lo que hace que la próxima
        // publicación vuelva a anunciarse aunque el número de la app no cambie.
        if (latestUpdate) localStorage.setItem(LAST_SEEN_UPDATE_ID_KEY, latestUpdate.id);
    }, [latestUpdate]);

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
    }, [isOpen, handleClose]);

    useEffect(() => {
        if (isOpen) return;
        previouslyFocused.current?.focus?.();
    }, [isOpen]);

    if (!isOpen || !latestUpdate) return null;

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 px-3.5 pb-[18px] pt-[50px]">
            <div
                className="flex max-h-full w-full max-w-[520px] flex-col overflow-hidden rounded-3xl bg-surface-container-lowest shadow-sh-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                aria-describedby="modal-subtitle"
            >
                <div className="shrink-0 border-b border-primary-line bg-primary-soft px-[18px] pb-3.5 pt-4">
                    <div className="flex items-center justify-between gap-2.5">
                        <span
                            className="grid h-[46px] w-[46px] place-items-center rounded-[14px] bg-surface-container-lowest text-primary-dark shadow-sh-1"
                            aria-hidden="true"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                                <path d="M12 3.4 13.8 9 19.4 10.8 13.8 12.6 12 18.2 10.2 12.6 4.6 10.8 10.2 9Z" />
                                <path d="M18.4 16.2 19 18.2 21 18.8 19 19.4 18.4 21.4 17.8 19.4 15.8 18.8 17.8 18.2Z" />
                            </svg>
                        </span>
                        <span className="rounded-full bg-surface-container-lowest px-[11px] py-1 text-[15px] font-extrabold text-primary-dark">
                            v{latestUpdate.release}
                        </span>
                    </div>
                    <h2
                        id="modal-title"
                        ref={titleRef}
                        tabIndex={-1}
                        className="mt-3 font-display-extrabold text-[25px] leading-[1.15] tracking-[-0.02em] text-ink"
                    >
                        Novedades
                    </h2>
                    <p id="modal-subtitle" className="mt-1 text-[16px] leading-[1.35] text-sand-ink">
                        Lo que ha cambiado desde la última vez que entraste.
                    </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-3.5">
                    <p className="text-[15px] font-extrabold uppercase tracking-[0.05em] text-ink-2">
                        En esta versión
                    </p>
                    <ul className="mt-2.5 grid gap-[11px]">
                        {latestUpdate.changes.map((change, index) => (
                            <li key={index} className="flex items-start gap-2.5 text-[17px] leading-[1.4] text-ink">
                                <span className="mt-[7px] h-[9px] w-[9px] shrink-0 rounded-full bg-primary" aria-hidden="true" />
                                <span>{change}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="shrink-0 border-t border-border bg-surface px-[18px] pb-4 pt-3">
                    <button
                        onClick={handleClose}
                        className="min-h-[48px] w-full rounded-full bg-primary px-5 py-2.5 font-display-extrabold text-[17px] text-on-primary shadow-sh-cta transition-colors hover:bg-primary-dark"
                    >
                        ¡Entendido!
                    </button>
                </div>
            </div>
        </div>
    );
}
