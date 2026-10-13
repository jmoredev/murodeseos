import React from 'react';
import { Pressable, Text, type GestureResponderEvent } from 'react-native';
import { openWishLink, truncateWishLink, wishLinkHost } from '@/lib/wish-link-utils';
import { AppIcon } from './ui/AppIcon';
import { useToast } from './Toast';

type WishLinkChipProps = {
    url: string;
    /** Tarjeta compacta en grid; fila ancha en modal de detalle. */
    variant?: 'chip' | 'row';
    testID?: string;
};

/**
 * El enlace, como **botón**.
 *
 * Antes era un chip de texto diminuto (`🔗 host/ruta` a 12px, recortado a una
 * línea). Dos cosas se arreglan aquí: el icono pasa a `AppIcon` —en este
 * repositorio la familia de iconos entra **solo** por ahí, para no depender de la
 * fuente de emoji de cada plataforma— y el texto deja de ser la URL.
 *
 * Lo que se pinta depende del ancho que hay: en la tarjeta, **solo el dominio**
 * (`amazon.es`, 8-15 caracteres, que cabe sin recortarse); en la fila ancha del
 * modal, el dominio con su ruta. La URL completa no se muestra nunca, y el nombre
 * accesible sí lleva el enlace reconocible para quien lo escucha.
 */
export function WishLinkChip({ url, variant = 'chip', testID }: WishLinkChipProps) {
    const isRow = variant === 'row';
    const visibleLabel = isRow ? truncateWishLink(url) : wishLinkHost(url);
    const a11yLabel = `Abrir enlace: ${truncateWishLink(url)}`;
    // `openWishLink` solo informa del fallo; el brindis se pinta aquí, en la vista,
    // porque el módulo no puede usar hooks. Debe existir en ambas variantes: el
    // chip y la fila hacen `return` temprano, así que se renderiza junto a cada uno.
    const { showToast, ToastComponent } = useToast();

    const handlePress = async (event: GestureResponderEvent) => {
        event.stopPropagation?.();
        const result = await openWishLink(url);
        if (!result.ok) showToast(result.message, 'error');
    };

    if (isRow) {
        return (
            <>
                <Pressable
                    testID={testID}
                    onPress={handlePress}
                    accessibilityRole="link"
                    accessibilityLabel={a11yLabel}
                    className="mb-2 min-h-[44px] px-4 py-3 rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/15 active:opacity-80 flex-row items-center gap-2"
                >
                    <AppIcon name="external-link" size={16} className="text-primary shrink-0" />
                    <Text
                        className="text-primary font-sans-bold text-sm flex-1 min-w-0"
                        numberOfLines={1}
                    >
                        {visibleLabel}
                    </Text>
                </Pressable>
                {ToastComponent}
            </>
        );
    }

    // En la tarjeta el chip mantiene `min-w-0 shrink`: **el que cede es el enlace,
    // nunca el precio**, y la altura la fija el objetivo táctil de 44px. La elipsis del
    // CSS ya no debería hacer falta, porque `wishLinkHost` recorta el dominio antes (con
    // puntos suspensivos explícitos y probados); se deja como última red.
    return (
        <>
            <Pressable
                testID={testID}
                onPress={handlePress}
                accessibilityRole="link"
                accessibilityLabel={a11yLabel}
                className="min-w-0 shrink min-h-[44px] px-3 py-2 rounded-xl bg-surface-container-low ring-1 ring-outline-variant/15 active:opacity-80 flex-row items-center gap-1.5"
            >
                <AppIcon name="external-link" size={14} className="text-primary shrink-0" />
                <Text className="text-primary text-xs font-sans-bold" numberOfLines={1}>
                    {visibleLabel}
                </Text>
            </Pressable>
            {ToastComponent}
        </>
    );
}
