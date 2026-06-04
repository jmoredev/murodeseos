import React, { useEffect } from 'react';
import {
    View,
    Text,
    Pressable,
    Modal,
    ScrollView,
    Image,
    useWindowDimensions,
    BackHandler,
    Platform,
} from 'react-native';
import { GiftItem, Priority } from './WishlistCard';
import { PrimaryButton } from './ui/PrimaryButton';
import { WishLinkChip } from './WishLinkChip';

interface WishDetailModalProps {
    visible: boolean;
    item: GiftItem | null;
    onClose: () => void;
    isOwner: boolean;
    currentUserId?: string;
    onReserve?: (item: GiftItem) => void;
    onCancelReserve?: (item: GiftItem) => void;
}

const priorityLabels: Record<Priority, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
};

const priorityAccent: Record<Priority, string> = {
    low: 'text-tertiary',
    medium: 'text-secondary',
    high: 'text-primary',
};

export function WishDetailModal({
    visible,
    item,
    onClose,
    isOwner,
    currentUserId,
    onReserve,
    onCancelReserve,
}: WishDetailModalProps) {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;

    useEffect(() => {
        if (!visible || isDesktop) return undefined;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            onClose();
            return true;
        });
        return () => sub.remove();
    }, [visible, isDesktop, onClose]);

    if (!item) return null;

    const isReservedByMe = !isOwner && item.reservedBy === currentUserId;
    const isReservedByOther = !isOwner && item.reservedBy && item.reservedBy !== currentUserId;
    const isAvailable = !isOwner && !item.reservedBy;

    const content = (
        <>
            <View className="items-center py-4">
                <View className="w-12 h-1.5 bg-outline-variant/30 rounded-full" />
            </View>

            <View className="px-6 flex-row justify-between items-center mb-4">
                <Text
                    testID="wish-detail-title"
                    className="text-2xl font-display text-on-background flex-1 pr-4"
                    numberOfLines={2}
                >
                    {item.title}
                </Text>
                <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar detalle"
                    className="w-10 h-10 rounded-full bg-surface-container-low items-center justify-center shrink-0"
                >
                    <Text className="text-on-surface/55 font-sans-bold">✕</Text>
                </Pressable>
            </View>

            <ScrollView className="px-6" keyboardShouldPersistTaps="handled">
                <View className="aspect-square w-full bg-surface-container-low rounded-2xl overflow-hidden mb-6 items-center justify-center">
                    {item.imageUrl ? (
                        <Image
                            source={{ uri: item.imageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                            accessibilityLabel={`Imagen de ${item.title}`}
                        />
                    ) : (
                        <Text style={{ fontSize: 64 }} className="text-on-surface/20">
                            🎁
                        </Text>
                    )}
                </View>

                <View className="flex-row flex-wrap gap-3 mb-6">
                    <View className="px-4 py-2 rounded-full bg-surface-container-low">
                        <Text className={`text-xs font-sans-bold uppercase tracking-wider ${priorityAccent[item.priority]}`}>
                            Prioridad {priorityLabels[item.priority]}
                        </Text>
                    </View>
                    <View className={`px-4 py-2 rounded-full ${item.price ? 'bg-secondary/12' : 'bg-surface-container-low'}`}>
                        <Text className={`text-xs font-sans-bold ${item.price ? 'text-secondary' : 'text-on-surface/45'}`}>
                            {item.price ? `${item.price} €` : 'Sin precio'}
                        </Text>
                    </View>
                </View>

                {item.notes ? (
                    <View className="mb-6">
                        <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">
                            Notas
                        </Text>
                        <Text className="text-on-background font-sans leading-relaxed">{item.notes}</Text>
                    </View>
                ) : null}

                {item.links.length > 0 ? (
                    <View className="mb-6">
                        <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-3">
                            Enlaces
                        </Text>
                        {item.links.map((link, index) => (
                            <WishLinkChip
                                key={`${link}-${index}`}
                                url={link}
                                variant="row"
                                testID={`wish-detail-link-${index}`}
                            />
                        ))}
                    </View>
                ) : null}

                {!isOwner ? (
                    <View className="gap-3 mb-8">
                        {isAvailable && onReserve ? (
                            <PrimaryButton
                                testID="wish-detail-reserve-button"
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
                                    Reservado por otro usuario
                                </Text>
                            </View>
                        ) : null}
                    </View>
                ) : (
                    <View className="mb-8" />
                )}
            </ScrollView>
        </>
    );

    return (
        <Modal
            visible={visible}
            animationType={isDesktop ? 'fade' : 'slide'}
            transparent
            onRequestClose={onClose}
            testID="wish-detail-modal"
        >
            <View
                className={`flex-1 ${isDesktop ? 'justify-center items-center px-4 bg-on-surface/40' : 'justify-end bg-on-surface/40'}`}
            >
                {isDesktop ? (
                    <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Cerrar" />
                ) : null}

                <View
                    className={
                        isDesktop
                            ? 'relative z-10 w-full max-w-lg max-h-[90vh] bg-surface-container-lowest rounded-3xl shadow-ambient-lg overflow-hidden'
                            : 'bg-surface/95 backdrop-blur-xl rounded-t-[40px] max-h-[90%] pb-6'
                    }
                    style={Platform.OS === 'web' && isDesktop ? { maxHeight: '90vh' } : undefined}
                >
                    {content}
                </View>
            </View>
        </Modal>
    );
}
