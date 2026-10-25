import React, { useEffect, useRef } from 'react';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import type { TourCurrent } from '@/lib/tour/engine';
import {
    CARD_BORDER,
    CARD_PADDING,
    RING_INSET,
    RING_THICKNESS,
    cardPlacement,
    ringRect,
    scrimPieces,
    type Rect,
} from '@/lib/tour/geometry';
import { useTamanoTarjeta } from '@/lib/tour/use-card-size';
import { useTourTargetRect } from './TourTargetProvider';

/**
 * El overlay del tour: el velo, el hueco, el anillo y la tarjeta.
 *
 * No decide el orden —eso es `lib/tour/engine.ts`— ni sabe qué pantalla está debajo. Recibe la
 * parada ya calculada y el objetivo medido, y pinta. Si la medida no ha llegado, no pinta **nada**:
 * una tarjeta flotando sobre un punto desconocido es peor que un tour que tarda un fotograma.
 *
 * El hueco no usa máscaras ni recortes: son los cuatro rectángulos de `scrimPieces`, que teselan el
 * viewport sin grietas, más un anillo dibujado con borde. Es la decisión S7: sin dependencias
 * nuevas, y las dos formas de pestaña (dock en móvil, tablist en escritorio) se pueden resaltar
 * porque el objetivo se mide solo.
 */

/** Duración de la transición entre paradas (S5). */
const DURACION_MS = 220;

const VACIO: Rect = { x: 0, y: 0, width: 0, height: 0 };

/**
 * Lo que puede recibir el foco dentro del diálogo. `[tabindex]:not([tabindex="-1"])` es la pieza
 * importante: en web los `Pressable` de react-native-web son `div` con `tabindex="0"`, no
 * `<button>`, y sin esa regla el ciclo de Tab se quedaría sin elementos.
 */
const SELECTOR_ENFOCABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * El nodo de React Native convertido en elemento del DOM, si de verdad lo es. En nativo el `ref`
 * apunta a un nodo de la vista que no sabe enfocar, y esta conversión devuelve `null` en vez de
 * romper.
 */
function comoElementoDom(nodo: unknown): HTMLElement | null {
    if (!nodo || typeof nodo !== 'object') return null;

    const elemento = nodo as HTMLElement;

    return typeof elemento.focus === 'function' ? elemento : null;
}

/**
 * Los colores del overlay, con el nombre del token de `tailwind.config.cjs` que reproducen.
 *
 * Van en `style` y **no** en `className`, y no es una preferencia: el `Animated.View` de
 * `reanimated` no pasa por el `cssInterop` de NativeWind, así que se queda con
 * `class="css-view-g5y9jx"` y descarta las clases de Tailwind sin avisar. Mientras estuvieron en
 * clases, el velo no oscureció nada (`rgba(0, 0, 0, 0)`), la tarjeta no tuvo fondo —ni relleno, ni
 * esquinas— y el anillo salió negro en vez del tono de marca (odd/tasks/tour-ajustes-visuales.md,
 * L2). Los nodos que no son animados (`View`, `Text`, `Pressable`) siguen con clases: ésas sí
 * llegan.
 */
const TONO_VELO = 'rgba(76, 33, 43, 0.75)'; // `on-surface` al 75 %
const TONO_TARJETA = '#fff4f4'; // `surface`
const TONO_ANILLO = '#ff7574'; // `primary-container`
const TONO_SOMBRA = '#4c212b'; // `on-surface`

const ESTILOS = StyleSheet.create({
    elemento: { position: 'absolute' },
    /**
     * Antes de la primera medida la tarjeta toma su altura natural, que es la del contenido: es el
     * mismo alto que luego le da la colocación, así que no hay salto entre el primer fotograma y la
     * medida. Fijar aquí la estimación haría que la tarjeta naciera con un alto que no es el suyo.
     */
    alturaNatural: { height: 'auto' },
    /** El velo: todo lo que no es el objetivo, oscurecido para que el objetivo destaque solo (S1). */
    velo: { backgroundColor: TONO_VELO },
    /** El borde del hueco, en el tono claro de la marca: el único que se lee encima del velo. */
    anillo: { borderColor: TONO_ANILLO },
    /**
     * La tarjeta: fondo opaco, relleno y esquinas. Sin fondo propio, el texto se mezclaba con lo
     * que hubiera debajo (S2). Los valores son los del token que se usaba en clases: `rounded-2xl`
     * (16 px), `p-4` (16 px, `CARD_PADDING`) y `shadow-ambient-lg`.
     */
    tarjeta: {
        backgroundColor: TONO_TARJETA,
        borderRadius: 16,
        // El mismo relleno con el que `cardHeightForContent` calcula el alto de la tarjeta: si
        // cambiara aquí y no allí, el texto volvería a no caber (S3).
        padding: CARD_PADDING,
        // Las esquinas redondeadas sólo recortan si el nodo las recorta a él.
        overflow: 'hidden',
        // Un filo tenue separa la tarjeta del contenido de detrás cuando el velo se aclara. Cuenta
        // para el alto: `cardHeightForContent` lo suma en los dos lados.
        borderWidth: CARD_BORDER,
        borderColor: 'rgba(76, 33, 43, 0.10)',
        shadowColor: TONO_SOMBRA,
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 8,
    },
});

