import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import type { TourCurrent } from '@/lib/tour/engine';
import {
    RING_INSET,
    RING_THICKNESS,
    cardPlacement,
    ringRect,
    scrimPieces,
    type Rect,
} from '@/lib/tour/geometry';
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

/**
 * Lo que se estima que ocupa la tarjeta. La colocación se decide **antes** de pintarla —la tarjeta
 * no puede medirse a sí misma antes de existir—, así que se usa una estimación generosa con el
 * texto más largo del guion. Si la estimación se queda corta, la tarjeta crece hacia abajo y sigue
 * sin tapar el hueco, porque el anclaje ya está decidido.
 */
const TARJETA_ESTIMADA = { width: 320, height: 190 };

const VACIO: Rect = { x: 0, y: 0, width: 0, height: 0 };

const ESTILOS = StyleSheet.create({
    elemento: { position: 'absolute' },
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

    const anillo = ringRect(hueco ?? VACIO, RING_INSET, RING_THICKNESS);
    const trozos = scrimPieces(anillo, ventana);
    const tarjeta = cardPlacement(anillo, ventana, TARJETA_ESTIMADA);

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
        if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;

        const alPulsar = (evento: KeyboardEvent) => {
            if (evento.key !== 'Escape') return;

            evento.preventDefault();
            onSkip();
        };

        document.addEventListener('keydown', alPulsar);

        return () => document.removeEventListener('keydown', alPulsar);
    }, [visible, onSkip]);

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
                style={[ESTILOS.elemento, veloArriba]}
                className="bg-on-surface/70"
            />
            <Animated.View
                testID="tour-scrim-bottom"
                style={[ESTILOS.elemento, veloAbajo]}
                className="bg-on-surface/70"
            />
            <Animated.View
                testID="tour-scrim-left"
                style={[ESTILOS.elemento, veloIzquierda]}
                className="bg-on-surface/70"
            />
            <Animated.View
                testID="tour-scrim-right"
                style={[ESTILOS.elemento, veloDerecha]}
                className="bg-on-surface/70"
            />

            {/* El anillo es el borde del rectángulo: el interior queda transparente y deja ver el
                objetivo. `primary-container` es el tono claro de la marca, el único que se lee
                encima del velo oscuro. */}
            <Animated.View
                testID="tour-ring"
                pointerEvents="none"
                style={[
                    ESTILOS.elemento,
                    estiloAnillo,
                    { borderWidth: anillo.thickness, borderRadius: anillo.radius },
                ]}
                className="border-primary-container"
            />

            <Animated.View
                testID="tour-card"
                style={[ESTILOS.elemento, estiloTarjeta]}
                className="rounded-2xl bg-surface p-4 shadow-ambient-lg"
                role="dialog"
                aria-modal={true}
                accessibilityViewIsModal
            >
                <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-xs font-sans-semibold uppercase tracking-widest text-primary">
                        {parada.stepLabel}
                    </Text>
                    <Text className="text-xs font-sans text-on-background/60">
                        {parada.pageLabel}
                    </Text>
                </View>

                {/* La región viva anuncia la página nueva; el texto cambia en el sitio, que es lo
                    que un lector de pantalla necesita oír. */}
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
                            <Text className="text-sm font-sans-semibold text-primary">Saltar</Text>
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
            </Animated.View>
        </View>
    );
}
