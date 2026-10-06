import { useEffect, useState } from 'react';

// En web `KeyboardAvoidingView` se convierte en un `View` plano: nada encoge
// cuando el teclado virtual se abre y el pie del formulario (Guardar) queda
// detrás del teclado (habitual en iOS Safari). Esta aproximación lee
// `window.visualViewport` y estima el solape del teclado como
// `innerHeight - (height + offsetTop)` del viewport visual.
//
// Es una estimación, no una medición: no hay forma de verificar el valor real
// sin un dispositivo físico. `offsetTop` cubre el caso de iOS Safari, que
// desplaza (pannea) el viewport visual en vez de redimensionarlo.
//
// Si el navegador no expone `visualViewport` (o se ejecuta fuera del
// cliente), devolvemos 0 y la maquetación queda como hasta ahora. Mientras el
// hook está desactivado el valor expuesto también es 0: el estado interno
// conserva la última medición. Comportamiento real al reactivar el hook
// (`enabled` false→true): React pinta un fotograma con la medición previa
// antes de que el efecto vuelva a medir, así que si esa medición previa era
// distinta de 0 hay un frame con el valor anterior. En la práctica es
// irrelevante: el valor con el que el hook aterriza es 0 (nunca hubo una
// medición anterior distinta de cero), de modo que ese frame expone 0.
export function useKeyboardInset(enabled = true): number {
    const [measured, setMeasured] = useState(0);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return undefined;
        const viewport = window.visualViewport;
        if (!viewport) return undefined;

        const measure = () => {
            const overlap = Math.max(0, Math.round(window.innerHeight - (viewport.height + viewport.offsetTop)));
            setMeasured(overlap);
        };

        // Recalcular una vez al montar (o al cambiar `enabled`): nunca devolver
        // un valor desfasado del último montaje.
        measure();

        // Defensa: algunos entornos de test exponen la interfaz incompleta y
        // puede faltar algún método de escucha.
        viewport.addEventListener?.('resize', measure);
        viewport.addEventListener?.('scroll', measure);
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', measure);

        return () => {
            viewport.removeEventListener?.('resize', measure);
            viewport.removeEventListener?.('scroll', measure);
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', measure);
        };
    }, [enabled]);

    // Puerta en el retorno (no en el estado): `setInset(0)` síncrono dentro del
    // efecto lo rechaza la regla `react-hooks/set-state-in-effect` (arranca
    // renders en cascada). Devolver 0 mientras está desactivado da la misma
    // garantía sin renders extra, y al reactivarse `measure()` repone el valor.
    return enabled ? measured : 0;
}
