import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { PrimaryButton } from './ui/PrimaryButton';
import { WishLinkChip } from './WishLinkChip';

export type Priority = 'low' | 'medium' | 'high';

export interface GiftItem {
    id: string;
    title: string;
    links: string[];
    imageUrl?: string;
    price?: string | number;
    notes?: string;
    priority: Priority;
    reservedBy?: string | null;
    excludedGroupIds?: string[];
}

interface WishlistCardProps {
    item: GiftItem;
    onClick?: (item: GiftItem) => void;
    isOwner: boolean;
    currentUserId?: string;
    onReserve?: (item: GiftItem) => void;
    onCancelReserve?: (item: GiftItem) => void;
    onDelete?: (item: GiftItem) => void;
}

export function WishlistCard({
    item,
    onClick,
    isOwner,
    currentUserId,
    onReserve,
    onCancelReserve,
    onDelete,
}: WishlistCardProps) {
    /** Indicador de categoría (solo el punto); el texto va siempre sobre superficie clara para contraste sobre la foto. */
    const priorityAccent = {
        low: 'bg-tertiary',
        medium: 'bg-secondary',
        high: 'bg-primary',
    };

    const priorityLabels = {
        low: 'Baja',
        medium: 'Media',
        high: 'Alta',
    };

    const isReservedByMe = !isOwner && item.reservedBy === currentUserId;
    const isReservedByOther = !isOwner && item.reservedBy && item.reservedBy !== currentUserId;
    const isAvailable = !isOwner && !item.reservedBy;

    const a11yReservation = isOwner
        ? undefined
        : isReservedByMe
          ? 'Reservado por ti'
          : isReservedByOther
            ? 'Reservado'
            : 'Disponible';

    const a11yPrice = item.price ? `${item.price} €` : 'Sin precio';

    const handlePress = () => {
        if (onClick) onClick(item);
    };

    const cardShadow = isReservedByMe ? 'shadow-ambient-lg' : 'shadow-ambient';

    return (
        <Pressable
            testID={`wishlist-card-${item.id}`}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint="Abrir detalle del deseo"
            accessibilityValue={{
                text: `Prioridad ${priorityLabels[item.priority]}. ${a11yPrice}${a11yReservation ? `. ${a11yReservation}.` : '.'}`,
            }}
            className={`bg-surface-container-lowest rounded-lg overflow-hidden flex-col h-full active:scale-[0.98] ${cardShadow} ${
                isReservedByMe ? 'ring-2 ring-outline-variant/20' : ''
            }`}
        >
            <View className="aspect-square w-full bg-surface-container-low relative items-center justify-center">
                {item.imageUrl ? (
                    <Image
                        source={{ uri: item.imageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                    />
                ) : (
                    <Text style={{ fontSize: 40 }} className="text-on-surface/20">
                        🎁
                    </Text>
                )}

                <View className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                    <View className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-container-lowest/92 shadow-ambient backdrop-blur-md ring-1 ring-outline-variant/15">
                        <View className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityAccent[item.priority]}`} />
                        <Text className="text-[11px] uppercase tracking-wider text-on-background font-sans-bold">
                            Prioridad {priorityLabels[item.priority]}
                        </Text>
                    </View>
                </View>

                {isReservedByOther && (
                    <View className="absolute inset-0 bg-on-surface/45 items-center justify-center">
                        <View className="bg-surface/85 px-4 py-2 rounded-2xl flex-row items-center shadow-ambient-lg backdrop-blur-md">
                            <Text className="text-sm font-sans-bold text-on-surface uppercase tracking-widest">
                                🔒 Reservado
                            </Text>
                        </View>
                    </View>
                )}

                {isReservedByMe && (
                    <View className="absolute top-3 left-3">
                        <View className="bg-tertiary px-3 py-1.5 rounded-full shadow-ambient flex-row items-center">
                            <Text className="text-surface-container-lowest text-[10px] font-sans-bold uppercase tracking-widest">
                                ✓ Reservado por ti
                            </Text>
                        </View>
                    </View>
                )}
            </View>

            <View className="p-5 flex-1">
                <Text className="font-sans-bold text-on-background text-base leading-tight mb-4" numberOfLines={2}>
                    {item.title}
                </Text>

                {item.notes ? (
                    <Text className="text-xs text-on-surface/55 font-sans mb-4" numberOfLines={2}>
                        {item.notes}
                    </Text>
                ) : null}

                <View className="mt-auto flex-row items-center justify-between gap-2">
                    <View
                        className={`px-3 py-1.5 rounded-xl ${
                            item.price ? 'bg-secondary/12' : 'bg-surface-container-low'
                        }`}
                    >
                        <Text
                            className={`text-xs font-sans-bold ${item.price ? 'text-secondary' : 'text-on-surface/45'}`}
                        >
                            {item.price ? `${item.price} €` : 'Sin precio'}
                        </Text>
                    </View>

                    {item.links[0] ? (
                        <WishLinkChip url={item.links[0]} testID={`wish-link-${item.id}`} />
                    ) : null}
                </View>

                {isOwner ? (
                    <Pressable
                        testID="wish-already-have"
                        onPress={() => {
                            if (onDelete) onDelete(item);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Marcar como ya lo tengo"
                        className="mt-6 pt-4 items-center justify-center flex-row active:opacity-60"
                    >
                        <Text className="text-[10px] font-sans-bold text-tertiary uppercase tracking-[0.2em]">
                            ✓ Ya lo tengo
                        </Text>
                    </Pressable>
                ) : null}

                {!isOwner ? (
                    <View className="mt-6 pt-4 gap-3">
                        {isAvailable && onReserve ? (
                            <PrimaryButton
                                testID="wish-reserve-button"
                                onPress={() => onReserve(item)}
                                accessibilityLabel="Reservar deseo"
                                className="w-full"
                            >
                                Reservar
                            </PrimaryButton>
                        ) : null}

                        {isReservedByMe && onCancelReserve ? (
                            <Pressable
                                onPress={() => onCancelReserve(item)}
                                accessibilityRole="button"
                                accessibilityLabel="Cancelar reserva"
                                className="w-full py-3.5 bg-surface-container-high rounded-full items-center justify-center active:opacity-80"
                            >
                                <Text className="text-on-surface/55 font-sans-bold text-[10px] uppercase tracking-widest">
                                    Cancelar reserva
                                </Text>
                            </Pressable>
                        ) : null}

                        {isReservedByOther ? (
                            <View className="w-full py-3.5 bg-surface-container-low rounded-full items-center justify-center opacity-70">
                                <Text className="text-on-surface/45 font-sans-bold text-[10px] uppercase tracking-widest">
                                    No disponible
                                </Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}
            </View>
        </Pressable>
    );
}
