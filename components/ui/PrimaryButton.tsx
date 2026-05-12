import React from 'react';
import { Pressable, Text, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const GRADIENT = ['#aa2c32', '#ff7574'] as const;

type PrimaryButtonProps = {
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
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
    className = '',
    textClassName = 'text-on-primary font-sans-bold text-xs uppercase tracking-widest',
    accessibilityLabel,
    testID,
    style,
}: PrimaryButtonProps) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
            accessibilityState={{ disabled: !!disabled }}
            testID={testID}
            className={`overflow-hidden active:opacity-90 ${disabled ? 'opacity-50' : ''} rounded-full ${className}`}
            style={style}
        >
            <LinearGradient
                colors={[...GRADIENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', width: '100%' }}
            >
                {typeof children === 'string' ? (
                    <Text className={textClassName}>{children}</Text>
                ) : (
                    children
                )}
            </LinearGradient>
        </Pressable>
    );
}
