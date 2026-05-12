import React from 'react';
import { View } from 'react-native';

export function LinearGradient({
    children,
    style,
    ...rest
}: {
    children?: React.ReactNode;
    style?: object;
    colors?: readonly string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    [key: string]: unknown;
}) {
    return (
        <View style={style} {...rest}>
            {children}
        </View>
    );
}
