import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { PrimaryButton } from './ui/PrimaryButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { WishLinkChip } from './WishLinkChip';
import { formatPrice } from '@/lib/format-price';
import { ReservationState } from '@/lib/wish-reservation';

export type Priority = 'low' | 'medium' | 'high';

export interface GiftItem {
    id: string;
    title: string;
    links: string[];
    imageUrl?: string;
    price?: number | null;
    notes?: string;
    priority: Priority;
    reservationState?: ReservationState;
    excludedGroupIds?: string[];
}

interface WishlistCardProps {
    item: GiftItem;
    onClick?: (item: GiftItem) => void;
    isOwner: boolean;
    onReserve?: (item: GiftItem) => void;
    onCancelReserve?: (item: GiftItem) => void;
    onDelete?: (item: GiftItem) => void;
}

export function WishlistCard({
    item,
    onClick,
    isOwner,
    onReserve,
    onCancelReserve,
    onDelete,
}: WishlistCardProps) {
    const priorityAccent = {
        low: 'bg-priority-low',
        medium: 'bg-priority-medium',
        high: 'bg-priority-high',
    };

    const priorityLabels = {
        low: 'Baja',
        medium: 'Media',
        high: 'Alta',
    };

    const reservationState = item.reservationState ?? 'available';
    const isReservedByMe = !isOwner && reservationState === 'reserved_by_me';
    const isReservedByOther = !isOwner && reservationState === 'reserved_by_other';
    const isAvailable = !isOwner && reservationState === 'available';
    const a11yPriceText = formatPrice(item.price);
    const priceText = a11yPriceText ? `${a11yPriceText} €` : null;

    const a11yReservation = isOwner
        ? undefined
        : isReservedByMe
          ? 'Reservado por ti'
          : isReservedByOther
            ? 'Reservado'
            : reservationState === 'unknown'
              ? 'Estado de reserva no disponible'
              : 'Disponible';

    // react-native-web **ignora** `accessibilityValue` en un `role="button"`, así
    // que el precio no llegaba al DOM: el dato accesible hay que llevarlo al
    // **nombre**, que sí se renderiza como `aria-label`. Se reutiliza `priceText`,
    // la misma expresión que pinta el texto visible, para que el «€» no pueda
    // divergir entre lo que se ve y lo que se oye.
    const a11yPrice = priceText ?? 'Sin precio';
    const a11yLabel = `${item.title}. Prioridad ${priorityLabels[item.priority]}. ${a11yPrice}${
        a11yReservation ? `. ${a11yReservation}.` : '.'
    }`;

    const handleOpenDetail = () => {
        if (onClick) onClick(item);
    };

    const cardShadow = isReservedByMe ? 'shadow-ambient-lg' : 'shadow-ambient';

    return (
        <View
            testID={`wishlist-card-${item.id}`}
            className={`bg-surface-container-lowest rounded-lg overflow-hidden flex-col h-full ${cardShadow} ${
                isReservedByMe ? 'ring-2 ring-outline-variant/20' : ''
            }`}
        >
            <Pressable
                onPress={handleOpenDetail}
                accessibilityRole="button"
                accessibilityLabel={a11yLabel}
                accessibilityHint="Abrir detalle del deseo"
                className="active:opacity-95"
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
                        <AppIcon name="gift" size={40} className="text-on-surface/70" />
                    )}

                    <View className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                        <View className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-container-lowest/92 shadow-ambient backdrop-blur-md ring-1 ring-outline-variant/15">
                            <View className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityAccent[item.priority]}`} />
                            <Text className="text-xs uppercase tracking-wider text-on-background font-sans-bold">
                                Prioridad {priorityLabels[item.priority]}
                            </Text>
                        </View>
                    </View>

                    {isReservedByOther ? (
                        <View className="absolute inset-0 bg-on-surface/45 items-center justify-center">
                            <View className="bg-surface/85 px-4 py-2 rounded-2xl flex-row items-center shadow-ambient-lg backdrop-blur-md">
                                <Text className="text-sm font-sans-bold text-on-surface uppercase tracking-widest">
                                    🔒 Reservado
                                </Text>
                            </View>
                        </View>
                    ) : null}

                    {isReservedByMe ? (
                        <View className="absolute top-3 left-3">
                            <View className="bg-reserved px-3 py-1.5 rounded-full shadow-ambient flex-row items-center">
                                <View className="flex-row items-center gap-1">
                                    {/* El check comparte el color y el tamaño (text-xs = 12) de
                                        la etiqueta del chip de reserva: misma fila, misma caja.
                                        `gap-1` reproduce el espacio que el glifo ✓ llevaba
                                        dentro del propio texto (medido: sin él la separación
                                        era de 0px). */}
                                    <AppIcon name="check" size={12} className="text-surface-container-lowest" />
                                    <Text className="text-surface-container-lowest text-xs font-sans-bold uppercase tracking-widest">
                                        Reservado por ti
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ) : null}
                </View>

                <View className="p-5">
                    <Text
                        className="font-sans-bold text-on-background text-base leading-tight mb-4"
                        // 3 y no 2: a 360px la tarjeta da ~116px de ancho de texto y un
                        // título real como «Auriculares Sony WH-1000XM5» necesita 3
                        // líneas (scrollHeight 60 vs clientHeight 40 medidos), así que
                        // con 2 se cortaba el contenido del propio usuario.
                        numberOfLines={3}
                    >
                        {item.title}
                    </Text>

                    {item.notes ? (
                        <Text className="text-xs text-on-surface/70 font-sans mb-4" numberOfLines={2}>
                            {item.notes}
                        </Text>
                    ) : null}

                    {/* El precio **no cede**: es el dato que tiene que verse entero, y hasta
                        ahora se elidía porque los dos chips podían encoger (regla C4 de
                        `ui-polish`). Ahora el que cede es el enlace, y la fila **envuelve**:
                        si no caben juntos, el enlace baja a una segunda línea en vez de
                        recortar el precio. La garantía anti-desborde se mantiene
                        envolviendo, no encogiendo el dato. */}
                    <View className="flex-row flex-wrap items-center justify-between gap-2">
                        <View
                            testID={`wish-price-${item.id}`}
                            className={`shrink-0 px-3 py-1.5 rounded-xl ${
                                item.price ? 'bg-price/12' : 'bg-surface-container-low'
                            }`}
                        >
                            <Text
                                numberOfLines={1}
                                className={`text-sm font-sans-bold ${item.price ? 'text-price' : 'text-on-surface/70'}`}
                            >
                                {priceText ?? 'Sin precio'}
                            </Text>
                        </View>

                        {item.links[0] ? (
                            <WishLinkChip url={item.links[0]} testID={`wish-link-${item.id}`} />
                        ) : null}
                    </View>
                </View>
            </Pressable>

            {isOwner ? (
                <View className="px-5 pb-5 pt-0">
                    {/* Era un `Pressable` **sin superficie**, así que parecía un enlace.
                        Ahora usa la MISMA forma que el botón secundario de la app
                        («Cancelar reserva»): eso es lo que le da la affordance. El verde
                        del check y de la etiqueta se conserva porque la acción es
                        positiva (ya lo tengo → sale de la lista); quien dice «esto se
                        pulsa» es la forma, no el color. */}
                    <Pressable
                        testID="wish-already-have"
                        onPress={() => {
                            if (onDelete) onDelete(item);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Marcar como ya lo tengo"
                        className="min-h-[44px] w-full rounded-full bg-surface-container-high ring-1 ring-outline-variant/15 items-center justify-center flex-row px-4 active:opacity-80"
                    >
                        <View className="flex-row items-center gap-1.5">
                            {/* El check comparte color (`text-success`) con la etiqueta y va un
                                punto más grande que antes (12 → 14): ahora es el icono de un
                                botón, no el adorno de un enlace. */}
                            <AppIcon name="check" size={14} className="text-success" />
                            <Text
                                // tracking-[0.2em] a 12px en mayúsculas sumaba ~31px de ancho
                                // sobre 13 caracteres y partía la etiqueta en dos líneas a
                                // 360px. A 0.05em cabe en una sola y conserva el aire.
                                className="text-xs font-sans-bold text-success uppercase tracking-[0.05em]"
                            >
                                Ya lo tengo
                            </Text>
                        </View>
                    </Pressable>
                </View>
            ) : null}

            {!isOwner ? (
                <View className="px-5 pb-5 pt-0 gap-3">
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
                            testID="wish-cancel-reserve-button"
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
                                No disponible
                            </Text>
                        </View>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}
