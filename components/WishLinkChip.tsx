import React from 'react';
import { Pressable, Text, type GestureResponderEvent } from 'react-native';
import { openWishLink, truncateWishLink } from '@/lib/wish-link-utils';
import { useToast } from './Toast';

type WishLinkChipProps = {
    url: string;
    /** Tarjeta compacta en grid; fila ancha en modal de detalle. */
    variant?: 'chip' | 'row';
    testID?: string;
};

export function WishLinkChip({ url, variant = 'chip', testID }: WishLinkChipProps) {
    const label = truncateWishLink(url);
    // `openWishLink` solo informa del fallo; el brindis se pinta aquí, en la vista,
    // porque el módulo no puede usar hooks. Debe existir en ambas variantes: el
    // chip y la fila hacen `return` temprano, así que se renderiza junto a cada uno.
    const { showToast, ToastComponent } = useToast();

    const handlePress = async (event: GestureResponderEvent) => {
        event.stopPropagation?.();
        const result = await openWishLink(url);
        if (!result.ok) showToast(result.message, 'error');
    };

    if (variant === 'row') {
        return (
            <>
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
                {ToastComponent}
            </>
        );
    }

    {/* C4: `min-w-0 shrink` — el chip puede encoger (la altura la fija
        `min-h-[44px]`, intacta como objetivo táctil) y el texto recorta
        con ellipsis en vez de desbordar la fila a 360px. */}
    return (
        <>
            <Pressable
                testID={testID}
                onPress={handlePress}
                accessibilityRole="link"
                accessibilityLabel={`Abrir enlace: ${label}`}
                className="min-w-0 shrink max-w-[55%] min-h-[44px] px-2.5 py-1.5 rounded-xl bg-surface-container-low active:opacity-80 justify-center"
            >
                <Text className="text-primary text-xs font-sans-bold" numberOfLines={1}>
                    🔗 {label}
                </Text>
            </Pressable>
            {ToastComponent}
        </>
    );
}
