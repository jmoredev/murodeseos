import React from 'react';
import { View } from 'react-native';

type GlassBarProps = {
    children: React.ReactNode;
    className?: string;
};

export function GlassBar({ children, className = '' }: GlassBarProps) {
    return (
        <View
            className={`bg-surface/80 backdrop-blur-xl shadow-ambient-lg ${className}`}
        >
            {children}
        </View>
    );
}
