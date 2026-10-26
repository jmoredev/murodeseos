import React from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationMenu } from './NotificationMenu';
import { GlassBar } from './ui/GlassBar';
import { AppIcon } from '@/components/ui/AppIcon';
import type { TourTargetProps } from '@/components/tour/TourTargetProvider';

/**
 * Las dos formas de pestaña son objetivo del tour (S7): en escritorio la tablist y en móvil el dock.
 * El hueco sigue a la forma que de verdad está en pantalla y no hay coordenadas escritas a mano; los
 * tres ids son los mismos en las dos formas a propósito, porque una parada del guion no cambia según
 * el ancho.
 *
 * Los objetivos **los pone la portada** (`app/index.tsx`) y este componente sólo los esparce: los ids
 * `tab-deseos`, `tab-grupos` y `tab-perfil` son de la portada y de nadie más. El detalle de un grupo y
 * la lista de una persona pintan esta misma barra, pero no son la portada: el guion señala la barra
 * de la portada, y mientras el registro vivió aquí dentro cada sub-ruta reclamaba los mismos ids y, al
 * desmontarse (el tour vuelve con un `back`, D5), su baja se llevaba por delante el alta que la
 * portada necesitaba para el hueco de la parada `perfil`.
 *
 * Sin `objetivosPestanas` las pestañas se pintan igual —misma semántica, mismo toque, mismo estilo— y
 * simplemente no son objetivo de nadie: es lo que hace una sub-ruta.
 */

/** Un objetivo por pestaña, listo para esparcir en su `Pressable`. */
export type ObjetivosDePestanas = {
    deseos: TourTargetProps;
    grupos: TourTargetProps;
    perfil: TourTargetProps;
};

interface ResponsiveLayoutProps {
    userId: string;
    activeTab: 'wishlist' | 'groups' | 'profile';
    setActiveTab: (tab: 'wishlist' | 'groups' | 'profile') => void;
    children: React.ReactNode;
    onSignOut: () => void;
    /** Los tres objetivos del tour, si esta pantalla es la portada. Sin ellos, las pestañas no se miden. */
    objetivosPestanas?: ObjetivosDePestanas;
}

function TabLabel({
    active,
    children: label,
}: {
    active: boolean;
    children: string;
}) {
    return (
        <Text
            className={`text-sm font-sans-bold uppercase tracking-widest ${
                active ? 'text-primary' : 'text-on-surface/70'
            }`}
        >
            {label}
        </Text>
    );
}

