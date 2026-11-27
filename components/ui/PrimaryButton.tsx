import React from 'react';
import { Pressable, Text, View, ViewStyle, StyleProp, Platform, TextStyle } from 'react-native';
import { circleGlyphTextBase } from '@/lib/circle-glyph-styles';

/**
 * Botón primario: fondo `--primary` **plano**, sin degradado
 * (`design/rediseno-muro/sistema-nuevo.md` §10.1 y §11: el degradado
 * `primary → primary-container` restaba legibilidad al texto blanco en el tramo
 * claro; el plano garantiza 5,62:1 constante).
 *
 * El color va por clase (`bg-primary`, token #B93D12) y no por degradado porque
 * `expo-linear-gradient` no acepta un color plano; `View` sí pasa por
 * `cssInterop` de NativeWind.
 */

function isPlusOnlyChild(children: React.ReactNode): boolean {
    if (typeof children === 'string') return children.trim() === '+';
    if (Array.isArray(children)) {
        const flat = children.filter((c) => c != null && c !== false && c !== true);
        return flat.length === 1 && typeof flat[0] === 'string' && (flat[0] as string).trim() === '+';
    }
    return false;
}

const iconPlusCharStyle: TextStyle = {
    ...circleGlyphTextBase,
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
};

type PrimaryButtonProps = {
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    /** Cuadrado/circular pequeño (p. ej. w-12 h-12): sin padding fijo para centrar el icono. */
    variant?: 'default' | 'icon';
    className?: string;
    textClassName?: string;
    accessibilityLabel?: string;
    testID?: string;
    style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
    children,
    onPress,
    disabled,
    variant = 'default',
    className = '',
    textClassName = 'text-on-primary font-sans-bold text-xs uppercase tracking-widest',
    accessibilityLabel,
    testID,
    style,
}: PrimaryButtonProps) {
    const isIcon = variant === 'icon';
    const defaultGradientStyle: ViewStyle = {
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    };

    const iconFillGradientStyle: ViewStyle = {
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    };

    const isPlusIcon = isIcon && isPlusOnlyChild(children);

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
            accessibilityState={{ disabled: !!disabled }}
            testID={testID}
            className={`overflow-hidden active:opacity-90 ${disabled ? 'opacity-50' : ''} ${isIcon ? 'flex' : ''} rounded-full ${className}`}
            style={style}
        >
            {isIcon ? (
                <View style={{ flex: 1, alignSelf: 'stretch', width: '100%' }}>
                    <View
                        className="bg-primary"
                        style={iconFillGradientStyle}
                    >
                        {isPlusIcon ? (
                            <View
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    ...(Platform.OS === 'web'
                                        ? ({ display: 'flex', margin: 0, padding: 0 } as const)
                                        : null),
                                }}
                            >
                                <Text style={iconPlusCharStyle} className="font-sans-bold text-on-primary">
                                    {typeof children === 'string' ? children.trim() : '+'}
                                </Text>
                            </View>
                        ) : typeof children === 'string' ? (
                            <View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
                                <Text className={textClassName}>{children}</Text>
                            </View>
                        ) : (
                            children
                        )}
                    </View>
                </View>
            ) : (
                <View
                    className="bg-primary"
                    style={defaultGradientStyle}
                >
                    {typeof children === 'string' ? (
                        <Text className={textClassName}>{children}</Text>
                    ) : (
                        children
                    )}
                </View>
            )}
        </Pressable>
    );
}
