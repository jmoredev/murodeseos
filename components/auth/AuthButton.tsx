import React from 'react';
import { Pressable, Text, View } from 'react-native';

type Variant = 'primary' | 'secondary';

type AuthButtonProps = {
    /** Etiqueta en reposo. También es el nombre accesible si no se pasa otro. */
    label: string;
    onPress?: () => void;
    disabled?: boolean;
    variant?: Variant;
    /**
     * Mientras trabaja: el texto cambia («Iniciando sesión…», «Enviando…») y
     * delante gira un anillo, sin cambiar el tamaño del botón
     * (`11-acceso.html`, nota 3 de las reglas de la pantalla).
     */
    loading?: boolean;
    loadingLabel?: string;
    accessibilityLabel?: string;
    testID?: string;
    /** Test ID del anillo girando, para poder afirmarlo desde las pruebas. */
    spinnerTestID?: string;
    className?: string;
};

const VARIANTS: Record<Variant, { box: string; text: string; spinner: string }> = {
    primary: {
        box: 'border-primary bg-primary',
        text: 'text-on-primary',
        spinner: 'border-on-primary/30 border-t-on-primary',
    },
    secondary: {
        box: 'border-border-strong bg-surface-container-lowest',
        text: 'text-ink',
        spinner: 'border-ink-2/30 border-t-ink-2',
    },
};

/**
 * Botón de las pantallas de acceso (`11 · .btn`): 48 px de alto mínimo
 * (`--touch`, §6), forma de píldora y texto de 17 px en peso 700. El primario es
 * plano `--primary`; el secundario es blanco con contorno `--border-strong`.
 */
export function AuthButton({
    label,
    onPress,
    disabled = false,
    variant = 'primary',
    loading = false,
    loadingLabel,
    accessibilityLabel,
    testID,
    spinnerTestID,
    className = '',
}: AuthButtonProps) {
    const busy = disabled || loading;
    const visibleLabel = loading ? (loadingLabel ?? label) : label;
    const { box, text, spinner } = VARIANTS[variant];

    return (
        <Pressable
            onPress={onPress}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled: busy, busy: loading }}
            testID={testID}
            className={`min-h-[48px] w-full flex-row items-center justify-center gap-2 rounded-full border-2 px-5 py-2.5 ${box} ${busy ? 'opacity-60' : 'active:opacity-90'} ${className}`}
        >
            {loading ? (
                <View
                    testID={spinnerTestID}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    className={`h-5 w-5 animate-spin rounded-full border-[3px] ${spinner}`}
                />
            ) : null}
            <Text className={`text-[17px] font-sans-bold leading-[1.25] ${text}`}>
                {visibleLabel}
            </Text>
        </Pressable>
    );
}
