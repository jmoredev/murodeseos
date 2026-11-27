import React from 'react';
import { View, type DimensionValue, type ViewStyle } from 'react-native';

/**
 * Esqueleto de carga (12 · P2/P3, nota 1): el hueco del contenido, con la forma que tendrá.
 *
 * Por qué existe: hoy cada pantalla enseña un círculo girando con «Cargando…», así que la pantalla
 * salta cuando el contenido llega y no se parece a lo que va a aparecer. Con el esqueleto los
 * títulos y las pestañas son reales y sólo el contenido es un bloque.
 *
 * Tres reglas de la ficha que este componente hace cumplir:
 *
 * 1. **Una sola pieza**: cambia el tamaño y el radio, nunca la forma ni el color (nota 2 del
 *    artboard). El color sale del token `border` (§1.1) y el latido es `animate-pulse`; con
 *    movimiento reducido `app/global.css` lo deja en bloques quietos y el estado se sigue
 *    entendiendo.
 * 2. **Es decorativo**: `aria-hidden` en la raíz. El anuncio de «cargando» lo hace la pantalla con
 *    un `role="status"`, una vez, no cada bloque. Un lector de pantalla no debe leer catorce cajas.
 * 3. **Sin hex**: todo color y todo radio salen de tokens de `tailwind.config.cjs`.
 *
 * S9: en T2a se crea la pieza y **no** se conecta a ninguna pestaña; cada tramo la enchufa en el
 * suyo (T3/T4/T6/T10).
 */

/** Las formas del artboard (12 · `.gs-sk*`), en px. */
export type SkeletonVariant = 'line' | 'title' | 'subtitle' | 'avatar' | 'tile' | 'pill' | 'hero';

const FORMAS: Record<SkeletonVariant, ViewStyle> = {
    // `.gs-sk-line`: la línea de texto de una fila.
    line: { height: 15, borderRadius: 12, width: '100%' },
    // `.gs-sk-h20` / `.gs-sk-h26`: líneas de título de fila.
    title: { height: 20, borderRadius: 12, width: '80%' },
    subtitle: { height: 26, borderRadius: 12, width: '35%' },
    // `.gs-sk-av`: avatar, círculo perfecto.
    avatar: { width: 48, height: 48, borderRadius: 9999 },
    // `.gs-sk-tile`: tile de 56 con radio 16 (`--r-md`).
    tile: { width: 56, height: 56, borderRadius: 16 },
    // `.gs-sk-pill`: pastilla de filtros o de pestañas.
    pill: { height: 28, borderRadius: 9999, width: '45%' },
    // `.gs-sk-hero`: el panel de la próxima celebración, radio `--r-card`.
    hero: { height: 186, borderRadius: 20, width: '100%' },
};

export interface SkeletonProps {
    /** Forma del hueco. Por defecto, una línea de texto. */
    variant?: SkeletonVariant;
    /** Ancho: número (px) o cadena CSS (`'65%'`, `'100%'`). Manda sobre el de la forma. */
    width?: DimensionValue;
    /** Alto en px. Manda sobre el de la forma. */
    height?: number;
    /** Radio en px. Manda sobre el de la forma. */
    radius?: number;
    /** Clases extra (márgenes, alineación). */
    className?: string;
    style?: ViewStyle;
    testID?: string;
}

export function Skeleton({ variant = 'line', width, height, radius, className = '', style, testID }: SkeletonProps) {
    return (
        <View
            testID={testID}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            className={`bg-border animate-pulse ${className}`.trim()}
            style={[
                FORMAS[variant],
                style,
                width !== undefined ? { width } : null,
                height !== undefined ? { height } : null,
                radius !== undefined ? { borderRadius: radius } : null,
            ]}
        />
    );
}

export interface SkeletonLayoutProps {
    children?: React.ReactNode;
    className?: string;
    style?: ViewStyle;
    testID?: string;
}

/** `.gs-sk-row`: una fila de huecos (tile + dos líneas), en horizontal. */
export function SkeletonRow({ children, className = '', style, testID }: SkeletonLayoutProps) {
    return (
        <View
            testID={testID}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            className={className}
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}
        >
            {children}
        </View>
    );
}

/** `.gs-sk-card`: la tarjeta que envuelve una o dos filas de huecos. */
export function SkeletonCard({ children, className = '', style, testID }: SkeletonLayoutProps) {
    return (
        <View
            testID={testID}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            className={`bg-surface-container-lowest border border-border rounded-[20px] p-3.5 shadow-sh-1 ${className}`.trim()}
            style={style}
        >
            {children}
        </View>
    );
}
