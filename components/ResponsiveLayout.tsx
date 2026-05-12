import React from 'react';
import { View, Text, Pressable, useWindowDimensions, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationMenu } from './NotificationMenu';
import { GlassBar } from './ui/GlassBar';

interface ResponsiveLayoutProps {
    userId: string;
    activeTab: 'wishlist' | 'groups' | 'profile';
    setActiveTab: (tab: 'wishlist' | 'groups' | 'profile') => void;
    children: React.ReactNode;
    onSignOut: () => void;
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
                active ? 'text-primary' : 'text-on-surface/55'
            }`}
        >
            {label}
        </Text>
    );
}

export function ResponsiveLayout({ userId, activeTab, setActiveTab, children, onSignOut }: ResponsiveLayoutProps) {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;

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
                                    {...(Platform.OS === 'web'
                                        ? ({ role: 'tab' as const, 'aria-selected': activeTab === 'wishlist' } as const)
                                        : {
                                              accessibilityRole: 'button',
                                              accessibilityState: { selected: activeTab === 'wishlist' },
                                          })}
                                    accessibilityLabel="Mis deseos"
                                    className={`px-4 py-2 rounded-full ${activeTab === 'wishlist' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                                >
                                    <TabLabel active={activeTab === 'wishlist'}>Mis deseos</TabLabel>
                                </Pressable>
                                <Pressable
                                    onPress={() => setActiveTab('groups')}
                                    {...(Platform.OS === 'web'
                                        ? ({ role: 'tab' as const, 'aria-selected': activeTab === 'groups' } as const)
                                        : {
                                              accessibilityRole: 'button',
                                              accessibilityState: { selected: activeTab === 'groups' },
                                          })}
                                    accessibilityLabel="Mis grupos"
                                    className={`px-4 py-2 rounded-full ${activeTab === 'groups' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                                >
                                    <TabLabel active={activeTab === 'groups'}>Mis grupos</TabLabel>
                                </Pressable>
                                <Pressable
                                    onPress={() => setActiveTab('profile')}
                                    className={`px-4 py-2 rounded-full ${activeTab === 'profile' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
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
                                    className="ml-4 px-4 py-2 rounded-full"
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
                        paddingBottom: isDesktop ? 40 : 112,
                        alignItems: 'center',
                    }}
                >
                    <View className={`w-full ${isDesktop ? 'max-w-5xl px-10 pt-10' : ''}`}>{children}</View>
                </ScrollView>
            </SafeAreaView>

            {!isDesktop ? (
                <View
                    className="absolute left-0 right-0 items-center pointer-events-box-none"
                    style={{
                        bottom: Platform.select({ ios: 20, android: 16, default: 16 }),
                    }}
                    pointerEvents="box-none"
                >
                    <GlassBar className="rounded-full px-2 py-2 flex-row items-center justify-around shadow-ambient-lg w-[92%] max-w-md">
                        <Pressable
                            onPress={() => setActiveTab('wishlist')}
                            accessibilityRole="button"
                            accessibilityLabel="Mis deseos"
                            accessibilityState={{ selected: activeTab === 'wishlist' }}
                            className={`items-center px-4 py-1.5 rounded-full ${activeTab === 'wishlist' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                        >
                            <View importantForAccessibility="no-hide-descendants">
                                <Text style={{ fontSize: 20 }}>🎁</Text>
                                <Text
                                    className={`text-[10px] mt-0.5 font-sans-bold ${activeTab === 'wishlist' ? 'text-primary' : 'text-on-surface/50'}`}
                                >
                                    Deseos
                                </Text>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => setActiveTab('groups')}
                            accessibilityRole="button"
                            accessibilityLabel="Mis grupos"
                            accessibilityState={{ selected: activeTab === 'groups' }}
                            className={`items-center px-4 py-1.5 rounded-full ${activeTab === 'groups' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                        >
                            <View importantForAccessibility="no-hide-descendants">
                                <Text style={{ fontSize: 20 }}>👥</Text>
                                <Text
                                    className={`text-[10px] mt-0.5 font-sans-bold ${activeTab === 'groups' ? 'text-primary' : 'text-on-surface/50'}`}
                                >
                                    Grupos
                                </Text>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => setActiveTab('profile')}
                            accessibilityRole="button"
                            accessibilityLabel="Mi perfil"
                            accessibilityState={{ selected: activeTab === 'profile' }}
                            className={`items-center px-4 py-1.5 rounded-full ${activeTab === 'profile' ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                        >
                            <View importantForAccessibility="no-hide-descendants">
                                <Text style={{ fontSize: 20 }}>👤</Text>
                                <Text
                                    className={`text-[10px] mt-0.5 font-sans-bold ${activeTab === 'profile' ? 'text-primary' : 'text-on-surface/50'}`}
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
