import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { GroupsTab } from '@/components/GroupsTab';
import { WishListTab } from '@/components/WishListTab';
import { ProfileTab } from '@/components/ProfileTab';
import { NotificationMenu } from '@/components/NotificationMenu';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import WhatsNewModal from '@/components/WhatsNewModal';

type Tab = 'groups' | 'wishlist' | 'profile';

export default function LandingPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<Tab>((params.tab as Tab) || 'wishlist');

    // Update activeTab when URL params change
    useEffect(() => {
        if (params.tab) {
            setActiveTab(params.tab as Tab);
        }
    }, [params.tab]);

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
            <>
                <ResponsiveLayout
                    userId={user.id}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    onSignOut={() => supabase.auth.signOut()}
                >
                    {activeTab === 'wishlist' && <WishListTab userId={user.id} />}
                    {activeTab === 'groups' && <GroupsTab userId={user.id} />}
                    {activeTab === 'profile' && <ProfileTab userId={user.id} />}
                </ResponsiveLayout>
                <WhatsNewModal />
            </>
        );
    }

    return (
        <>
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
        </>
    );
}
