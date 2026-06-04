import React from 'react';
import { Pressable, Text, type GestureResponderEvent } from 'react-native';
import { openWishLink, truncateWishLink } from '@/lib/wish-link-utils';

type WishLinkChipProps = {
    url: string;
    /** Tarjeta compacta en grid; fila ancha en modal de detalle. */
    variant?: 'chip' | 'row';
    testID?: string;
};

export function WishLinkChip({ url, variant = 'chip', testID }: WishLinkChipProps) {
    const label = truncateWishLink(url);

    const handlePress = (event: GestureResponderEvent) => {
        event.stopPropagation?.();
        void openWishLink(url);
    };

    if (variant === 'row') {
        return (
            <Pressable
                testID={testID}
                onPress={handlePress}
                accessibilityRole="link"
                accessibilityLabel={`Abrir enlace: ${label}`}
                className="mb-2 px-4 py-3 rounded-2xl bg-surface-container-low active:opacity-80"
            >
                <Text className="text-primary font-sans-bold text-sm" numberOfLines={1}>
                    🔗 {label}
                </Text>
            </Pressable>
        );
    }

    return (
        <Pressable
            testID={testID}
            onPress={handlePress}
            accessibilityRole="link"
            accessibilityLabel={`Abrir enlace: ${label}`}
            className="max-w-[55%] px-2.5 py-1.5 rounded-xl bg-surface-container-low active:opacity-80"
        >
            <Text className="text-primary text-xs font-sans-bold" numberOfLines={1}>
                🔗 {label}
            </Text>
        </Pressable>
    );
}
