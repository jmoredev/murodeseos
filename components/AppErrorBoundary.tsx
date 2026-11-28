import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';

/**
 * Pantalla de error de la aplicación, para que un fallo de render **nunca** deje
 * un vacío sin explicación.
 *
 * Por qué existe: la app no exportaba ningún `ErrorBoundary`, así que cualquier
 * error de render desmontaba el árbol de React y quedaba una pantalla vacía, sin
 * texto y sin salida. Eso es la mitad del «pantallazo negro» que reportó el
 * propietario: cuando el historial caía en una ruta que el router no podía
 * resolver, no había **nada** que pintar.
 *
 * Dos decisiones que no son de estilo, sino de que esto sirva:
 *
 * 1. **No usa las fuentes de la marca.** El error puede ocurrir antes de que
 *    carguen, o ser ellas la causa; una pantalla de error con texto invisible
 *    sería el mismo vacío con más pasos. Se fija una pila del sistema en **todo**
 *    el texto. El motivo sigue en pie: es la única pantalla que tiene que pintarse
 *    justo cuando lo demás puede haber fallado.
 * 2. **Dos salidas, no una.** `retry` (que re-monta el árbol) y una recarga
 *    completa, porque hay fallos de los que no se sale re-montando.
 *
 * Estilos en línea a propósito: esto tiene que poder pintarse aunque el resto
 * del sistema de estilos haya fallado. Por eso los colores van aquí escritos y
 * no como `className`: son los tokens canónicos de `design/rediseno-muro/sistema-nuevo.md`
 * §1, con su nombre al lado para que no haya dudas de dónde salen.
 *
 * T2a le pone la forma del artboard 12 · P5: icono en tile, título, un cuerpo que dice que lo
 * guardado sigue guardado, «Reintentar» + «Recargar la página» y la nota de qué hacer si vuelve a
 * pasar. La copy no promete que la app funcione: dice qué se ha roto y qué no se ha perdido.
 */
const FUENTE_SISTEMA = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Tokens canónicos (`sistema-nuevo.md` §1), escritos aquí a propósito (ver arriba). */
const COLOR = {
    bg: '#FFF8F1', // --bg · lienzo
    surface: '#FFFFFF', // --surface · tarjeta, botón secundario
    ink: '#2B1A12', // --ink · texto principal
    ink2: '#5C4033', // --ink-2 · texto secundario
    primary: '#B93D12', // --primary · acción principal
    onPrimary: '#FFFFFF', // --on-primary
    danger: '#B42318', // --danger · icono del fallo
    dangerSoft: '#FDECEA', // --danger-soft · fondo del tile
    borderStrong: '#E3C8B6', // --border-strong · contorno del secundario (no es un control de formulario)
} as const;

interface AppErrorBoundaryProps {
    /** Lo pasa `expo-router` al recoger el `ErrorBoundary` de la ruta. */
    error: Error;
    /** Lo pasa `expo-router`: re-monta el árbol que falló. */
    retry: () => void;
    /** Inyectable para poder probarlo; en producción recarga la página. */
    onReload?: () => void;
}

export function AppErrorBoundary({ error, retry, onReload }: AppErrorBoundaryProps) {
    const recargar =
        onReload ??
        (() => {
            if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
                window.location.reload();
            }
        });

    return (
        <View
            style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                backgroundColor: COLOR.bg,
            }}
        >
            <View
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                    width: 76,
                    height: 76,
                    borderRadius: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: COLOR.dangerSoft,
                }}
            >
                <AppIcon name="alert-triangle" size={38} style={{ color: COLOR.danger }} />
            </View>

            <Text
                style={{
                    fontFamily: FUENTE_SISTEMA,
                    fontSize: 26,
                    lineHeight: 30,
                    fontWeight: '800',
                    color: COLOR.ink,
                    textAlign: 'center',
                    marginTop: 18,
                }}
            >
                Algo ha ido mal
            </Text>
            <Text
                style={{
                    fontFamily: FUENTE_SISTEMA,
                    fontSize: 17,
                    lineHeight: 25,
                    color: COLOR.ink2,
                    textAlign: 'center',
                    maxWidth: 306,
                    marginTop: 8,
                }}
            >
                Esta pantalla no se ha podido mostrar. Tus listas, tus reservas y tus grupos siguen guardados: no se ha
                perdido nada.
            </Text>

            <View style={{ width: '100%', maxWidth: 360, gap: 10, marginTop: 22 }}>
                <Pressable
                    onPress={retry}
                    accessibilityRole="button"
                    accessibilityLabel="Reintentar"
                    style={{
                        minHeight: 48,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 20,
                        borderRadius: 9999,
                        backgroundColor: COLOR.primary,
                    }}
                >
                    <View aria-hidden importantForAccessibility="no-hide-descendants">
                        <AppIcon name="refresh-cw" size={20} style={{ color: COLOR.onPrimary }} />
                    </View>
                    <Text style={{ fontFamily: FUENTE_SISTEMA, fontSize: 17, fontWeight: '700', color: COLOR.onPrimary }}>
                        Reintentar
                    </Text>
                </Pressable>

                <Pressable
                    onPress={recargar}
                    accessibilityRole="button"
                    accessibilityLabel="Recargar la página"
                    style={{
                        minHeight: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 10,
                        paddingHorizontal: 20,
                        borderRadius: 9999,
                        borderWidth: 2,
                        borderColor: COLOR.borderStrong,
                        backgroundColor: COLOR.surface,
                    }}
                >
                    <Text style={{ fontFamily: FUENTE_SISTEMA, fontSize: 17, fontWeight: '700', color: COLOR.ink }}>
                        Recargar la página
                    </Text>
                </Pressable>
            </View>

            <Text
                style={{
                    fontFamily: FUENTE_SISTEMA,
                    fontSize: 16,
                    lineHeight: 23,
                    color: COLOR.ink2,
                    textAlign: 'center',
                    maxWidth: 306,
                    marginTop: 18,
                }}
            >
                Si vuelve a pasar, cierra la app del todo y ábrela otra vez.
            </Text>

            {/* El mensaje técnico sólo se muestra en desarrollo: en producción no
                aporta nada al usuario y puede filtrar detalles internos. */}
            {typeof __DEV__ !== 'undefined' && __DEV__ && error?.message ? (
                <Text
                    style={{
                        fontFamily: FUENTE_SISTEMA,
                        fontSize: 12,
                        color: COLOR.ink,
                        textAlign: 'center',
                        marginTop: 20,
                        opacity: 0.7,
                    }}
                >
                    {error.message}
                </Text>
            ) : null}
        </View>
    );
}
