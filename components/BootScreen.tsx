import React from 'react';
import { Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';

/**
 * Pantalla de arranque (12 · P1). Es lo que se ve:
 *
 * 1. mientras cargan las fuentes (`app/_layout.tsx` pintaba un fondo liso, indistinguible de una
 *    app colgada);
 * 2. mientras se comprueba la sesión y el nombre del perfil (`app/index.tsx` pintaba un círculo
 *    girando con «Cargando...»).
 *
 * Dice el nombre de la app, qué es y **cuánto** puede tardar, y anuncia el arranque a los lectores
 * de pantalla con un `role="status"`. La rueda es decorativa: el texto ya lo explica.
 *
 * Las dos pilas de fuente van escritas con su respaldo real (`system-ui`…) porque esta pantalla
 * existe justamente **mientras Nunito carga**: si el texto dependiera de una cara que aún no está,
 * quedaría invisible y sería el mismo vacío con más pasos. Nunito va primero, así que en cuanto
 * llega, la pantalla pasa a la tipografía de la marca sin recargar nada.
 */
const FUENTE_CUERPO =
    'Nunito_600SemiBold, ui-rounded, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FUENTE_TITULO =
    'Nunito_800ExtraBold, ui-rounded, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Columna de texto pequeña pero dentro del árbol de accesibilidad (equivalente a `sr-only`). */
const SOLO_LECTOR = {
    position: 'absolute',
    width: 1,
    height: 1,
    margin: -1,
    padding: 0,
    overflow: 'hidden',
} as const;

export function BootScreen() {
    return (
        <View className="flex-1 items-center justify-center bg-surface px-[34px] pb-[30px]">
            <View
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="h-[78px] w-[78px] items-center justify-center rounded-[24px] border-2 border-border-strong bg-surface-container-lowest shadow-sh-2"
            >
                <AppIcon name="gift" size={40} className="text-primary-dark" />
            </View>

            <Text
                style={{ fontFamily: FUENTE_TITULO }}
                className="mt-5 text-center text-[27px] leading-[1.15] tracking-[-0.02em] text-ink"
            >
                Muro de Deseos
            </Text>
            <Text
                style={{ fontFamily: FUENTE_CUERPO }}
                className="mt-1.5 text-center text-[17px] leading-[1.4] text-ink-2"
            >
                Listas de deseos compartidas
            </Text>

            <View
                testID="spinner"
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="mt-[26px] h-[54px] w-[54px] animate-spin rounded-full border-[6px] border-primary-soft border-t-primary"
            />

            <View className="mt-[26px] max-w-[296px] border-t border-border-strong pt-4">
                <Text
                    style={{ fontFamily: FUENTE_CUERPO }}
                    className="text-center text-[16px] leading-[1.4] text-ink-2"
                >
                    Preparando tu muro. La primera vez suele tardar unos segundos.
                </Text>
            </View>

            <View role="status" aria-live="polite" style={SOLO_LECTOR}>
                <Text style={{ fontFamily: FUENTE_CUERPO }}>
                    Cargando la aplicación. Preparando tu muro de deseos.
                </Text>
            </View>
        </View>
    );
}
