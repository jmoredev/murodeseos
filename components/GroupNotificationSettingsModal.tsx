'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Switch, TextInput } from 'react-native';
import { useClientMounted } from '@/lib/use-client-mounted';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { createPortal } from 'react-dom';
import {
    GROUP_NOTIFICATION_OPTIONS,
    GroupNotificationPreferences,
    GroupNotificationType,
    defaultGroupNotificationPreferences,
    getGroupNotificationPreferences,
    setGroupNotificationPreference,
} from '@/lib/group-notification-preferences';
import {
    DEFAULT_REMINDER_LEAD_DAYS,
    MAX_REMINDER_LEAD_DAYS,
    MIN_REMINDER_LEAD_DAYS,
    getGroupReminderLeadDays,
    setGroupReminderLeadDays,
} from '@/lib/reminder-utils';

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
    const isDesktop = useIsDesktop();
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

    // Antelación de los avisos (lead days): estado propio e independiente de las
    // preferencias. El efecto de las preferencias reinicia su estado en cada
    // apertura/reintento, así que acoplar ambos haría que un fallo de carga
    // ocultara el otro.
    const [leadDaysText, setLeadDaysText] = useState('');
    const [leadDaysLoading, setLeadDaysLoading] = useState(false);
    const [leadDaysLoadError, setLeadDaysLoadError] = useState<string | null>(null);
    const [leadDaysSaving, setLeadDaysSaving] = useState(false);
    const [leadDaysSaveError, setLeadDaysSaveError] = useState<string | null>(null);
    const [leadDaysSaved, setLeadDaysSaved] = useState(false);
    // Cambiar la clave reejecuta la carga del propio control.
    const [leadDaysRetryNonce, setLeadDaysRetryNonce] = useState(0);
    // Último valor conocido persistido: línea base para habilitar el guardado y
    // para revertir el valor visible si el guardado falla. Va en estado (no en
    // ref) porque el render lo lee para decidir si el botón está habilitado.
    const [persistedLeadDays, setPersistedLeadDays] = useState<number | null>(null);

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
        if (!visible || !userId || !groupId) return;

        // Misma protección que la carga de preferencias: si el grupo cambia con
        // el modal abierto, la respuesta anterior se descarta.
        let cancelled = false;
        const run = async () => {
            setLeadDaysLoading(true);
            setLeadDaysLoadError(null);
            // A (re)open always starts from a neutral state: the parent keeps
            // the modal mounted (only `visible` changes), so without this a
            // previous save error or success would reappear next to a freshly
            // loaded value. The persisted baseline is discarded too, so a group
            // change that somehow avoids a remount cannot inherit another
            // group's baseline. Keystroke clearing below stays as-is.
            setLeadDaysSaved(false);
            setLeadDaysSaveError(null);
            setPersistedLeadDays(null);
            try {
                const days = await getGroupReminderLeadDays(userId, groupId);
                if (cancelled) return;
                setPersistedLeadDays(days);
                setLeadDaysText(String(days));
            } catch {
                if (cancelled) return;
                setLeadDaysLoadError('No se ha podido cargar la antelación de los avisos. Inténtalo de nuevo.');
            } finally {
                if (!cancelled) setLeadDaysLoading(false);
            }
        };
        run();

        return () => {
            cancelled = true;
        };
    }, [visible, userId, groupId, leadDaysRetryNonce]);

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

    const handleLeadDaysTextChange = (text: string) => {
        setLeadDaysText(text);
        setLeadDaysSaveError(null);
        setLeadDaysSaved(false);
    };

    const handleSaveLeadDays = async () => {
        if (!leadDaysDirty || leadDaysSaving) return;
        const days = parsedLeadDays;
        setLeadDaysSaving(true);
        setLeadDaysSaveError(null);
        setLeadDaysSaved(false);
        try {
            await setGroupReminderLeadDays(userId, groupId, days);
            setPersistedLeadDays(days);
            setLeadDaysText(String(days));
            setLeadDaysSaved(true);
        } catch {
            // El guardado ha fallado: se vuelve al último valor que la base conoce.
            setLeadDaysText(persistedLeadDays === null ? '' : String(persistedLeadDays));
            setLeadDaysSaveError('No se ha podido guardar. Comprueba tu conexión y prueba otra vez.');
        } finally {
            setLeadDaysSaving(false);
        }
    };

    // Validación en cliente antes de llamar al setter: entero en 1..365. Un
    // valor inválido muestra el error en línea y no llega a tocar Supabase.
    const trimmedLeadDays = leadDaysText.trim();
    const parsedLeadDays = Number.parseInt(trimmedLeadDays, 10);
    const leadDaysIsValid =
        /^\d+$/.test(trimmedLeadDays) &&
        parsedLeadDays >= MIN_REMINDER_LEAD_DAYS &&
        parsedLeadDays <= MAX_REMINDER_LEAD_DAYS;
    const leadDaysInvalidError =
        trimmedLeadDays !== '' && !leadDaysIsValid
            ? `Introduce un número entero entre ${MIN_REMINDER_LEAD_DAYS} y ${MAX_REMINDER_LEAD_DAYS}.`
            : null;
    // Solo se permite guardar con una línea base persistida conocida y cuando el
    // valor nuevo difiere de ella.
    const leadDaysDirty =
        leadDaysIsValid &&
        persistedLeadDays !== null &&
        parsedLeadDays !== persistedLeadDays;

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
                style={
                    isDesktop
                        ? { maxHeight: '85dvh' as any } // fallback: la clase queda en `max-h-[85vh]`
                        : { paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }
                }
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
                    <p id={subtitleId} className="text-on-surface/70 leading-relaxed font-sans">
                        Elige qué avisos quieres recibir de {groupName}. Solo afecta a ti: el resto
                        del grupo tiene sus propias preferencias.
                    </p>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="flex flex-col gap-3">
                        <div className="p-4 rounded-2xl bg-surface-container-low">
                            <p className="text-xs font-sans-bold text-on-surface/70 uppercase tracking-widest mb-2">
                                Antelación de los avisos (días)
                            </p>
                            <p className="text-xs text-on-surface/70 font-sans leading-snug">
                                Con cuántos días de antelación recibes tú los avisos de cumpleaños y
                                onomástico en este grupo. Por defecto, {DEFAULT_REMINDER_LEAD_DAYS}.
                            </p>
                            {leadDaysLoading ? (
                                <p className="mt-3 text-xs text-on-surface/70 font-sans">Cargando…</p>
                            ) : leadDaysLoadError ? (
                                <div className="mt-3 flex flex-col gap-2">
                                    <p className="text-xs text-primary font-sans-bold" role="status" aria-live="polite">
                                        {leadDaysLoadError}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setLeadDaysRetryNonce((n) => n + 1)}
                                        className="self-start py-2 rounded-full border border-primary/30 active:opacity-80 transition-opacity"
                                    >
                                        <span className="text-primary font-sans-bold text-xs uppercase tracking-widest">
                                            Reintentar
                                        </span>
                                    </button>
                                </div>
                            ) : (
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSaveLeadDays();
                                    }}
                                    className="mt-3 flex items-end gap-3"
                                >
                                    <TextInput
                                        value={leadDaysText}
                                        onChangeText={handleLeadDaysTextChange}
                                        keyboardType="numeric"
                                        placeholder={String(DEFAULT_REMINDER_LEAD_DAYS)}
                                        editable={!leadDaysSaving}
                                        aria-label="Antelación de los avisos (días)"
                                        style={{ fontSize: 16 }}
                                        className="flex-1 min-w-0 px-4 py-3.5 rounded-2xl bg-surface-container-highest text-on-background font-sans-semibold"
                                    />
                                    <button
                                        type="submit"
                                        aria-label="Guardar antelación de los avisos"
                                        disabled={!leadDaysDirty || leadDaysSaving}
                                        className={`py-3 px-4 rounded-full border border-primary/30 active:opacity-80 transition-opacity ${!leadDaysDirty || leadDaysSaving ? 'opacity-50' : ''}`}
                                    >
                                        <span className="text-primary font-sans-bold text-xs uppercase tracking-widest">
                                            {leadDaysSaving ? 'Guardando…' : 'Guardar'}
                                        </span>
                                    </button>
                                </form>
                            )}
                            {leadDaysInvalidError && (
                                <p className="mt-2 text-xs text-primary font-sans-bold" role="status" aria-live="polite">
                                    {leadDaysInvalidError}
                                </p>
                            )}
                            {leadDaysSaveError && (
                                <p className="mt-2 text-xs text-primary font-sans-bold" role="status" aria-live="polite">
                                    {leadDaysSaveError}
                                </p>
                            )}
                            {leadDaysSaved && !leadDaysSaveError && !leadDaysInvalidError && (
                                <p className="mt-2 text-xs text-on-surface/70 font-sans" role="status" aria-live="polite">
                                    Guardado.
                                </p>
                            )}
                        </div>
                        {loading ? (
                            <div className="py-10 text-center" role="status" aria-live="polite">
                                <p className="text-on-surface/70 font-sans">Cargando preferencias…</p>
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
                            <>
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
                                                <p className="text-xs text-on-surface/70 font-sans mt-1 leading-snug">
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
                        </>
                    )}
                </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