/**
 * Lleva un rectángulo a su sitio con `withTiming`, o de golpe si se pidió no animar.
 *
 * Cuatro valores compartidos en vez de un objeto: reanimated anima números sin sorpresas y así la
 * duración es una sola para el velo, el anillo y la tarjeta.
 *
 * La **primera** colocación de una aparición se salta siempre: animar desde la esquina sería un
 * barrido por toda la pantalla, no una transición entre paradas. El «ya estaba visible» se guarda en
 * un `ref` y se lee dentro del efecto, que es donde un `ref` se puede tocar.
 */
function useRectMotion(rect: Rect, animar: boolean, visible: boolean) {
    const x = useSharedValue(rect.x);
    const y = useSharedValue(rect.y);
    const ancho = useSharedValue(rect.width);
    const alto = useSharedValue(rect.height);
    const eraVisible = useRef(false);

    useEffect(() => {
        const primeraAparicion = visible && !eraVisible.current;
        eraVisible.current = visible;

        if (!animar || primeraAparicion) {
            // Movimiento reducido o primera colocación: se cancela lo que estuviera en vuelo y se
            // salta, sin transición.
            cancelAnimation(x);
            cancelAnimation(y);
            cancelAnimation(ancho);
            cancelAnimation(alto);
            x.value = rect.x;
            y.value = rect.y;
            ancho.value = rect.width;
            alto.value = rect.height;
            return;
        }

        const config = { duration: DURACION_MS };

        x.value = withTiming(rect.x, config);
        y.value = withTiming(rect.y, config);
        ancho.value = withTiming(rect.width, config);
        alto.value = withTiming(rect.height, config);
    }, [x, y, ancho, alto, rect.x, rect.y, rect.width, rect.height, animar, visible]);

    return useAnimatedStyle(() => ({
        left: x.value,
        top: y.value,
        width: ancho.value,
        height: alto.value,
    }));
}

export type TourOverlayProps = {
    /** La parada ya calculada por `current(state)`. `null` (o vacío) no pinta nada. */
    current: TourCurrent | null;
    onNext: () => void;
    onPrevious: () => void;
    onSkip: () => void;
    /** Si es `true`, los cambios de parada no se animan (S5, accesibilidad). */
    reduceMotion?: boolean;
    /** Se avisa una vez por parada cuando su objetivo todavía no tiene medida. */
    onTargetMissing?: () => void;
};

