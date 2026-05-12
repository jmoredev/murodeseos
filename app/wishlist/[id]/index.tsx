import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, useWindowDimensions, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { WishlistCard, GiftItem, Priority } from '@/components/WishlistCard';
import { ProfileInfoSection } from '@/components/ProfileInfoSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

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

                // Obtener grupos del viewer para filtrar deseos excluidos por grupo compartido.
                let viewerGroupIds: string[] = [];
                if (currentUser?.id) {
                    const { data: viewerMemberships, error: viewerMembershipsError } = await supabase
                        .from('group_members')
                        .select('group_id')
                        .eq('user_id', currentUser.id);

                    if (viewerMembershipsError) {
                        console.error('Error loading viewer groups:', viewerMembershipsError);
                    } else {
                        viewerGroupIds = (viewerMemberships || []).map((m: any) => m.group_id);
                    }
                }

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

                const visibleItems = (data || []).filter((item: any) => {
                    const excludedGroupIds = item.excluded_group_ids || [];
                    if (!Array.isArray(excludedGroupIds) || excludedGroupIds.length === 0) return true;
                    if (viewerGroupIds.length === 0) return true;
                    return !excludedGroupIds.some((groupId: string) => viewerGroupIds.includes(groupId));
                });

                const mappedItems: GiftItem[] = visibleItems.map(item => ({
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
            <View className="flex-1 items-center justify-center bg-surface p-6">
                <Text style={{ fontSize: 64 }} className="mb-4">😕</Text>
                <Text className="text-2xl font-display text-on-background mb-2">¡Vaya!</Text>
                <Text className="text-on-surface/65 text-center font-sans-medium mb-8">{error}</Text>
                <PrimaryButton onPress={() => router.replace('/')} accessibilityLabel="Volver al inicio">
                    Volver al inicio
                </PrimaryButton>
            </View>
        );
    }

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-surface">
                <ActivityIndicator size="large" color="#aa2c32" />
            </View>
        );
    }

    return (
        <ResponsiveLayout
            userId={user?.id ?? ''}
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
                            className="w-10 h-10 rounded-full bg-surface-container-low items-center justify-center mr-4"
                        >
                            <Text className="text-on-surface font-sans-bold">←</Text>
                        </Pressable>
                        <View className="flex-1">
                            <Text className="text-3xl font-display text-on-background tracking-tight" numberOfLines={1}>
                                Lista de {targetProfile?.display_name || targetUserName || 'Usuario'}
                            </Text>
                            <Text className="text-on-surface/55 font-sans-bold uppercase text-[10px] tracking-widest mt-2">
                                Wishlist pública
                            </Text>
                        </View>
                    </View>

                    {!isDesktop && (
                        <Pressable
                            onPress={() => setShowInfo(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Información del perfil"
                            testID="wishlist-profile-info-button"
                            className="w-12 h-12 shrink-0 rounded-full bg-surface-container-low items-center justify-center ring-1 ring-outline-variant/25 active:opacity-80"
                        >
                            <Text
                                className="text-primary font-display font-bold text-lg"
                                style={{ lineHeight: 20 }}
                            >
                                i
                            </Text>
                        </Pressable>
                    )}
                </View>

                <View className={`flex-row ${isDesktop ? 'gap-10' : ''}`}>
                    {/* Main Content (Wishlist Grid) */}
                    <View className={`flex-1`}>
                        {items.length === 0 ? (
                            <View className="items-center justify-center py-20 opacity-80">
                                <View className="w-24 h-24 bg-surface-container-low rounded-full items-center justify-center mb-6">
                                    <Text style={{ fontSize: 40 }}>🎁</Text>
                                </View>
                                <Text className="text-2xl font-display text-on-background mb-2 text-center">Lista vacía</Text>
                                <Text className="text-on-surface/55 font-sans-medium text-center">Este usuario aún no ha añadido deseos.</Text>
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
                <View className="flex-1 justify-end bg-on-surface/40">
                    <View className="bg-surface/95 backdrop-blur-xl rounded-t-[40px] max-h-[80%] pb-10">
                        <View className="items-center py-4">
                            <View className="w-12 h-1.5 bg-outline-variant/30 rounded-full" />
                        </View>

                        <View className="px-6 flex-row justify-between items-center mb-2">
                            <Text className="text-2xl font-display text-on-background">Información</Text>
                            <Pressable
                                onPress={() => setShowInfo(false)}
                                className="w-10 h-10 rounded-full bg-surface-container-low items-center justify-center"
                            >
                                <Text className="text-on-surface/55 font-sans-bold">✕</Text>
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
