import React from 'react';
import Feather from '@expo/vector-icons/Feather';

/**
 * Los nombres permitidos derivan del PROPIO mapa de glifos de Feather: si
 * alguien escribe un nombre que la familia no tiene, es un error de tipos aquí
 * y no un «?» silencioso en ejecución (el render de `@expo/vector-icons`
 * sustituye los nombres desconocidos por '?').
 */
export type AppIconName = keyof typeof Feather.glyphMap;

interface AppIconProps {
    /** Nombre del glifo en Feather, validado por el tipo `AppIconName`. */
    name: AppIconName;
    /** Tamaño del glifo en px. 20 por defecto: es el del dock y el más común. */
    size?: number;
    /** Clases NativeWind. El COLOR debe venir SIEMPRE por aquí (p. ej. `text-primary`): */
    className?: string;
    /** Estilo adicional de RN (posiciones absolutas, rotaciones…). */
    style?: object;
    testID?: string;
    /** Oculta el glifo al lector de pantalla cuando el control ya tiene nombre propio. */
    accessibilityElementsHidden?: boolean;
    importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
}

/**
 * Envoltorio ÚNICO para los iconos de la app: una familia (Feather), un peso
 * (el del set) y una sola fuente de verdad para el color — el `className`
 * NativeWind del llamador, igual que cualquier `<Text>` del repo.
 *
 * `@expo/vector-icons` renderiza a través de `<Text>`, así que la clase de
 * color del llamador funciona sin pasar ninguna prop `color` (que la
 * sobrescribiría con un hex y rompería el token del tema).
 *
 * Se importa por la subruta `/Feather` (y no del índice del paquete): tirar
 * del índice arrastra TODOS los sets del paquete; la subruta carga sólo la
 * familia que la app usa. En jsdom, vitest resuelve esta subruta al mock de
 * `test/mocks/expo-vector-icons.tsx` (la fuente real no existe en node).
 */
export function AppIcon({
    name,
    size = 20,
    className,
    style,
    testID,
    accessibilityElementsHidden,
    importantForAccessibility,
}: AppIconProps) {
    return (
        <Feather
            name={name}
            size={size}
            className={className}
            style={style}
            testID={testID}
            accessibilityElementsHidden={accessibilityElementsHidden}
            importantForAccessibility={importantForAccessibility}
        />
    );
}