export function TourOverlay({
    current: parada,
    onNext,
    onPrevious,
    onSkip,
    reduceMotion = false,
    onTargetMissing,
}: TourOverlayProps) {
    const ventana = useWindowDimensions();
    const hueco = useTourTargetRect(parada?.step.targetId ?? '');
    const visible = parada !== null && hueco !== null;

    const tarjetaRef = useRef<View | null>(null);
    /** Quién tenía el foco antes de abrir el tour: ahí vuelve al terminar o saltar. */
    const focoPrevio = useRef<HTMLElement | null>(null);
    /** Sin DOM no hay foco que mover ni teclado que atrapar (nativo, servidor). */
    const hayDom = Platform.OS === 'web' && typeof document !== 'undefined';

    // Se leen aquí para que las dependencias de los efectos de foco digan qué cambia de verdad.
    const pasoActual = parada?.step.id ?? null;
    const paginaActual = parada?.pageIndex ?? 0;

    /**
     * La identidad de lo que se mide: **la página**, no la parada. Cada página tiene su texto y, por
     * tanto, su alto; con la parada como clave, la segunda página heredaba el alto de la primera y su
     * texto había que leerlo desplazando (D3, S3).
     */
    const claveDePagina = pasoActual === null ? null : `${pasoActual}#${paginaActual}`;

    // La tarjeta se coloca con lo que mide, no con lo que se supone que medirá (S6, S7). La medida
    // se pide siempre, también cuando no hay parada: el orden de los enganches no puede depender
    // de si el hueco ya llegó.
    const {
        size: tamanoTarjeta,
        onLayout: alMedirTarjeta,
        onContentSizeChange: alCambiarElContenido,
        measured: tarjetaMedida,
    } = useTamanoTarjeta(claveDePagina);

    const anillo = ringRect(hueco ?? VACIO, RING_INSET, RING_THICKNESS);
    const trozos = scrimPieces(anillo, ventana);
    const tarjeta = cardPlacement(anillo, ventana, tamanoTarjeta);

    const animar = visible && !reduceMotion;

    // Todos los enganches se llaman siempre, aunque no se pinte nada: el orden no puede depender de
    // si el objetivo ya se midió.
    const veloArriba = useRectMotion(trozos.top, animar, visible);
    const veloAbajo = useRectMotion(trozos.bottom, animar, visible);
    const veloIzquierda = useRectMotion(trozos.left, animar, visible);
    const veloDerecha = useRectMotion(trozos.right, animar, visible);
    const estiloAnillo = useRectMotion(anillo, animar, visible);
    const estiloTarjeta = useRectMotion(tarjeta, animar, visible);

    // Un solo aviso por parada sin medida: si el padre reintentara en cada render, esto sería un
    // bucle de renders disfrazado de reintento.
    const objetivoAusente = parada !== null && hueco === null ? parada.step.id : null;
    const avisada = useRef<string | null>(null);

    useEffect(() => {
        if (!objetivoAusente) {
            avisada.current = null;
            return;
        }

        if (avisada.current === objetivoAusente) return;

        avisada.current = objetivoAusente;
        onTargetMissing?.();
    }, [objetivoAusente, onTargetMissing]);

    useEffect(() => {
        if (!visible || !hayDom) return;

        // Se apunta quién tenía el foco **antes** de que el efecto de abajo se lo lleve a la
        // tarjeta. Al terminar o saltar, el overlay se desmonta y esto devuelve el foco: dejarlo
        // en un nodo que desaparece deja la página sin teclado.
        const activo = document.activeElement;
        focoPrevio.current = activo instanceof HTMLElement ? activo : null;

        return () => {
            const anterior = focoPrevio.current;
            focoPrevio.current = null;

            if (!anterior || !document.contains(anterior)) return;

            anterior.focus();
        };
    }, [visible, hayDom]);

    /**
     * El foco entra en la tarjeta en cada página. Si se quedara donde estaba, el siguiente Tab
     * volvería a la página de detrás y el diálogo dejaría de ser modal para el teclado: el mismo
     * agujero que abre `pointerEvents="none"` para el ratón.
     */
    useEffect(() => {
        if (!visible || !hayDom) return;

        comoElementoDom(tarjetaRef.current)?.focus();
    }, [visible, hayDom, pasoActual, paginaActual]);

    useEffect(() => {
        if (!visible || !hayDom) return;

        const alPulsar = (evento: KeyboardEvent) => {
            if (evento.key === 'Escape') {
                evento.preventDefault();
                onSkip();

                return;
            }

            if (evento.key !== 'Tab') return;

            const tarjetaDom = comoElementoDom(tarjetaRef.current);

            if (!tarjetaDom) return;

            const enfocables = Array.from(
                tarjetaDom.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLE)
            );
            const primero = enfocables[0];
            const ultimo = enfocables[enfocables.length - 1];

            // Un diálogo sin nada enfocable: el foco se queda en la propia tarjeta y no se escapa.
            if (!primero || !ultimo) {
                evento.preventDefault();
                tarjetaDom.focus();

                return;
            }

            const actual = document.activeElement;
            const dentro = actual instanceof Node && tarjetaDom.contains(actual);

            if (evento.shiftKey) {
                // Hacia atrás desde el primero (o desde la tarjeta) se envuelve al último. Sin
                // esto, Mayús+Tab saldría a la página de detrás.
                if (!dentro || actual === primero || actual === tarjetaDom) {
                    evento.preventDefault();
                    ultimo.focus();
                }

                return;
            }

            // Hacia delante desde el último (o desde fuera) se envuelve al primero.
            if (!dentro || actual === ultimo) {
                evento.preventDefault();
                primero.focus();
            }
        };

        document.addEventListener('keydown', alPulsar);

        return () => document.removeEventListener('keydown', alPulsar);
    }, [visible, hayDom, onSkip]);

    if (!parada || !hueco) return null;

    // «Anterior» sólo desaparece en la primera página del tour: en la primera página de un paso sí
    // está, porque `previous` vuelve a la última página del paso anterior.
    const esPrimeraPagina = parada.stepIndex === 0 && parada.pageIndex === 0;
    const esUltimaPagina =
        parada.stepIndex === parada.stepCount - 1 && parada.pageIndex === parada.pageCount - 1;
    const textoAvanzar = esUltimaPagina ? 'Terminar' : 'Siguiente';
    const etiquetaAvanzar = esUltimaPagina
        ? 'Terminar el tour'
        : 'Siguiente página del tour';

    // Diagnóstico de la colocación: los valores hacia los que va la animación. La tarjeta se mueve
    // con un estilo animado que no es legible desde un test (y que reanimated aplica fuera de
    // React), así que estas cifras son a la vez lo que se depura a mano y lo que se fija en las
    // pruebas de S6. Sólo en web: en nativo `dataSet` no existe.
    const diagnostico =
        Platform.OS === 'web'
            ? ({
                  dataSet: {
                      tourColocacion: tarjeta.placement,
                      tourX: tarjeta.x,
                      tourY: tarjeta.y,
                      tourAncho: tarjeta.width,
                      tourAlto: tarjeta.height,
                  },
              } as unknown as Record<string, unknown>)
            : {};

    return (
        <View style={StyleSheet.absoluteFill} className="absolute inset-0 z-50">
            {/* La capa que se come los toques: con el tour abierto, la página de detrás no se puede
                usar. Va la primera para quedar debajo del anillo y de la tarjeta. */}
            <View
                style={StyleSheet.absoluteFill}
                testID="tour-scrim-blocker"
                onStartShouldSetResponder={() => true}
            />

            <Animated.View
                testID="tour-scrim-top"
                style={[ESTILOS.elemento, ESTILOS.velo, veloArriba]}
            />
            <Animated.View
                testID="tour-scrim-bottom"
                style={[ESTILOS.elemento, ESTILOS.velo, veloAbajo]}
            />
            <Animated.View
                testID="tour-scrim-left"
                style={[ESTILOS.elemento, ESTILOS.velo, veloIzquierda]}
            />
            <Animated.View
                testID="tour-scrim-right"
                style={[ESTILOS.elemento, ESTILOS.velo, veloDerecha]}
            />

            {/* El anillo es el borde del rectángulo: el interior queda transparente y deja ver el
                objetivo. `primary-container` es el tono claro de la marca, el único que se lee
                encima del velo oscuro. */}
            <Animated.View
                testID="tour-ring"
                pointerEvents="none"
                style={[
                    ESTILOS.elemento,
                    ESTILOS.anillo,
                    estiloAnillo,
                    { borderWidth: anillo.thickness, borderRadius: anillo.radius },
                ]}
            />

            <Animated.View
                ref={tarjetaRef}
                testID="tour-card"
                tabIndex={-1}
                onLayout={alMedirTarjeta}
                style={[
                    ESTILOS.elemento,
                    ESTILOS.tarjeta,
                    estiloTarjeta,
                    // Antes de la primera medida la altura es la del contenido: es el alto que
                    // todavía no ha llegado por `onContentSizeChange`.
                    !tarjetaMedida && ESTILOS.alturaNatural,
                ]}
                role="dialog"
                aria-modal={true}
                accessibilityViewIsModal
                {...diagnostico}
            >
                {/* El alto de la tarjeta sale del alto natural de este contenido y no al revés
                    (D4): por eso se mide aquí, donde el `ScrollView` lo da independiente del alto
                    de la tarjeta. Sólo se desplaza si la colocación tuvo que recortarla porque no
                    cabía en el viewport. */}
                <ScrollView
                    testID="tour-card-content"
                    onContentSizeChange={alCambiarElContenido}
                >
                    <View className="flex-row items-center justify-between gap-2">
                        <Text className="text-xs font-sans-semibold uppercase tracking-widest text-primary">
                            {parada.stepLabel}
                        </Text>
                        <Text className="text-xs font-sans text-on-background/60">
                            {parada.pageLabel}
                        </Text>
                    </View>

                    {/* La región viva anuncia la página nueva; el texto cambia en el sitio, que es
                        lo que un lector de pantalla necesita oír. */}
                    <Text
                        className="mt-2 text-base font-sans text-on-background"
                        accessibilityLiveRegion="polite"
                        aria-live="polite"
                    >
                        {parada.page}
                    </Text>

                    <View className="mt-4 flex-row items-center justify-between gap-2">
                        {esPrimeraPagina ? (
                            <View />
                        ) : (
                            <Pressable
                                onPress={onPrevious}
                                accessibilityRole="button"
                                accessibilityLabel="Página anterior del tour"
                                className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 py-2 active:opacity-70"
                            >
                                <Text className="text-sm font-sans-semibold text-primary">
                                    Anterior
                                </Text>
                            </Pressable>
                        )}

                        <View className="flex-row items-center gap-2">
                            {/* Saltar está siempre, también en la última página (S1). */}
                            <Pressable
                                onPress={onSkip}
                                accessibilityRole="button"
                                accessibilityLabel="Saltar el tour"
                                className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 py-2 active:opacity-70"
                            >
                                <Text className="text-sm font-sans-semibold text-primary">
                                    Saltar
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={onNext}
                                accessibilityRole="button"
                                accessibilityLabel={etiquetaAvanzar}
                                className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-primary px-4 py-2 active:opacity-90"
                            >
                                <Text className="text-sm font-sans-bold text-on-primary">
                                    {textoAvanzar}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </Animated.View>
        </View>
    );
}
