import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { AppIcon, AppIconName } from '@/components/ui/AppIcon';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
    FIELD_BASE,
    FIELD_IDLE,
    FIELD_INVALID,
    FIELD_OFF,
    LABEL,
    PLACEHOLDER_INK,
} from './styles';

type AuthTextFieldProps = {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    /**
     * Base de los identificadores y del testID del campo: el mensaje de error
     * queda en `<testID>-error` y la ayuda en `<testID>-hint`, que son los ids
     * que el campo cita en `aria-describedby`.
     */
    testID: string;
    accessibilityLabel: string;
    /** Mensaje junto al campo (`11 · .ac-ferr`); también marca `aria-invalid`. */
    error?: string;
    errorTestID?: string;
    /** Ayuda bajo el campo (`11 · .ac-hint`). */
    hint?: string;
    hintIcon?: AppIconName;
    /** Campo atenuado y sin edición mientras se envía (`11 · .ac-input-off`). */
    off?: boolean;
    /**
     * Presente si el campo es una contraseña. `toggleMode` elige el control que
     * la descubre: el ojo del alta o el «Mostrar» de texto del acceso.
     */
    password?: { toggleMode?: 'icon' | 'text' };
    inputRef?: React.Ref<TextInput>;
    placeholder?: string;
    autoCapitalize?: TextInputProps['autoCapitalize'];
    autoComplete?: TextInputProps['autoComplete'];
    keyboardType?: TextInputProps['keyboardType'];
};

/**
 * Campo de formulario de las pantallas de acceso: etiqueta visible, control de
 * 56 px de alto con contorno de control de 2 px, y los mensajes pegados a él
 * (`11-acceso.html`, P1/P4/P7/P10). El error y la ayuda se enlazan con
 * `aria-describedby` y el error además marca `aria-invalid`, así que el lector
 * de pantalla lee por qué el campo está mal sin salir de él.
 */
export function AuthTextField({
    label,
    value,
    onChangeText,
    testID,
    accessibilityLabel,
    error,
    errorTestID,
    hint,
    hintIcon = 'info',
    off = false,
    password,
    inputRef,
    placeholder,
    autoCapitalize = 'none',
    autoComplete,
    keyboardType,
}: AuthTextFieldProps) {
    const errorId = `${testID}-error`;
    const hintId = `${testID}-hint`;
    const describedBy = [error ? errorId : null, hint ? hintId : null]
        .filter(Boolean)
        .join(' ');

    const fieldClassName = `${FIELD_BASE} ${
        error ? FIELD_INVALID : off ? FIELD_OFF : FIELD_IDLE
    }`;

    const sharedProps: TextInputProps = {
        testID,
        value,
        onChangeText,
        placeholder,
        placeholderTextColor: PLACEHOLDER_INK,
        className: fieldClassName,
        editable: !off,
        accessibilityLabel,
        accessibilityInvalid: !!error,
        accessibilityDescribedBy: describedBy || undefined,
        autoCapitalize,
        autoComplete,
        autoCorrect: false,
        keyboardType,
    };

    return (
        <View className="w-full">
            <Text className={LABEL}>{label}</Text>

            {password ? (
                <PasswordInput
                    {...sharedProps}
                    toggleMode={password.toggleMode ?? 'icon'}
                    inputRef={inputRef}
                />
            ) : (
                <TextInput {...sharedProps} ref={inputRef} />
            )}

            {error ? (
                <View className="mt-1.5 flex-row items-start gap-[7px]">
                    <AppIcon
                        name="alert-triangle"
                        size={19}
                        className="mt-0.5 text-danger"
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                    />
                    <Text
                        nativeID={errorId}
                        testID={errorTestID ?? errorId}
                        className="flex-1 text-[17px] font-sans-bold leading-[1.35] text-danger-dark"
                    >
                        {error}
                    </Text>
                </View>
            ) : null}

            {hint ? (
                <View className="mt-1.5 flex-row items-start gap-[7px]">
                    <AppIcon
                        name={hintIcon}
                        size={18}
                        className="mt-px text-ink-2"
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                    />
                    <Text
                        nativeID={hintId}
                        className="flex-1 text-[16px] font-sans leading-[1.35] text-ink-2"
                    >
                        {hint}
                    </Text>
                </View>
            ) : null}
        </View>
    );
}
