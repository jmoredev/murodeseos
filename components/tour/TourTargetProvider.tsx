import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { createTargetRegistry, type TargetRegistry, type TargetRect } from '@/lib/tour/targets';

/**
 * La capa de React del registro de objetivos.
 *
 * `useTourTarget(id)` devuelve dos props para esparcir en cualquier `View` o `Pressable`:
 *
 * ```tsx
 * const deseos = useTourTarget('tab-deseos');
 * return <Pressable {...deseos} onPress={...} />;
 * ```
 *
 * Con eso el objetivo se da de alta solo, se mide con `measureInWindow` (que es relativo a la
 * ventana, justo lo que necesita el velo) y se vuelve a medir cuando cambia su caja. La pantalla no
 * sabe nada de coordenadas: si el tour no está activo, esto sólo cuesta un registro vacío.
 *
 * El nodo puede no existir todavía (montaje diferido, pestaña que aún no se ha abierto) y puede
 * desaparecer antes de que llegue su medida; el registro tolera las dos cosas y aquí simplemente se
 * le pasa el `null`. Sin `TourTargetProvider` se lanza un error claro: un tour mudo para siempre es
 * mucho más caro de diagnosticar que un mensaje que dice qué falta.
 */

const TourTargetContext = createContext<TargetRegistry | null>(null);

/** Un nodo del que se puede pedir la caja en pantalla. `View` y `Pressable` lo cumplen. */
type TourTargetNode = {
    measureInWindow?: (
        callback: (x: number, y: number, width: number, height: number) => void
    ) => void;
};

export type TourTargetProps = {
    ref: (node: TourTargetNode | null) => void;
    onLayout: () => void;
};

export function TourTargetProvider({ children }: { children: React.ReactNode }) {
    // Una sola tienda por árbol: si se creara en cada render, cada medición perdería a los oyentes.
    const [registro] = useState(() => createTargetRegistry());

    return <TourTargetContext.Provider value={registro}>{children}</TourTargetContext.Provider>;
}

export function useTourTargetRegistry(): TargetRegistry {
    const registro = useContext(TourTargetContext);

    if (!registro) {
        throw new Error('useTourTarget necesita un <TourTargetProvider> por encima en el árbol');
    }

    return registro;
}

/** La caja actual del objetivo, o `null` mientras no haya una medida fiable. */
export function useTourTargetRect(id: string): TargetRect | null {
    const registro = useTourTargetRegistry();

    const subscribe = useCallback(
        (listener: () => void) => registro.subscribe(listener),
        [registro]
    );
    const getSnapshot = useCallback(() => registro.measure(id), [registro, id]);

    // En el servidor no hay ventana que medir: la captura es `null` y el overlay no se pinta.
    return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function useTourTarget(id: string): TourTargetProps {
    const registro = useTourTargetRegistry();
    const nodo = useRef<TourTargetNode | null>(null);

    const medir = useCallback((): Promise<TargetRect | null> => {
        const actual = nodo.current;
        const medirEnVentana = actual?.measureInWindow;

        if (!actual || !medirEnVentana) return Promise.resolve(null);

        // `measureInWindow` responde por callback en nativo; en web lo hace al momento. La promesa
        // unifica las dos formas para el registro. Se invoca **sobre el nodo** (`.call(actual)`): en
        // React Native la medición la resuelve el receptor, así que una referencia despegada
        // (`const fn = nodo.measureInWindow; fn(...)`) pierde `this` y no mide nada.
        return new Promise((resolve) => {
            try {
                medirEnVentana.call(actual, (x, y, width, height) => {
                    resolve({ x, y, width, height });
                });
            } catch {
                // Un nodo desmontado durante la medición puede lanzar de forma síncrona. El tour no
                // se pinta sin medida, pero una promesa rechazada sin dueño sí tumba la app.
                resolve(null);
            }
        });
    }, []);

    useEffect(() => {
        registro.register(id, medir);
        // El nodo pudo montarse antes que este efecto: se pide la primera medida sin esperar al
        // primer `onLayout`.
        void registro.refresh(id);

        return () => {
            nodo.current = null;
            registro.unregister(id);
        };
    }, [registro, id, medir]);

    const ref = useCallback(
        (node: TourTargetNode | null) => {
            nodo.current = node;

            // El nodo puede aparecer después del efecto (montaje diferido, cambio de pestaña):
            // en cuanto llega, se mide.
            if (node) void registro.refresh(id);
        },
        [registro, id]
    );

    const onLayout = useCallback(() => {
        // Rotación, cambio de pestaña, teclado: la caja cambió y el hueco tiene que seguirla.
        void registro.refresh(id);
    }, [registro, id]);

    return useMemo(() => ({ ref, onLayout }), [ref, onLayout]);
}
