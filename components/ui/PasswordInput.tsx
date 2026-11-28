import React, { useState } from 'react';
import { Pressable, Text, TextInput, TextInputProps, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';

/**
 * Aire a la derecha del texto (en px, vía `style`) para que el ojo no lo tape.
 * Va en `style` y no en una clase `pr-…` a propósito: las pantallas pasan `p-4`
 * y el orden en que NativeWind emite `padding` y `padding-right` no es el del
 * atributo `class`, así que dos clases de relleno se pisan sin avisar. El estilo
 * en línea se aplica último y siempre gana.
 */
const TOGGLE_GUTTER = 56;

/**
 * Aire del «Mostrar» de texto, que ocupa más que el ojo (48 px de alto dentro
 * del campo de 56 y el ancho de la palabra): el artboard reserva 104 px
 * (`11 · .ac-input-pw`).
 */
const TEXT_TOGGLE_GUTTER = 96;

type PasswordInputProps = TextInputProps & {
    /** Test ID del ojo. Por defecto, `<testID del campo>-toggle`. */
    toggleTestID?: string;
    /**
     * Forma del control que descubre lo escrito (`11-acceso.html`):
     * - `icon` (por defecto): el ojo de siempre. El alta no cambia (S9).
     * - `text`: «Mostrar» / «Ocultar» subrayado, 48 px de alto dentro del campo
     *   de 56 (`.ac-show`), como el resto de controles de texto de la ficha.
     */
    toggleMode?: 'icon' | 'text';
    /** Ref al campo, para poder llevarle el foco al primer error del formulario. */
    inputRef?: React.Ref<TextInput>;
};

/**
 * Campo de contraseña: nace oculto y un control alterna entre texto plano y
 * puntos. La etiqueta accesible del control dice la ACCIÓN («Mostrar contraseña»
 * / «Ocultar contraseña»), así que quien usa lector de pantalla sabe qué hace sin
 * ver el icono ni el texto.
 *
 * El campo conserva su `testID`, de modo que los e2e que ya lo llenan siguen
 * funcionando sin tocarlos.
 */
export function PasswordInput({
    toggleTestID,
    toggleMode = 'icon',
    inputRef,
    testID,
    style,
    ...rest
}: PasswordInputProps) {
    const [visible, setVisible] = useState(false);
    const toggleLabel = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
    const toggleId = toggleTestID ?? (testID ? `${testID}-toggle` : undefined);
    const isTextToggle = toggleMode === 'text';

    return (
        <View className="relative justify-center">
            <TextInput
                {...rest}
                ref={inputRef}
                testID={testID}
                secureTextEntry={!visible}
                style={[style, { paddingRight: isTextToggle ? TEXT_TOGGLE_GUTTER : TOGGLE_GUTTER }]}
            />
            <Pressable
                onPress={() => setVisible((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={toggleLabel}
                testID={toggleId}
                className={
                    isTextToggle
                        ? 'absolute bottom-0 right-[5px] top-0 justify-center rounded-[12px] px-3 active:opacity-60'
                        : 'absolute bottom-0 right-0 top-0 justify-center px-4 active:opacity-60'
                }
            >
                {isTextToggle ? (
                    <Text className="text-[17px] font-sans-bold text-primary-dark underline">
                        {visible ? 'Ocultar' : 'Mostrar'}
                    </Text>
                ) : (
                    <AppIcon name={visible ? 'eye-off' : 'eye'} size={18} className="text-on-surface/70" />
                )}
            </Pressable>
        </View>
    );
}
