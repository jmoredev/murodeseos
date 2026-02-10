import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { GroupsTab } from '@/components/GroupsTab';
import { WishListTab } from '@/components/WishListTab';
import { ProfileTab } from '@/components/ProfileTab';
import { NotificationMenu } from '@/components/NotificationMenu';

type Tab = 'groups' | 'wishlist' | 'profile';

export default function LandingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<Tab>('wishlist');

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setUser(session?.user ?? null);
            } catch (err) {
                console.error('Error checking user:', err);
            } finally {
                setLoading(false);
            }
        };
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <View className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                <Text className="mt-4 text-blue-600 font-medium">Cargando...</Text>
            </View>
        );
    }

    if (user) {
        return (
            <View className="flex-1 bg-white">
                <SafeAreaView className="flex-1">
                    {/* Header superior con Notificaciones */}
                    <View className="px-6 py-4 flex-row justify-between items-center border-b border-gray-100">
                        <Text className="text-xl font-black text-blue-600">
                            Muro de <Text className="text-purple-600">deseos</Text>
                        </Text>
                        <NotificationMenu userId={user.id} />
                    </View>

                    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
                        {activeTab === 'wishlist' && <WishListTab userId={user.id} />}
                        {activeTab === 'groups' && <GroupsTab userId={user.id} />}
                        {activeTab === 'profile' && (
                            <View className="pb-10">
                                <ProfileTab userId={user.id} />
                                <View className="px-6 mt-4">
                                    <Pressable
                                        onPress={() => supabase.auth.signOut()}
                                        className="bg-red-50 p-4 rounded-2xl border border-red-100"
                                    >
                                        <Text className="text-red-600 text-center font-bold">Cerrar Sesión</Text>
                                    </Pressable>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>

                {/* Navbar Inferior */}
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
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Text className="text-5xl font-extrabold text-blue-600 text-center">
                    Muro de <Text className="text-purple-600">deseos</Text>
                </Text>
                <Text className="mt-6 text-xl text-gray-600 text-center max-w-sm">
                    Comparte tus sueños, organiza tus regalos y haz realidad los deseos de tus amigos.
                </Text>

                <View className="mt-10 w-full max-w-xs gap-4">
                    <Pressable
                        onPress={() => router.push('/login')}
                        className="bg-purple-600 p-4 rounded-full active:opacity-80 shadow-lg shadow-purple-600/30"
                    >
                        <Text className="text-white text-center font-bold text-lg">Iniciar Sesión</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => router.push('/signup')}
                        className="bg-white border border-gray-200 p-4 rounded-full active:bg-gray-50"
                    >
                        <Text className="text-gray-900 text-center font-semibold text-lg">Registrarse</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
