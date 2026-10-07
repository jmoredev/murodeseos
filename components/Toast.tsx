"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsDesktop } from '@/lib/use-is-desktop';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose: () => void;
}

export function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
    const [isVisible, setIsVisible] = useState(false);
    const isDesktop = useIsDesktop();
    // Mismo umbral que el resto de la app (>768): por encima no hay dock y el
    // toast mantiene el `bottom-6` (24px) de siempre; por debajo debe despegarse
    // del dock, que tras el inset ancla a `16px + env(safe-area-inset-bottom)`.

    useEffect(() => {
        // La entrada va en el siguiente cuadro: el render inicial pinta el estado
        // oculto y el cambio dispara la transición. Hacerlo de forma síncrona en el
        // efecto encadena renders que no hacen falta.
        const enterFrame = requestAnimationFrame(() => setIsVisible(true));

        const timer = setTimeout(() => {
            // Si el cierre llega antes que el cuadro de entrada —una `duration` más corta que
            // un cuadro—, se cancela el cuadro: si no, volvería a mostrar el brindis ya cerrado.
            cancelAnimationFrame(enterFrame);
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for transition
        }, duration);

        return () => {
            cancelAnimationFrame(enterFrame);
            clearTimeout(timer);
        };
    }, [duration, onClose]);

    const bgColors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-primary'
    };

    const icons = {
        success: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ),
        error: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
        ),
        info: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        )
    };

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
        // Guardia de clics: al sobrepasar ahora todo, durante su ~3 s la caja
        // queda encima de los pies de los modales (botones de acción en centro
        // inferior). `pointer-events-none` en el posicionador y en la burbuja
        // concentra los toques solo en el botón de cerrar (`pointer-events-auto`;
        // un hijo reactiva bajo un ancestro `none`). No simplificar: sin esta
        // guardia, el brindis traga toques ajenos; con ella, el fondo permanece
        // interactivo.
        <div
            className={`fixed left-1/2 -translate-x-1/2 z-[10000] transition-all duration-300 transform pointer-events-none ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
            style={{
                // El dock (bottom 16px + inset) mide `54 + labelLineBox` px de alto, deducido
                // de sus clases (px-2 py-2 + etiqueta text-xs con line-height 1rem): su borde
                // superior queda en `70 + L` px + inset, con L la caja de línea de la etiqueta.
                // Es una estimación aritmética, no una medición — revisar el número si cambia
                // el padding o el tamaño de etiqueta del dock. Con el offset a 6.75rem (108px)
                // el aire es `38 − L` px: 22px con L = 16px, y sigue ≥19px en todo el rango
                // plausible de crecimiento de la etiqueta. (El 6.5rem anterior daba 15–18px,
                // por debajo del aire previsto cuando la etiqueta pasó de 10px a 12px.)
                // En escritorio: 24px, idéntico al `bottom-6` de antes.
                bottom: isDesktop ? 24 : 'calc(6.75rem + env(safe-area-inset-bottom))',
            }}
        >
            <div
                className={`${bgColors[type]} text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 min-w-[min(280px,calc(100vw_-_2rem))] max-w-[calc(100vw_-_2rem)] pointer-events-none`}
            >
                <div className="shrink-0">
                    {icons[type]}
                </div>
                <p className="text-sm font-bold flex-1">{message}</p>
                <button onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }} className="p-3.5 -mr-2 hover:bg-white/20 rounded-lg transition-colors pointer-events-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>,
        document.body
    );
}

// Hook simple para usar toasts (Alternativa a un context completo por ahora)
export function useToast() {
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const showToast = (message: string, type: ToastType = 'success') => {
        setToast({ message, type });
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
                onClose={hideToast}
            />
        ) : null
    };
}
