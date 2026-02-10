import React from 'react';
import { View, Text, Pressable, Image, Platform } from 'react-native';

// --- Types ---
export type Priority = 'low' | 'medium' | 'high';

export interface GiftItem {
    id: string;
    title: string;
    links: string[];
    imageUrl?: string;
    price?: string | number;
    notes?: string;
    priority: Priority;
    reservedBy?: string | null; // ID of the user who reserved it
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
    onDelete
}: WishlistCardProps) {
    const priorityColors = {
        low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
        high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
    };

    const priorityLabels = {
        low: 'Baja',
        medium: 'Media',
        high: 'Alta'
    };


    // --- Reservation Logic ---
    const isReservedByMe = !isOwner && item.reservedBy === currentUserId;
    const isReservedByOther = !isOwner && item.reservedBy && item.reservedBy !== currentUserId;
    const isAvailable = !isOwner && !item.reservedBy;

    // If owner, we ignore reservation state visually (privacy rule)

    const handlePress = () => {
        if (onClick) onClick(item);
    };

    return (
        <Pressable
            onPress={handlePress}
            className={`bg-white dark:bg-zinc-900 rounded-3xl border overflow-hidden transition-all flex-col h-full active:scale-[0.98]
                ${isReservedByMe
                    ? 'border-green-500 dark:border-green-500 shadow-lg shadow-green-500/10'
                    : 'border-zinc-100 dark:border-zinc-800 shadow-sm'}
            `}
        >
            {/* Imagen / Cover */}
            <View className="aspect-square w-full bg-zinc-50 dark:bg-zinc-800 relative items-center justify-center">
                {item.imageUrl ? (
                    <Image
                        source={{ uri: item.imageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                    />
                ) : (
                    <Text style={{ fontSize: 40 }} className="opacity-20">🎁</Text>
                )}

                {/* Badges superpuestos */}
                <View className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                    <View className={`px-2.5 py-1 rounded-full shadow-sm ${priorityColors[item.priority]}`}>
                        <Text className={`text-[11px] font-black uppercase tracking-wider ${priorityColors[item.priority].split(' ').pop()}`}>
                            Prioridad {priorityLabels[item.priority]}
                        </Text>
                    </View>
                </View>

                {/* Reservation Overlay (if reserved by other) */}
                {isReservedByOther && (
                    <View className="absolute inset-0 bg-black/60 backdrop-blur-[2px] items-center justify-center">
                        <View className="bg-white/90 dark:bg-zinc-900/90 px-4 py-2 rounded-2xl flex-row items-center shadow-lg">
                            <Text className="text-sm font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">
                                🔒 Reservado
                            </Text>
                        </View>
                    </View>
                )}

                {/* Reserved by me Badge */}
                {isReservedByMe && (
                    <View className="absolute top-3 left-3">
                        <View className="bg-green-500 px-3 py-1.5 rounded-full shadow-lg flex-row items-center">
                            <Text className="text-white text-[10px] font-black uppercase tracking-widest">
                                ✓ Reservado por ti
                            </Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Contenido */}
            <View className="p-5 flex-1">
                <Text className="font-bold text-zinc-900 dark:text-white text-base leading-tight mb-2" numberOfLines={2}>
                    {item.title}
                </Text>

                {item.notes && (
                    <Text className="text-xs text-zinc-400 dark:text-zinc-500 mb-4" numberOfLines={2}>
                        {item.notes}
                    </Text>
                )}

                <View className="mt-auto flex-row items-center justify-between">
                    <View className={`px-3 py-1.5 rounded-xl border ${item.price
                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20'
                        : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800'}`}>
                        <Text className={`text-xs font-black ${item.price ? 'text-amber-600' : 'text-zinc-400'}`}>
                            {item.price ? `${item.price} €` : 'Sin precio'}
                        </Text>
                    </View>

                    {item.links.length > 0 && (
                        <View className="bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/20">
                            <Text className="text-indigo-600 dark:text-indigo-400 text-xs font-black">
                                🔗 {item.links.length}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Owner Actions */}
                {isOwner && (
                    <Pressable
                        onPress={(e) => {
                            if (onDelete) onDelete(item);
                        }}
                        className="mt-5 pt-4 border-t border-zinc-50 dark:border-zinc-800 items-center justify-center flex-row active:opacity-60"
                    >
                        <Text className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mr-2">✓ Ya lo tengo</Text>
                    </Pressable>
                )}

                {/* Reservation Actions (Only for non-owners) */}
                {!isOwner && (
                    <View className="mt-5 pt-4 border-t border-zinc-50 dark:border-zinc-800">
                        {isAvailable && (
                            <Pressable
                                onPress={() => onReserve && onReserve(item)}
                                className="w-full py-3.5 bg-indigo-600 rounded-2xl items-center justify-center shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                            >
                                <Text className="text-white font-black text-xs uppercase tracking-widest">Reservar</Text>
                            </Pressable>
                        )}

                        {isReservedByMe && (
                            <Pressable
                                onPress={() => onCancelReserve && onCancelReserve(item)}
                                className="w-full py-3.5 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl items-center justify-center active:scale-[0.98]"
                            >
                                <Text className="text-zinc-400 font-black text-[10px] uppercase tracking-widest">Cancelar reserva</Text>
                            </Pressable>
                        )}

                        {isReservedByOther && (
                            <View className="w-full py-3.5 bg-zinc-50 dark:bg-zinc-800 rounded-2xl items-center justify-center opacity-50">
                                <Text className="text-zinc-400 font-black text-[10px] uppercase tracking-widest">No disponible</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </Pressable>
    );
}
