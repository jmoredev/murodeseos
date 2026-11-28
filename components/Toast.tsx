"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsDesktop } from '@/lib/use-is-desktop';

/**
 * El brindis (12 · P7–P9, nota 3): una sola pieza para lo momentáneo.
 *
 * Qué cambia respecto al de antes:
 *
 * 1. **Lleva acción cuando hay algo que deshacer o reintentar** («Deshacer», «Reintentar»), y
 *    entonces **no** lleva además una ×: dos botones competirían por el mismo sitio. Sin acción
 *    sí tiene × para cerrarlo antes.
 * 2. **El de error no se va solo.** Si desapareciera a los tres segundos, el aviso se quedaría sin
 *    leer y sin decir por qué: espera a que se reintente o se cierre.
 * 3. **La forma es la del artboard**: burbuja de tinta oscura, texto `--on-ink` y la acción en
 *    `--on-ink-accent`, subrayada. En 390 px el que lleva acción pasa a dos líneas (mensaje arriba,
 *    acción abajo a la derecha); en escritorio vuelve a una sola línea.
 *
 * La API sigue siendo la de antes para los cuatro llamadores actuales (`WishListTab`, `GroupsTab`,
 * `WishLinkChip` y el detalle de un deseo): `message`, `type`, `duration` y `onClose`. La acción es
 * un cuarto argumento opcional, así que nada de lo que ya existe cambia de forma.
 */

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
    /** Texto del botón: «Deshacer» o «Reintentar». */
    label: string;
    onPress: () => void;
}

interface ToastProps {
    message: string;
    type?: ToastType;
    /** Milisegundos en pantalla. Si no se pasa, 3 s (10 s cuando hay acción). */
    duration?: number;
    onClose: () => void;
    /** Acción única; sustituye a la × (nota 3 del artboard). */
    action?: ToastAction;
}

/** Lo que dura un brindis de confirmación (12 · nota 3). */
const DURACION_CONFIRMACION_MS = 3000;
/**
 * Lo que dura uno con acción. La ficha deja la pregunta abierta (§13, pregunta 1) con esta
 * propuesta: 10 s, o hasta que se pulse, para que dé tiempo a leerlo y alcanzarlo con el pulgar.
 */
const DURACION_CON_ACCION_MS = 10_000;
/** Lo que tarda la salida antes de avisar al llamador. */
const SALIDA_MS = 300;

