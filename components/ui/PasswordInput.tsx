import React, { useState } from 'react';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';

/**
 * Aire a la derecha del texto (en px, vía `style`) para que el ojo no lo tape.
 * Va en `style` y no en una clase `pr-…` a propósito: las pantallas pasan `p-4`
 * y el orden en que NativeWind emite `padding` y `padding-right` no es el del
 * atributo `class`, así que dos clases de relleno se pisan sin avisar. El estilo
 * en línea se aplica último y siempre gana.
 */
const TOGGLE_GUTTER = 56;

type PasswordInputProps = TextInputProps & {
    /** Test ID del ojo. Por defecto, `<testID del campo>-toggle`. */
    toggleTestID?: string;
};

/**
 * Campo de contraseña con el ojo de siempre: nace oculto y el botón alterna
 * entre texto plano y puntos. La etiqueta accesible del botón dice la ACCIÓN
 * («Mostrar contraseña» / «Ocultar contraseña»), así que quien usa lector de
 * pantalla sabe qué hace sin ver el icono.
 *
 * El campo conserva su `testID`, de modo que los e2e que ya lo llenan siguen
 * funcionando sin tocarlos.
 */
export function PasswordInput({ toggleTestID, testID, style, ...rest }: PasswordInputProps) {
    const [visible, setVisible] = useState(false);
    const toggleLabel = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
    const toggleId = toggleTestID ?? (testID ? `${testID}-toggle` : undefined);

    return (
        <View className="relative justify-center">
            <TextInput
                {...rest}
                testID={testID}
                secureTextEntry={!visible}
                style={[style, { paddingRight: TOGGLE_GUTTER }]}
            />
            <Pressable
                onPress={() => setVisible((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={toggleLabel}
                testID={toggleId}
                className="absolute right-0 top-0 bottom-0 justify-center px-4 active:opacity-60"
            >
                <AppIcon name={visible ? 'eye-off' : 'eye'} size={18} className="text-on-surface/70" />
            </Pressable>
        </View>
    );
}
