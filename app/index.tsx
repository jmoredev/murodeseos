import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { GroupsTab } from '@/components/GroupsTab';
import { WishListTab } from '@/components/WishListTab';
import { ProfileTab } from '@/components/ProfileTab';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import WhatsNewModal from '@/components/WhatsNewModal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

type Tab = 'groups' | 'wishlist' | 'profile';

export default function LandingPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<Tab>((params.tab as Tab) || 'wishlist');

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
            <View className="flex-1 items-center justify-center bg-surface">
                <View className="w-10 h-10 border-4 border-primary/25 border-t-primary rounded-full animate-spin" />
                <Text className="mt-4 text-primary font-sans-medium">Cargando...</Text>
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
        <SafeAreaView className="flex-1 bg-surface">
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingTop: 48 }}>
                <Text className="text-5xl font-display text-on-background text-center tracking-tight leading-tight">
                    Muro de <Text className="text-primary">deseos</Text>
                </Text>
                <Text className="mt-8 text-lg text-on-surface/70 text-center max-w-sm font-sans leading-relaxed">
                    Comparte tus sueños, organiza tus regalos y haz realidad los deseos de tus amigos.
                </Text>

                <View className="mt-12 w-full max-w-xs gap-4">
                    <PrimaryButton
                        onPress={() => router.push('/login')}
                        accessibilityLabel="Iniciar sesión"
                        textClassName="text-on-primary font-sans-bold text-base"
                    >
                        Iniciar sesión
                    </PrimaryButton>

                    <Pressable
                        onPress={() => router.push('/signup')}
                        className="bg-surface-container-high py-4 rounded-full active:opacity-80 shadow-ambient"
                        accessibilityRole="button"
                        accessibilityLabel="Registrarse"
                    >
                        <Text className="text-primary text-center font-sans-bold text-lg">Registrarse</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