export function Toast({ message, type = 'success', duration, onClose, action }: ToastProps) {
    const [isVisible, setIsVisible] = useState(false);
    const isDesktop = useIsDesktop();
    // El de error se queda hasta que se cierre: irse solo dejaría el aviso sin leer.
    const esError = type === 'error';
    const duracion = duration ?? (action ? DURACION_CON_ACCION_MS : DURACION_CONFIRMACION_MS);

    /**
     * Identidad del brindis que hay en pantalla. `useToast` reutiliza esta misma pieza cuando el
     * llamador sustituye un mensaje por otro, así que el cierre retardado del viejo sigue vivo
     * sobre el nuevo: si cerrara a ciegas lo borraría 300 ms después de aparecer (el caso de la
     * acción cuyo manejador muestra otro brindis). Cada sustitución sube el contador y el cierre
     * sólo avisa al llamador si el brindis sigue siendo el suyo.
     */
    const firma = `${type}\u0000${message}\u0000${action?.label ?? ''}\u0000${duracion}`;
    const firmaRef = useRef(firma);
    const tokenRef = useRef(0);

    useEffect(() => {
        if (firmaRef.current === firma) return;
        firmaRef.current = firma;
        tokenRef.current += 1;
    }, [firma]);

    const cerrar = () => {
        setIsVisible(false);
        const token = tokenRef.current;
        setTimeout(() => {
            if (tokenRef.current === token) onClose();
        }, SALIDA_MS);
    };

    useEffect(() => {
        // La entrada va en el siguiente cuadro: el render inicial pinta el estado
        // oculto y el cambio dispara la transición. Hacerlo de forma síncrona en el
        // efecto encadena renders que no hacen falta.
        const enterFrame = requestAnimationFrame(() => setIsVisible(true));

        if (esError) {
            return () => cancelAnimationFrame(enterFrame);
        }

        const timer = setTimeout(() => {
            // Si el cierre llega antes que el cuadro de entrada —una `duration` más corta que
            // un cuadro—, se cancela el cuadro: si no, volvería a mostrar el brindis ya cerrado.
            cancelAnimationFrame(enterFrame);
            setIsVisible(false);
            // Mismo cerco que en `cerrar`: el aviso al llamador sólo vale para este brindis.
            const token = tokenRef.current;
            setTimeout(() => {
                if (tokenRef.current === token) onClose();
            }, SALIDA_MS);
        }, duracion);

        return () => {
            cancelAnimationFrame(enterFrame);
            clearTimeout(timer);
        };
    }, [duracion, esError, onClose]);

    /**
     * Los tres iconos son los del artboard: comprobado, alerta e información. Van en SVG en línea
     * porque el brindis se pinta con `createPortal` (sólo web) y no necesita la fuente de iconos.
     */
    const iconos: Record<ToastType, React.ReactNode> = {
        success: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4.8 12.6 9.6 17.4 19.2 6.6" />
            </svg>
        ),
        error: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3.8 21 19.4H3Z" />
                <path d="M12 9.6v4.4" />
                <circle cx="12" cy="16.9" r="1.1" fill="currentColor" stroke="none" />
            </svg>
        ),
        info: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8.6" />
                <path d="M12 11v5.2" />
                <circle cx="12" cy="7.9" r="1.15" fill="currentColor" stroke="none" />
            </svg>
        ),
    };

    // El aro del icono cambia de color con el tipo; la burbuja, nunca (una pieza por patrón).
    const aroIcono =
        type === 'error'
            ? 'bg-danger-soft/15 text-danger-soft'
            : type === 'success'
              ? 'bg-accent-soft/15 text-accent-soft'
              : 'bg-on-ink/15 text-on-ink';

    // Dos líneas sólo en el móvil y sólo cuando hay acción: mensaje arriba, acción abajo a la derecha.
    const dosLineas = !!action && !isDesktop;

    return createPortal(
        // `z-[10000]` no es una afirmación estética: RNW monta el envoltorio de
        // sus `Modal` con `position: fixed; zIndex: 9999`
        // (react-native-web/dist/exports/Modal/ModalAnimation.js, `styles.container`,
        // envuelto por ModalContent.js), y por encima cae la hoja completa
        // `z-[200]` de NotificationMenu.tsx; el `z-[100]` anterior dejaba el
        // brindis —p. ej. el aviso de un enlace roto en el modal de detalle de
        // un deseo— pintado detrás del propio modal, invisible: un silencio
        // fingido. Los diálogos propios usan `z-[100]`, así que el nuevo valor
        // también los sobrepasa.
        //
        // Límite de verificación: aquí solo se leyó el código fuente de RNW y se
        // fijaron los dos valores de z-index — no se tomó ninguna medición. El
        // apilamiento es observable por hit-testing en e2e (`click({ trial: true })`
        // falla con «intercepts pointer events», `elementFromPoint` devuelve el
        // elemento superior); lo ciego ante oclusión es `toBeVisible()` y las
        // capturas. Medirlo aquí no fue posible: la pila de e2e (Docker/Supabase)
        // no está disponible, así que queda sin comprobar en dispositivo real.
        //
        // Guardia de clics: al sobrepasar ahora todo, mientras vive queda encima
        // de los pies de los modales (botones de acción en centro inferior).
        // `pointer-events-none` en el posicionador y en la burbuja concentra los
        // toques solo en los botones (`pointer-events-auto`; un hijo reactiva bajo
        // un ancestro `none`). No simplificar: sin esta guardia, el brindis traga
        // toques ajenos; con ella, el fondo permanece interactivo.
        <div
            className={`fixed left-1/2 z-[10000] -translate-x-1/2 transform transition-all duration-300 pointer-events-none ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
            }`}
            style={{
                // En el móvil el brindis despega de la barra de pestañas (72 px) más 12 px, como
                // pide la ficha §10.11; en escritorio baja al centro del pie, a 24 px.
                bottom: isDesktop ? 24 : 'calc(6.75rem + env(safe-area-inset-bottom))',
            }}
        >
            <div
                role={esError ? 'alert' : 'status'}
                aria-live={esError ? undefined : 'polite'}
                className={`pointer-events-none min-w-[min(280px,calc(100vw_-_2rem))] max-w-[calc(100vw_-_2rem)] rounded-2xl bg-ink py-[9px] pl-[13px] pr-2 text-on-ink shadow-sh-toast ${
                    dosLineas
                        ? 'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-[10px] gap-y-0.5'
                        : 'flex items-center gap-[10px]'
                }`}
            >
                <span
                    aria-hidden="true"
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${aroIcono} ${
                        dosLineas ? 'mt-[3px]' : ''
                    }`}
                >
                    {iconos[type]}
                </span>

                <p className="min-w-0 flex-1 text-[17px] leading-[1.3] text-on-ink">{message}</p>

                {action ? (
                    <button
                        type="button"
                        onClick={() => {
                            action.onPress();
                            cerrar();
                        }}
                        className={`pointer-events-auto inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[17px] font-bold text-on-ink-accent underline decoration-2 underline-offset-4 hover:bg-on-ink/15 hover:text-on-ink ${
                            dosLineas ? 'col-span-2 justify-self-end' : ''
                        }`}
                    >
                        {type === 'error' ? (
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M19.4 12a7.4 7.4 0 1 1-2.2-5.3" />
                                <path d="M19.6 4.4v4.2h-4.2" />
                            </svg>
                        ) : (
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M9.2 6.4 4.6 11l4.6 4.6" />
                                <path d="M4.6 11h8.4a5.6 5.6 0 0 1 0 11.2H9" />
                            </svg>
                        )}
                        {action.label}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={cerrar}
                        aria-label="Cerrar el aviso"
                        className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-xl text-on-ink hover:bg-on-ink/15"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
                            <path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" />
                        </svg>
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
}

export interface ShowToastOptions {
    /** Acción única que sustituye a la × («Deshacer», «Reintentar»). */
    action?: ToastAction;
    /** Milisegundos en pantalla; el de error los ignora porque no se va solo. */
    duration?: number;
}

// Hook simple para usar toasts (Alternativa a un context completo por ahora)
export function useToast() {
    const [toast, setToast] = useState<
        { message: string; type: ToastType; action?: ToastAction; duration?: number } | null
    >(null);

    const showToast = (message: string, type: ToastType = 'success', options?: ShowToastOptions) => {
        setToast({ message, type, action: options?.action, duration: options?.duration });
    };

    const hideToast = () => setToast(null);

    return {
        toast,
        showToast,
        hideToast,
        ToastComponent: toast ? (
            <Toast
                message={toast.message}
                type={toast.type}
                action={toast.action}
                duration={toast.duration}
                onClose={hideToast}
            />
        ) : null
    };
}
