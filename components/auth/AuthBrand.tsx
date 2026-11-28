import React from 'react';
import { Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';

/**
 * Marca de la app en las pantallas de acceso (`11 · .ac-mark`): el regalo sobre
 * su teja y el nombre con la explicación corta. En el navegador la sustituye la
 * cabecera del artboard, que lleva el mismo nombre.
 */
export function AuthBrand() {
    return (
        <View className="mb-4 mt-1.5 flex-row items-center gap-2.5">
            <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-primary-soft">
                <AppIcon name="gift" size={24} className="text-primary-dark" />
            </View>
            <View className="flex-1">
                <Text className="text-[18px] font-sans-bold leading-[1.2] tracking-[-0.01em] text-ink">
                    Muro de Deseos
                </Text>
                <Text className="text-[15px] font-sans leading-[1.2] text-ink-2">
                    Listas de deseos compartidas
                </Text>
            </View>
        </View>
    );
}
