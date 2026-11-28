import { Stack, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';

/**
 * Página no encontrada (12 · P6).
 *
 * Dice qué pasa, da **dos** salidas —Inicio y Mi lista— y explica la causa más frecuente de acabar
 * aquí: un enlace de invitación mal copiado. No deja al usuario con el botón de atrás como única
 * salida.
 *
 * Antes esta pantalla decía «Esta página no existe.» y ofrecía un solo enlace; la copy y la forma
 * son las del artboard y los destinos no cambian: `/` y `/?tab=wishlist`.
 */
export default function NotFoundScreen() {
    const router = useRouter();

    return (
        <>
            <Stack.Screen options={{ title: 'Página no encontrada' }} />
            <View className="flex-1 items-center justify-center bg-surface px-[26px] pb-[30px]">
                <View
                    aria-hidden
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    className="h-[76px] w-[76px] items-center justify-center rounded-[24px] bg-sand shadow-sh-1"
                >
                    <AppIcon name="help-circle" size={38} className="text-sand-ink" />
                </View>

                <Text className="mt-[18px] text-center font-display-extrabold text-[26px] leading-[1.15] tracking-[-0.02em] text-ink">
                    Página no encontrada
                </Text>
                <Text className="mt-2 max-w-[306px] text-center text-[17px] leading-[1.45] text-ink-2">
                    Esta dirección no existe o ha dejado de existir. Si vienes de un enlace, puede que esté
                    mal copiado.
                </Text>

                <View className="mt-[22px] w-full max-w-[306px] gap-2.5">
                    <Pressable
                        onPress={() => router.push('/')}
                        accessibilityRole="button"
                        accessibilityLabel="Ir a Inicio"
                        className="min-h-[48px] items-center justify-center rounded-full bg-primary px-5 py-2.5 shadow-sh-cta active:bg-primary-dark"
                    >
                        <Text className="font-display-extrabold text-[17px] leading-[1.25] text-on-primary">
                            Ir a Inicio
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => router.push({ pathname: '/', params: { tab: 'wishlist' } })}
                        accessibilityRole="button"
                        accessibilityLabel="Abrir Mi lista"
                        className="min-h-[48px] items-center justify-center rounded-full border-2 border-border-strong bg-surface-container-lowest px-5 py-2.5 active:bg-hover-control"
                    >
                        <Text className="font-display-extrabold text-[17px] leading-[1.25] text-ink">
                            Abrir Mi lista
                        </Text>
                    </Pressable>
                </View>

                <Text className="mt-[18px] max-w-[306px] text-center text-[16px] leading-[1.42] text-ink-2">
                    Los enlaces de invitación abren un grupo concreto. Si esperabas uno, pídelo otra vez a
                    quien te invitó.
                </Text>
            </View>
        </>
    );
}
