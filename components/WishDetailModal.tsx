import React, { useEffect } from 'react';
import {
    View,
    Text,
    Pressable,
    Modal,
    ScrollView,
    Image,
    BackHandler,
    Platform,
} from 'react-native';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { useBackToClose } from '@/lib/use-back-to-close';
import { GiftItem, Priority } from './WishlistCard';
import { PrimaryButton } from './ui/PrimaryButton';
import { WishLinkChip } from './WishLinkChip';
import { AppIcon } from '@/components/ui/AppIcon';
import { formatPrice } from '@/lib/format-price';

interface WishDetailModalProps {
    visible: boolean;
    item: GiftItem | null;
    onClose: () => void;
    isOwner: boolean;
    onReserve?: (item: GiftItem) => void;
    onCancelReserve?: (item: GiftItem) => void;
}

const priorityLabels: Record<Priority, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
};

const priorityAccent: Record<Priority, string> = {
    low: 'text-priority-low',
    medium: 'text-priority-medium',
    high: 'text-priority-high',
};

export function WishDetailModal({
    visible,
    item,
    onClose,
    isOwner,
    onReserve,
    onCancelReserve,
}: WishDetailModalProps) {
    const isDesktop = useIsDesktop();

    useEffect(() => {
        // `BackHandler` no existe en web: RNW ignora (y registra error en consola).
        if (Platform.OS === 'web' || !visible || isDesktop) return undefined;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            onClose();
            return true;
        });
        return () => sub.remove();
    }, [visible, isDesktop, onClose]);

    // Web: el gesto de atrás cierra el detalle en vez de salir de la aplicación
    // (en web no hay `BackHandler`, así que el gesto es historial del navegador).
    useBackToClose(visible, onClose);

    if (!item) return null;

    // Se calcula una vez: con el precio ya numérico, un `0` es un precio y `0,00`
    // tiene que pintarse, no caer en «Sin precio» como hacía la comprobación de
    // veracidad sobre el número.
    const priceText = formatPrice(item.price);

    const reservationState = item.reservationState ?? 'available';
    const isReservedByMe = !isOwner && reservationState === 'reserved_by_me';
    const isReservedByOther = !isOwner && reservationState === 'reserved_by_other';
    const isAvailable = !isOwner && reservationState === 'available';

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
                    className="w-11 h-11 rounded-full bg-surface-container-low items-center justify-center shrink-0"
                >
                    {/* Mantiene el tamaño de glifo que la X del modal reemplaza:
                        la caja de 44 y el centrado no cambian. */}
                    <AppIcon name="x" size={16} className="text-on-surface/70" />
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
                        <AppIcon name="gift" size={64} className="text-on-surface/70" />
                    )}
                </View>

                <View className="flex-row flex-wrap gap-3 mb-6">
                    <View className="px-4 py-2 rounded-full bg-surface-container-low">
                        <Text className={`text-xs font-sans-bold uppercase tracking-wider ${priorityAccent[item.priority]}`}>
                            Prioridad {priorityLabels[item.priority]}
                        </Text>
                    </View>
                    <View className={`px-4 py-2 rounded-full ${priceText ? 'bg-price/12' : 'bg-surface-container-low'}`}>
                        <Text className={`text-xs font-sans-bold ${priceText ? 'text-price' : 'text-on-surface/70'}`}>
                            {priceText ? `${priceText} €` : 'Sin precio'}
                        </Text>
                    </View>
                </View>

                {item.notes ? (
                    <View className="mb-6">
                        <Text className="text-xs font-sans-bold text-on-surface/70 uppercase tracking-widest mb-2">
                            Notas
                        </Text>
                        <Text className="text-on-background font-sans leading-relaxed">{item.notes}</Text>
                    </View>
                ) : null}

                {item.links.length > 0 ? (
                    <View className="mb-6">
                        <Text className="text-xs font-sans-bold text-on-surface/70 uppercase tracking-widest mb-3">
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
                                <Text className="text-on-surface/70 font-sans-bold text-xs uppercase tracking-widest">
                                    Cancelar reserva
                                </Text>
                            </Pressable>
                        ) : null}

                        {isReservedByOther ? (
                            <View className="w-full py-3.5 bg-surface-container-low rounded-full items-center justify-center opacity-70">
                                <Text className="text-on-surface/70 font-sans-bold text-xs uppercase tracking-widest">
                                    Reservado por otro usuario
                                </Text>
                            </View>
                        ) : null}

                        {reservationState === 'unknown' ? (
                            <View className="w-full py-3.5 bg-surface-container-low rounded-full items-center justify-center opacity-70">
                                <Text className="text-on-surface/70 font-sans-bold text-xs uppercase tracking-widest">
                                    Estado de reserva no disponible
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
                            : 'bg-surface/95 backdrop-blur-xl rounded-t-[40px] max-h-[90%]'
                    }
                    style={
                        isDesktop
                            ? { maxHeight: '90dvh' as any } // fallback: la clase queda en `max-h-[90vh]`
                            : {
                                  // Antes `pb-6` (24px) no cubría la barra de inicio de un iPhone
                                  // (~34px). En escritorio `env()` = 0px → 1.5rem, el valor de hoy.
                                  // Cast `as any`: calc CSS de RNW fuera de `DimensionValue`.
                                  paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' as any,
                              }
                    }
                >
                    {content}
                </View>
            </View>
        </Modal>
    );
}
