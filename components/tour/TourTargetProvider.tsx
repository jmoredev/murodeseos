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
 * le pasa el `null`.
 *
 * **Sin `TourTargetProvider` los enganches de objetivo son inertes** (`ref` que no hace nada,
 * `onLayout` que no hace nada, medida `null`). El motivo es que este enganche ya no vive sólo dentro
 * del tour: en T5 se esparce en las pestañas, en los botones de añadir y en los formularios, que son
 * pantallas normales. Si sin proveedor reventara, cada prueba de pantalla —y cada montaje aislado
 * de un componente— necesitaría un `TourTargetProvider` que no tiene nada que ver con lo que está
 * probando. La tienda (`useTourTargetRegistry`) sí sigue exigiendo el proveedor: quien pregunta por
 * ella es el motor del tour, y ahí un fallo silencioso dejaría el recorrido mudo para siempre.
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

/** Las props de un objetivo cuando no hay tour: se pueden esparcir y no hacen nada. */
const PROPS_INERTES: TourTargetProps = {
    ref: () => {},
    onLayout: () => {},
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
    const registro = useContext(TourTargetContext);

    const subscribe = useCallback(
        (listener: () => void) => {
            // Sin proveedor no hay nada a lo que suscribirse, pero el enganche tiene que poder
            // llamarse: la pantalla se pinta igual, simplemente sin hueco.
            if (!registro) return () => {};

            return registro.subscribe(listener);
        },
        [registro]
    );
    const getSnapshot = useCallback(
        () => (registro ? registro.measure(id) : null),
        [registro, id]
    );

    // En el servidor no hay ventana que medir: la captura es `null` y el overlay no se pinta.
    return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function useTourTarget(id: string): TourTargetProps {
    const registro = useContext(TourTargetContext);
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
        if (!registro) return;

        registro.register(id, medir);
        // El nodo pudo montarse antes que este efecto: se pide la primera medida sin esperar al
        // primer `onLayout`.
        void registro.refresh(id);

        return () => {
            nodo.current = null;
            // La baja es la de **esta** pantalla: si otra reclama el mismo id, su alta sigue viva.
            registro.unregister(id, medir);
        };
    }, [registro, id, medir]);

    const ref = useCallback(
        (node: TourTargetNode | null) => {
            nodo.current = node;

            // El nodo puede aparecer después del efecto (montaje diferido, cambio de pestaña):
            // en cuanto llega, se mide.
            if (node && registro) void registro.refresh(id);
        },
        [registro, id]
    );

    const onLayout = useCallback(() => {
        // Rotación, cambio de pestaña, teclado: la caja cambió y el hueco tiene que seguirla.
        if (registro) void registro.refresh(id);
    }, [registro, id]);

    // Sin proveedor no se devuelven los callbacks de arriba sino dos vacíos: el mismo objeto en
    // cada render, para que esparcirlos en una pantalla no provoque renders en cascada.
    return useMemo(
        () => (registro ? { ref, onLayout } : PROPS_INERTES),
        [registro, ref, onLayout]
    );
}
