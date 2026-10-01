"use client";

import React, { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose: () => void;
}

export function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
    const [isVisible, setIsVisible] = useState(false);
    const { width } = useWindowDimensions();
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
        <div
            className={`fixed left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
            style={{
                // El dock (bottom 16px + inset) deja su borde superior en ~85px + inset,
                // medido desde sus clases (px-2 py-2 + etiqueta de 10px): es una estimación,
                // no una medición — revisar el número si cambia el padding o el tamaño
                // de etiqueta del dock. 6.5rem + inset despeja con ~19px de aire.
                // En escritorio: 24px, idéntico al `bottom-6` de antes.
                bottom: width > 768 ? 24 : 'calc(6.5rem + env(safe-area-inset-bottom))',
            }}
        >
            <div
                className={`${bgColors[type]} text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 min-w-[min(280px,calc(100vw_-_2rem))] max-w-[calc(100vw_-_2rem)]`}
            >
                <div className="shrink-0">
                    {icons[type]}
                </div>
                <p className="text-sm font-bold flex-1">{message}</p>
                <button onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
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
