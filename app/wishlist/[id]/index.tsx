import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, useWindowDimensions, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { WishlistCard, GiftItem, Priority } from '@/components/WishlistCard';
import { ProfileInfoSection } from '@/components/ProfileInfoSection';

export default function UserWishlistPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const targetUserId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
    const targetUserName = params.name;
    const [items, setItems] = useState<GiftItem[]>([]);
    const [targetProfile, setTargetProfile] = useState<any>(null);
    const [showInfo, setShowInfo] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;

    useEffect(() => {
        const loadWishlist = async () => {
            if (!targetUserId) {
                setError("Usuario no encontrado.");
                setLoading(false);
                return;
            }

            try {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                setUser(currentUser);

                // Cargar perfil del usuario objetivo
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', targetUserId)
                    .maybeSingle();

                if (profileError) throw profileError;
                setTargetProfile(profileData);

                // Cargar items de la lista de deseos del usuario objetivo
                const { data, error: sbError } = await supabase
                    .from('wishlist_items')
                    .select('*')
                    .eq('user_id', targetUserId)
                    .order('priority', { ascending: false });

                if (sbError) throw sbError;

                const mappedItems: GiftItem[] = (data || []).map(item => ({
                    id: item.id,
                    title: item.title,
                    links: item.links || [],
                    imageUrl: item.image_url,
                    price: item.price,
                    notes: item.notes,
                    priority: item.priority as Priority,
                    reservedBy: item.reserved_by,
                }));

                setItems(mappedItems);
            } catch (err: any) {
                console.error('Error loading wishlist:', err);
                setError(err.message || "Error al cargar la lista de deseos");
            } finally {
                setLoading(false);
            }
        };

        loadWishlist();
    }, [targetUserId]);

    const handleReserve = async (item: GiftItem) => {
        if (!user) return;

        try {
            const { error: sbError } = await supabase
                .from('wishlist_items')
                .update({
                    reserved_by: user.id,
                    reserved_at: new Date().toISOString()
                })
                .eq('id', item.id);

            if (sbError) throw sbError;

            // Actualizar estado local
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, reservedBy: user.id } : i));
            Alert.alert('¡Reservado!', 'Has reservado este regalo con éxito.');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'No se pudo reservar el regalo');
        }
    };

    const handleCancelReserve = async (item: GiftItem) => {
        if (!user) return;

        try {
            const { error: sbError } = await supabase
                .from('wishlist_items')
                .update({
                    reserved_by: null,
                    reserved_at: null
                })
                .eq('id', item.id)
                .eq('reserved_by', user.id); // Solo si yo lo reservé

            if (sbError) throw sbError;

            // Actualizar estado local
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, reservedBy: null } : i));
        } catch (err: any) {
            Alert.alert('Error', err.message || 'No se pudo cancelar la reserva');
        }
    };

    if (error) {
        return (
            <View className="flex-1 items-center justify-center bg-white p-6">
                <Text style={{ fontSize: 64 }} className="mb-4">😕</Text>
                <Text className="text-2xl font-black text-zinc-900 mb-2">¡Vaya!</Text>
                <Text className="text-zinc-500 text-center font-medium mb-8">{error}</Text>
                <Pressable
                    onPress={() => router.replace('/')}
                    className="px-8 py-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20"
                >
                    <Text className="text-white font-bold">Volver al inicio</Text>
                </Pressable>
            </View>
        );
    }

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    return (
        <ResponsiveLayout
            userId={user?.id}
            activeTab="wishlist"
            setActiveTab={(tab) => router.push(`/?tab=${tab}` as any)}
            onSignOut={() => supabase.auth.signOut()}
        >
            <View className="p-4">
                {/* Header Section */}
                <View className={`flex-row justify-between items-center mb-10 ${isDesktop ? 'px-0' : 'px-2'}`}>
                    <View className="flex-row items-center flex-1">
                        <Pressable
                            onPress={() => router.back()}
                            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 items-center justify-center mr-4"
                        >
                            <Text className="text-zinc-600 dark:text-zinc-400 font-bold">←</Text>
                        </Pressable>
                        <View className="flex-1">
                            <Text className="text-3xl font-black text-zinc-900 dark:text-white" numberOfLines={1}>
                                Lista de {targetProfile?.display_name || targetUserName || 'Usuario'}
                            </Text>
                            <Text className="text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                                Wishlist Pública
                            </Text>
                        </View>
                    </View>

                    {!isDesktop && (
                        <Pressable
                            onPress={() => setShowInfo(true)}
                            className="w-12 h-12 rounded-2xl bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-600/30"
                        >
                            <Text style={{ fontSize: 24 }}>ℹ️</Text>
                        </Pressable>
                    )}
                </View>

                <View className={`flex-row ${isDesktop ? 'gap-10' : ''}`}>
                    {/* Main Content (Wishlist Grid) */}
                    <View className={`flex-1`}>
                        {items.length === 0 ? (
                            <View className="items-center justify-center py-20 grayscale opacity-50">
                                <View className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full items-center justify-center mb-6">
                                    <Text style={{ fontSize: 40 }}>🎁</Text>
                                </View>
                                <Text className="text-2xl font-black text-zinc-900 dark:text-white mb-2 text-center">Lista vacía</Text>
                                <Text className="text-zinc-500 dark:text-zinc-400 font-medium text-center">Este usuario aún no ha añadido deseos.</Text>
                            </View>
                        ) : (
                            <View className="flex-row flex-wrap -m-2">
                                {items.map((item) => (
                                    <View key={item.id} className={`${isDesktop ? 'w-1/3' : 'w-1/2'} p-2`}>
                                        <WishlistCard
                                            item={item}
                                            isOwner={false}
                                            currentUserId={user?.id}
                                            onReserve={handleReserve}
                                            onCancelReserve={handleCancelReserve}
                                        />
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Desktop Sidebar (Profile Info) */}
                    {isDesktop && (
                        <View className="w-80">
                            <ProfileInfoSection profile={targetProfile} isDesktop={true} />
                        </View>
                    )}
                </View>
            </View>

            {/* Mobile Info Modal */}
            <Modal
                visible={showInfo}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowInfo(false)}
            >
                <View className="flex-1 justify-end bg-black/40">
                    <View className="bg-white rounded-t-[40px] max-h-[80%] pb-10">
                        <View className="items-center py-4">
                            <View className="w-12 h-1.5 bg-zinc-200 rounded-full" />
                        </View>

                        <View className="px-6 flex-row justify-between items-center mb-2">
                            <Text className="text-2xl font-black text-zinc-900">Información</Text>
                            <Pressable
                                onPress={() => setShowInfo(false)}
                                className="w-10 h-10 rounded-full bg-zinc-100 items-center justify-center"
                            >
                                <Text className="text-zinc-500 font-bold">✕</Text>
                            </Pressable>
                        </View>

                        <ScrollView className="px-4">
                            <ProfileInfoSection profile={targetProfile} isDesktop={false} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ResponsiveLayout>
    );
}
