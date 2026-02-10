import React from 'react';
import { View, Text, Pressable, useWindowDimensions, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationMenu } from './NotificationMenu';

interface ResponsiveLayoutProps {
    userId: string;
    activeTab: 'wishlist' | 'groups' | 'profile';
    setActiveTab: (tab: 'wishlist' | 'groups' | 'profile') => void;
    children: React.ReactNode;
    onSignOut: () => void;
}

export function ResponsiveLayout({ userId, activeTab, setActiveTab, children, onSignOut }: ResponsiveLayoutProps) {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
                {/* Header / Top Navbar */}
                <View className="border-b border-gray-100 bg-white/80 backdrop-blur-md z-50">
                    <View className={`mx-auto w-full px-6 py-4 flex-row justify-between items-center ${isDesktop ? 'max-w-6xl' : ''}`}>
                        <Text className="text-xl font-black text-blue-600">
                            Muro de <Text className="text-purple-600">deseos</Text>
                        </Text>

                        {/* Desktop Navigation Links */}
                        {isDesktop && (
                            <View className="flex-row items-center gap-8 ml-8">
                                <Pressable
                                    onPress={() => setActiveTab('wishlist')}
                                    className="px-2 py-1"
                                >
                                    <Text className={`text-sm font-bold ${activeTab === 'wishlist' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-900'}`}>
                                        MIS DESEOS
                                    </Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => setActiveTab('groups')}
                                    className="px-2 py-1"
                                >
                                    <Text className={`text-sm font-bold ${activeTab === 'groups' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>
                                        MIS GRUPOS
                                    </Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => setActiveTab('profile')}
                                    className="px-2 py-1"
                                >
                                    <Text className={`text-sm font-bold ${activeTab === 'profile' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}>
                                        MI PERFIL
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        <View className="flex-row items-center">
                            <NotificationMenu userId={userId} />
                            {isDesktop && (
                                <Pressable
                                    onPress={onSignOut}
                                    className="ml-4 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100"
                                >
                                    <Text className="text-red-600 text-xs font-bold">SALIR</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>

                {/* Main Content Area */}
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{
                        paddingBottom: isDesktop ? 40 : 100,
                        alignItems: 'center'
                    }}
                >
                    <View className={`w-full ${isDesktop ? 'max-w-5xl px-10 pt-10' : ''}`}>
                        {children}
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* Mobile Bottom Navbar */}
            {!isDesktop && (
                <View className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 px-6 pt-3 pb-8 flex-row justify-around items-center">
                    <Pressable
                        onPress={() => setActiveTab('wishlist')}
                        className={`items-center p-2 rounded-2xl ${activeTab === 'wishlist' ? 'bg-purple-50' : ''}`}
                    >
                        <View className={`w-6 h-6 items-center justify-center ${activeTab === 'wishlist' ? 'text-purple-600' : 'text-gray-400'}`}>
                            <Text style={{ fontSize: 20 }}>🎁</Text>
                        </View>
                        <Text className={`text-[10px] mt-1 font-bold ${activeTab === 'wishlist' ? 'text-purple-600' : 'text-gray-400'}`}>
                            Deseos
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={() => setActiveTab('groups')}
                        className={`items-center p-2 rounded-2xl ${activeTab === 'groups' ? 'bg-blue-50' : ''}`}
                    >
                        <View className={`w-6 h-6 items-center justify-center ${activeTab === 'groups' ? 'text-blue-600' : 'text-gray-400'}`}>
                            <Text style={{ fontSize: 20 }}>👥</Text>
                        </View>
                        <Text className={`text-[10px] mt-1 font-bold ${activeTab === 'groups' ? 'text-blue-600' : 'text-gray-400'}`}>
                            Grupos
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={() => setActiveTab('profile')}
                        className={`items-center p-2 rounded-2xl ${activeTab === 'profile' ? 'bg-indigo-50' : ''}`}
                    >
                        <View className={`w-6 h-6 items-center justify-center ${activeTab === 'profile' ? 'text-indigo-600' : 'text-gray-400'}`}>
                            <Text style={{ fontSize: 20 }}>👤</Text>
                        </View>
                        <Text className={`text-[10px] mt-1 font-bold ${activeTab === 'profile' ? 'text-indigo-600' : 'text-gray-400'}`}>
                            Perfil
                        </Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}
