import React from 'react';
import { Text } from 'react-native';

/**
 * Mock del set Feather para jsdom: los unit tests no cargan la fuente real
 * (expo-font no existe en node), así que pintamos el nombre del glifo tal cual
 * con el estilo recibido — igual que haría el <Text> interno del paquete.
 * Cubre tanto la subruta `@expo/vector-icons/Feather` (default) como el
 * índice `@expo/vector-icons` (nominal `Feather`).
 */
export function Feather({
    name,
    size = 20,
    style,
    testID,
    accessibilityElementsHidden,
    importantForAccessibility,
    ...rest
}: {
    name?: string;
    size?: number;
    style?: object;
    testID?: string;
    accessibilityElementsHidden?: boolean;
    importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
    [key: string]: unknown;
}) {
    return (
        <Text
            style={[style, { fontSize: size }]}
            testID={testID}
            accessibilityElementsHidden={accessibilityElementsHidden}
            importantForAccessibility={importantForAccessibility}
            {...rest}
        >
            {name}
        </Text>
    );
}

export default Feather;
