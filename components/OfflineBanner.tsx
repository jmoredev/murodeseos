import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { connectivity, useOnline } from '@/lib/use-online';

/**
 * Banda de «Sin conexión» (12 · P4). Se monta una sola vez en el armazón de la app
 * (`app/_layout.tsx`), en el flujo de la columna: **no** flota sobre los controles, así que no
 * tapa nada y no necesita z-index ni trucos de `pointer-events`. Con conexión no ocupa ni un píxel.
 *
 * Copia: el artboard asegura «Ves lo que se guardó el <fecha>». Esta app no guarda esa copia, y
 * S8 lo prohíbe expresamente («Aviso simple, sin prometer datos guardados»), así que se conserva
 * la forma —icono, título, detalle y su botón— y el detalle habla sólo de la conexión.
 *
 * No es un brindis: es una banda y se anuncia con `role="alert"`; no se va sola, espera a que
 * vuelva la conexión o a que se pulse «Reintentar».
 */

export interface OfflineBannerProps {
    /**
     * Qué hace «Reintentar». Por defecto **vuelve a preguntar** por la conexión y, si sigue sin
     * haberla, lo dice en la propia banda. No recarga la página: recargar sin conexión deja la
     * app en la página «sin conexión» del navegador y tira lo que hubiera sin guardar.
     */
    onRetry?: () => void;
}

export function OfflineBanner({ onRetry }: OfflineBannerProps) {
    const online = useOnline();
    // Si se pulsó «Reintentar» y sigue sin conexión, se dice: un botón que no responde nada
    // parece roto. Al volver la conexión, el aviso se limpia para no quedar pegado al siguiente corte.
    const [sigueSinConexion, setSigueSinConexion] = useState(false);

    useEffect(() => {
        if (online) setSigueSinConexion(false);
    }, [online]);

    // `useOnline` devuelve `true` en nativo y en el servidor: la banda nunca aparece sin fuente.
    if (online) return null;

    const reintentar = () => {
        if (onRetry) {
            onRetry();
            return;
        }

        // Releer el estado real (`navigator.onLine`) y avisar a quien esté suscrito: si la conexión
        // volvió sin que llegara el evento `online`, la banda desaparece igualmente en este mismo
        // render. Si sigue sin haberla, se dice sin prometer nada sobre datos guardados (S8).
        connectivity.recheck();
        setSigueSinConexion(!connectivity.getSnapshot());
    };

    return (
        <View
            role="alert"
            aria-labelledby="sin-conexion-titulo"
            aria-describedby="sin-conexion-detalle"
            className="flex-row items-start gap-[11px] border-[1.5px] border-border-strong bg-sand px-[13px] py-3"
        >
            <View aria-hidden importantForAccessibility="no-hide-descendants">
                <AppIcon name="wifi-off" size={24} className="text-sand-ink" />
            </View>
            <View className="min-w-0 flex-1">
                <Text
                    id="sin-conexion-titulo"
                    className="font-display-extrabold text-[17px] leading-[1.3] text-ink"
                >
                    Sin conexión
                </Text>
                <Text id="sin-conexion-detalle" className="mt-0.5 text-[16px] leading-[1.38] text-ink-2">
                    No tienes conexión a internet. Puede que lo que ves no esté actualizado; vuelve a intentarlo
                    cuando la conexión vuelva.
                </Text>
                {sigueSinConexion ? (
                    <Text role="status" className="mt-1.5 text-[16px] leading-[1.38] text-ink">
                        Sigue sin conexión. Comprueba tu red e inténtalo otra vez.
                    </Text>
                ) : null}
                <Pressable
                    onPress={reintentar}
                    accessibilityRole="button"
                    accessibilityLabel="Reintentar"
                    className="mt-2.5 min-h-[48px] flex-row items-center justify-center gap-[7px] rounded-full border-2 border-border-strong bg-surface-container-lowest px-4 active:bg-hover-control"
                >
                    <View aria-hidden importantForAccessibility="no-hide-descendants">
                        <AppIcon name="refresh-cw" size={20} className="text-ink" />
                    </View>
                    <Text className="font-display-extrabold text-[17px] text-ink">Reintentar</Text>
                </Pressable>
            </View>
        </View>
    );
}
