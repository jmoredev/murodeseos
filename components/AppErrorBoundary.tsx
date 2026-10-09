import React from 'react';
import { Pressable, Text, View } from 'react-native';

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
 *    sería el mismo vacío con más pasos. Se fija una pila del sistema.
 * 2. **Dos salidas, no una.** `retry` (que re-monta el árbol) y una recarga
 *    completa, porque hay fallos de los que no se sale re-montando.
 *
 * Estilos en línea a propósito: esto tiene que poder pintarse aunque el resto
 * del sistema de estilos haya fallado.
 */
const FUENTE_SISTEMA = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

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
                backgroundColor: '#fff4f4',
            }}
        >
            <Text
                style={{
                    fontFamily: FUENTE_SISTEMA,
                    fontSize: 20,
                    fontWeight: '700',
                    color: '#4c212b',
                    textAlign: 'center',
                    marginBottom: 10,
                }}
            >
                Algo ha ido mal
            </Text>
            <Text
                style={{
                    fontFamily: FUENTE_SISTEMA,
                    fontSize: 15,
                    lineHeight: 22,
                    color: '#4c212b',
                    textAlign: 'center',
                    marginBottom: 24,
                }}
            >
                La aplicación ha tenido un problema y no ha podido continuar. Puedes reintentar; si vuelve a pasar, recarga.
            </Text>

            <Pressable
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel="Reintentar"
                style={{
                    minHeight: 44,
                    paddingVertical: 12,
                    paddingHorizontal: 28,
                    borderRadius: 9999,
                    backgroundColor: '#aa2c32',
                    marginBottom: 12,
                }}
            >
                <Text style={{ fontFamily: FUENTE_SISTEMA, fontSize: 16, fontWeight: '700', color: '#fff4f4' }}>
                    Reintentar
                </Text>
            </Pressable>

            <Pressable
                onPress={recargar}
                accessibilityRole="button"
                accessibilityLabel="Recargar"
                style={{
                    minHeight: 44,
                    paddingVertical: 12,
                    paddingHorizontal: 28,
                    borderRadius: 9999,
                    borderWidth: 1,
                    borderColor: '#4c212b',
                }}
            >
                <Text style={{ fontFamily: FUENTE_SISTEMA, fontSize: 16, fontWeight: '700', color: '#4c212b' }}>
                    Recargar
                </Text>
            </Pressable>

            {/* El mensaje técnico sólo se muestra en desarrollo: en producción no
                aporta nada al usuario y puede filtrar detalles internos. */}
            {typeof __DEV__ !== 'undefined' && __DEV__ && error?.message ? (
                <Text
                    style={{
                        fontFamily: FUENTE_SISTEMA,
                        fontSize: 12,
                        color: '#4c212b',
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