export function ResponsiveLayout({
    userId,
    activeTab,
    setActiveTab,
    children,
    onSignOut,
    objetivosPestanas,
}: ResponsiveLayoutProps) {
    const isDesktop = useIsDesktop();

    const scrollToMain = () => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;
        const el = document.getElementById('muro-main-content');
        el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        const first = el?.querySelector?.(
            'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement | null;
        window.setTimeout(() => first?.focus?.(), 200);
    };

    const tabListProps =
        Platform.OS === 'web'
            ? ({ role: 'tablist' as const, 'aria-label': 'Secciones principales' } as const)
            : { accessibilityLabel: 'Secciones principales' as const };

    return (
        <View className="flex-1 bg-surface">
            <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
                {Platform.OS === 'web' ? (
                    <Pressable
                        onPress={scrollToMain}
                        accessibilityRole="link"
                        accessibilityLabel="Saltar al contenido principal"
                        className="skip-to-main"
                    >
                        <Text className="text-sm font-sans-bold text-primary">Saltar al contenido principal</Text>
                    </Pressable>
                ) : null}
                <View className="bg-surface-container-low z-50 shadow-ambient">
                    <View className={`mx-auto w-full px-6 pt-6 pb-4 flex-row justify-between items-center ${isDesktop ? 'max-w-6xl' : ''}`}>
                        <Text className="text-xl font-display text-on-background tracking-tight">
                            Muro de <Text className="text-primary">deseos</Text>
                        </Text>

                        {isDesktop ? (
                            <View className="flex-row items-center gap-2 ml-8 bg-surface/90 rounded-full px-2 py-1.5 shadow-ambient" {...tabListProps}>
                                <Pressable
                                    onPress={() => setActiveTab('wishlist')}
                                    {...objetivosPestanas?.deseos}
                                    {...(Platform.OS === 'web'
                                        ? ({ role: 'tab' as const, 'aria-selected': activeTab === 'wishlist' } as const)
                                        : {
                                              accessibilityRole: 'button',
                                              accessibilityState: { selected: activeTab === 'wishlist' },
                                          })}
                                    accessibilityLabel="Mis deseos"
                                    className={`px-4 py-2 min-h-[44px] justify-center rounded-full ${activeTab === 'wishlist' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                                >
                                    <TabLabel active={activeTab === 'wishlist'}>Mis deseos</TabLabel>
                                </Pressable>
                                <Pressable
                                    onPress={() => setActiveTab('groups')}
                                    {...objetivosPestanas?.grupos}
                                    {...(Platform.OS === 'web'
                                        ? ({ role: 'tab' as const, 'aria-selected': activeTab === 'groups' } as const)
                                        : {
                                              accessibilityRole: 'button',
                                              accessibilityState: { selected: activeTab === 'groups' },
                                          })}
                                    accessibilityLabel="Mis grupos"
                                    className={`px-4 py-2 min-h-[44px] justify-center rounded-full ${activeTab === 'groups' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                                >
                                    <TabLabel active={activeTab === 'groups'}>Mis grupos</TabLabel>
                                </Pressable>
                                <Pressable
                                    onPress={() => setActiveTab('profile')}
                                    {...objetivosPestanas?.perfil}
                                    className={`px-4 py-2 min-h-[44px] justify-center rounded-full ${activeTab === 'profile' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                                    {...(Platform.OS === 'web'
                                        ? ({ role: 'tab' as const, 'aria-selected': activeTab === 'profile' } as const)
                                        : {
                                              accessibilityRole: 'button',
                                              accessibilityState: { selected: activeTab === 'profile' },
                                          })}
                                    accessibilityLabel="Mi perfil"
                                >
                                    <TabLabel active={activeTab === 'profile'}>Mi perfil</TabLabel>
                                </Pressable>
                            </View>
                        ) : null}

                        <View className="flex-row items-center">
                            <NotificationMenu userId={userId} />
                            {isDesktop ? (
                                <Pressable
                                    onPress={onSignOut}
                                    className="ml-4 px-4 py-2 min-h-[44px] min-w-[44px] justify-center rounded-full"
                                    accessibilityRole="button"
                                    accessibilityLabel="Salir"
                                >
                                    <Text className="text-primary text-xs font-sans-bold uppercase tracking-widest">Salir</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    </View>
                </View>

                <ScrollView
                    nativeID="muro-main-content"
                    className="flex-1 bg-surface"
                    contentContainerStyle={{
                        // La reserva crece con el inset solo donde el CSS lo entiende
                        // (`env()`); en nativo `SafeAreaView` ya gestiona el borde inferior
                        // y el número puro sigue siendo el valor correcto. El calc es CSS
                        // válido para react-native-web pero no entra en `DimensionValue`
                        // de RN: cast al estilo de la casa (`position: 'fixed' as any`).
                        paddingBottom: (Platform.OS === 'web'
                            ? (isDesktop
                                  ? 40
                                  : ('calc(112px + env(safe-area-inset-bottom))' as any))
                            : (isDesktop
                                  ? 40
                                  : 112)),
                        alignItems: 'center',
                    }}
                >
                    <View className={`w-full self-stretch ${isDesktop ? 'max-w-5xl px-10 pt-10' : 'max-w-full'}`}>{children}</View>
                </ScrollView>
            </SafeAreaView>

            {!isDesktop ? (
                <View
                    className="absolute left-0 right-0 items-center pointer-events-box-none"
                    style={{
                        // Web: dock anclado sobre la barra de inicio. `env()` vale 0px en
                        // escritorio así que el `calc` reduce a 16px, el valor de hoy. Cast
                        // `as any`: el calc es CSS de RNW, no entra en `DimensionValue`.
                        bottom: (Platform.OS === 'web'
                            ? 'calc(16px + env(safe-area-inset-bottom))'
                            : Platform.select({ ios: 20, android: 16, default: 16 })) as any,
                    }}
                    pointerEvents="box-none"
                >
                    <GlassBar className="rounded-full px-2 py-2 flex-row items-center justify-around shadow-ambient-lg w-[92%] max-w-md">
                        <Pressable
                            onPress={() => setActiveTab('wishlist')}
                            {...objetivosPestanas?.deseos}
                            accessibilityRole="button"
                            accessibilityLabel="Mis deseos"
                            accessibilityState={{ selected: activeTab === 'wishlist' }}
                            className={`flex-1 min-w-0 items-center justify-center px-3 py-2 min-h-[44px] justify-center rounded-full ${activeTab === 'wishlist' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                        >
                            <View className="items-center justify-center" importantForAccessibility="no-hide-descendants">
                                {/* El icono hereda el color de la etiqueta activa/inactiva
                                    que pinta `TabLabel`: misma clase `text-primary` o
                                    `text-on-surface/70` en el mismo Pressable. */}
                                <AppIcon
                                    name="gift"
                                    size={20}
                                    className={`mb-0.5 ${activeTab === 'wishlist' ? 'text-primary' : 'text-on-surface/70'}`}
                                />
                                <Text
                                    className={`text-xs mt-0.5 font-sans-bold ${activeTab === 'wishlist' ? 'text-primary' : 'text-on-surface/70'}`}
                                >
                                    Deseos
                                </Text>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => setActiveTab('groups')}
                            {...objetivosPestanas?.grupos}
                            accessibilityRole="button"
                            accessibilityLabel="Mis grupos"
                            accessibilityState={{ selected: activeTab === 'groups' }}
                            className={`flex-1 min-w-0 items-center justify-center px-3 py-2 min-h-[44px] justify-center rounded-full ${activeTab === 'groups' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                        >
                            <View className="items-center justify-center" importantForAccessibility="no-hide-descendants">
                                <AppIcon
                                    name="users"
                                    size={20}
                                    className={`mb-0.5 ${activeTab === 'groups' ? 'text-primary' : 'text-on-surface/70'}`}
                                />
                                <Text
                                    className={`text-xs mt-0.5 font-sans-bold ${activeTab === 'groups' ? 'text-primary' : 'text-on-surface/70'}`}
                                >
                                    Grupos
                                </Text>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => setActiveTab('profile')}
                            {...objetivosPestanas?.perfil}
                            accessibilityRole="button"
                            accessibilityLabel="Mi perfil"
                            accessibilityState={{ selected: activeTab === 'profile' }}
                            className={`flex-1 min-w-0 items-center justify-center px-3 py-2 min-h-[44px] justify-center rounded-full ${activeTab === 'profile' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                        >
                            <View className="items-center justify-center" importantForAccessibility="no-hide-descendants">
                                <AppIcon
                                    name="user"
                                    size={20}
                                    className={`mb-0.5 ${activeTab === 'profile' ? 'text-primary' : 'text-on-surface/70'}`}
                                />
                                <Text
                                    className={`text-xs mt-0.5 font-sans-bold ${activeTab === 'profile' ? 'text-primary' : 'text-on-surface/70'}`}
                                >
                                    Perfil
                                </Text>
                            </View>
                        </Pressable>
                    </GlassBar>
                </View>
            ) : null}
        </View>
    );
}
