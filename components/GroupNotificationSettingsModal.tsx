'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Switch, useWindowDimensions } from 'react-native';
import { useClientMounted } from '@/lib/use-client-mounted';
import { createPortal } from 'react-dom';
import {
    GROUP_NOTIFICATION_OPTIONS,
    GroupNotificationPreferences,
    GroupNotificationType,
    defaultGroupNotificationPreferences,
    getGroupNotificationPreferences,
    setGroupNotificationPreference,
} from '@/lib/group-notification-preferences';

interface GroupNotificationSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    groupId: string;
    groupName: string;
}

export function GroupNotificationSettingsModal({
    visible,
    onClose,
    userId,
    groupId,
    groupName,
}: GroupNotificationSettingsModalProps) {
    // En el servidor no hay DOM: el modal no se pinta hasta hidratar.
    const mounted = useClientMounted();
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;
    const [visibleState, setVisibleState] = useState(false);
    const titleId = useId();
    const subtitleId = useId();
    const previouslyFocused = useRef<HTMLElement | null>(null);
    // `onClose` puede cambiar de identidad en cada render del padre; el efecto de
    // foco y Escape no debe depender de eso, así que se lee la última versión por
    // referencia y el efecto solo se reejecuta al abrir o cerrar.
    const onCloseRef = useRef(onClose);

    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [preferences, setPreferences] = useState<GroupNotificationPreferences | null>(null);
    // Guarda el valor previamente persistido por tipo, para revertir un toggle
    // fallido aunque el usuario haya vuelto a tocar el switch entre medias.
    const persistedRef = useRef<Partial<Record<GroupNotificationType, boolean>>>({});
    const [rowError, setRowError] = useState<GroupNotificationType | null>(null);
    // Cambiar la clave reejecuta la carga: lo usa el botón "Reintentar".
    const [retryNonce, setRetryNonce] = useState(0);

    useEffect(() => {
        if (visible) {
            // La entrada va en el siguiente cuadro, para que el primer render pinte el
            // estado cerrado y el cambio dispare la transición (patrón de ConfirmModal).
            const frame = window.requestAnimationFrame(() => setVisibleState(true));
            return () => window.cancelAnimationFrame(frame);
        }

        const timer = setTimeout(() => setVisibleState(false), 300);
        return () => clearTimeout(timer);
    }, [visible]);

    useEffect(() => {
        if (!visible || !userId || !groupId) return;

        // Si el grupo cambia con el modal abierto, la respuesta de la carga
        // anterior ya no vale: se descarta en lugar de pintar datos ajenos.
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setLoadError(null);
            setPreferences(null);
            persistedRef.current = {};
            try {
                const loaded = await getGroupNotificationPreferences(userId, groupId);
                if (cancelled) return;
                setPreferences(loaded);
                persistedRef.current = { ...loaded };
            } catch {
                if (cancelled) return;
                setLoadError('No se han podido cargar tus preferencias. Inténtalo de nuevo.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();

        return () => {
            cancelled = true;
        };
    }, [visible, userId, groupId, retryNonce]);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!visible) return;

        previouslyFocused.current = document.activeElement as HTMLElement | null;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCloseRef.current();
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
    }, [visible, titleId]);

    useEffect(() => {
        if (visible) return;
        previouslyFocused.current?.focus?.();
    }, [visible]);

    if (!mounted) return null;

    if (!visibleState && !visible) return null;

    const handleToggle = async (type: GroupNotificationType, enabled: boolean) => {
        if (!preferences) return;
        setRowError((current) => (current === type ? null : current));
        // Actualización funcional: si el usuario toca dos interruptores seguidos,
        // el segundo no parte del estado viejo del render anterior.
        setPreferences((current) => (current ? { ...current, [type]: enabled } : current));

        try {
            await setGroupNotificationPreference(userId, groupId, type, enabled);
            persistedRef.current[type] = enabled;
        } catch {
            // El guardado ha fallado: se vuelve al último valor que la base conoce.
            setPreferences((current) =>
                current
                    ? ({ ...current, [type]: persistedRef.current[type] ?? defaultGroupNotificationPreferences()[type] } as GroupNotificationPreferences)
                    : current
            );
            setRowError(type);
        }
    };

    // En móvil se comporta como hoja inferior (patrón de WishDetailModal) y en
    // escritorio como diálogo centrado. El cuerpo lleva scroll propio para que no
    // se recorte en pantallas bajas (móvil apaisado, fuente grande).
    const sheetLayout = isDesktop
        ? 'max-w-md max-h-[85vh] rounded-3xl p-6'
        : 'max-h-[90%] rounded-t-[40px] px-6 pt-6';
    const sheetTransform = visible
        ? isDesktop
            ? 'scale-100 translate-y-0'
            : 'translate-y-0'
        : isDesktop
            ? 'scale-95 translate-y-4'
            : 'translate-y-full';

    return createPortal(
        <div
            className={`fixed inset-0 z-50 flex transition-opacity duration-300 ${isDesktop ? 'items-center justify-center p-4' : 'items-end'} ${visible ? 'opacity-100' : 'opacity-0'}`}
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
                aria-describedby={subtitleId}
                style={isDesktop ? undefined : { paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
                className={`relative z-10 w-full flex flex-col bg-surface-container-lowest shadow-ambient-lg transform transition-all duration-300 ${sheetLayout} ${sheetTransform}`}
            >
                <div className="mb-6 shrink-0">
                    <h3
                        id={titleId}
                        tabIndex={-1}
                        className="text-xl font-sans-bold text-on-background outline-none mb-2"
                    >
                        Notificaciones del grupo
                    </h3>
                    <p id={subtitleId} className="text-on-surface/65 leading-relaxed font-sans">
                        Elige qué avisos quieres recibir de {groupName}. Solo afecta a ti: el resto
                        del grupo tiene sus propias preferencias.
                    </p>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                {loading ? (
                    <div className="py-10 text-center" role="status" aria-live="polite">
                        <p className="text-on-surface/45 font-sans">Cargando preferencias…</p>
                    </div>
                ) : loadError ? (
                    <div className="py-6 flex flex-col gap-4">
                        <p className="text-sm text-primary font-sans-bold text-center">{loadError}</p>
                        <button
                            type="button"
                            onClick={() => setRetryNonce((n) => n + 1)}
                            className="py-3 rounded-full border border-primary/30 active:opacity-80 transition-opacity"
                        >
                            <span className="text-primary font-sans-bold text-xs uppercase tracking-widest">
                                Reintentar
                            </span>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {preferences &&
                            GROUP_NOTIFICATION_OPTIONS.map((option) => {
                                const value = preferences[option.type];
                                const hasError = rowError === option.type;
                                return (
                                    <div
                                        key={option.type}
                                        className="p-4 rounded-2xl bg-surface-container-low"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-sans-bold text-on-background">{option.label}</p>
                                                <p className="text-xs text-on-surface/50 font-sans mt-1 leading-snug">
                                                    {option.description}
                                                </p>
                                            </div>
                                            <Switch
                                                value={value}
                                                onValueChange={(enabled) => handleToggle(option.type, enabled)}
                                                accessibilityLabel={`${option.label}: ${value ? 'activado' : 'desactivado'}, ${option.description}`}
                                            />
                                        </div>
                                        {hasError && (
                                            <p className="mt-2 text-xs text-primary font-sans-bold" role="status" aria-live="polite">
                                                No se ha podido guardar. Comprueba tu conexión y prueba otra vez.
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                )}
                </div>
            </div>
        </div>,
        document.body
    );
}
