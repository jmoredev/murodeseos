import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function UserWishlistPage() {
    const router = useRouter();
    const { id: targetUserId, name: targetUserName } = useLocalSearchParams();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const loadWishlist = async () => {
            try {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                setUser(currentUser);

                // Cargar items de la lista de deseos del usuario objetivo
                const { data, error } = await supabase
                    .from('wishlist_items')
                    .select('*')
                    .eq('user_id', targetUserId)
                    .order('priority', { ascending: false });

                if (error) throw error;
                setItems(data || []);
            } catch (error) {
                console.error('Error loading wishlist:', error);
            } finally {
                setLoading(false);
            }
        };

        if (targetUserId) loadWishlist();
    }, [targetUserId]);

    const handleReserve = async (item: any) => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('wishlist_items')
                .update({
                    reserved_by: user.id,
                    reserved_at: new Date().toISOString()
                })
                .eq('id', item.id);

            if (error) throw error;

            // Actualizar estado local
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, reserved_by: user.id } : i));
            Alert.alert('¡Reservado!', 'Has reservado este regalo con éxito.');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudo reservar el regalo');
        }
    };

    const handleCancelReserve = async (item: any) => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('wishlist_items')
                .update({
                    reserved_by: null,
                    reserved_at: null
                })
                .eq('id', item.id)
                .eq('reserved_by', user.id); // Solo si yo lo reservé

            if (error) throw error;

            // Actualizar estado local
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, reserved_by: null } : i));
        } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudo cancelar la reserva');
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 flex-row items-center border-b border-gray-100">
                <Pressable onPress={() => router.back()} className="p-2 -ml-2">
                    <Text className="text-blue-600 font-bold">← Volver</Text>
                </Pressable>
                <Text className="text-lg font-bold flex-1 text-center" numberOfLines={1}>
                    Lista de {targetUserName || 'Usuario'}
                </Text>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1 bg-gray-50">
                <View className="p-6">
                    {items.length === 0 ? (
                        <View className="items-center justify-center py-20 grayscale opacity-50">
                            <Text className="text-6xl mb-4">🎁</Text>
                            <Text className="text-gray-500 font-medium text-center">Todavía no ha añadido ningún deseo a su lista.</Text>
                        </View>
                    ) : (
                        <View className="space-y-4">
                            {items.map((item) => {
                                const isReservedByMe = item.reserved_by === user?.id;
                                const isReservedByOther = item.reserved_by && item.reserved_by !== user?.id;

                                return (
                                    <View key={item.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                                        <View className="flex-row items-center mb-3">
                                            <View className="w-12 h-12 bg-indigo-50 rounded-xl items-center justify-center">
                                                <Text className="text-2xl">🎁</Text>
                                            </View>
                                            <View className="ml-4 flex-1">
                                                <Text className="font-bold text-gray-900 text-lg">{item.title}</Text>
                                                {item.price && <Text className="text-amber-600 font-bold">{item.price} €</Text>}
                                            </View>
                                            <View className={`px-2 py-1 rounded-full ${item.priority === 'high' ? 'bg-red-50' : item.priority === 'medium' ? 'bg-yellow-50' : 'bg-blue-50'
                                                }`}>
                                                <Text className={`text-[10px] font-bold uppercase ${item.priority === 'high' ? 'text-red-600' : item.priority === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                                                    }`}>
                                                    {item.priority === 'high' ? 'Alta' : item.priority === 'medium' ? 'Media' : 'Baja'}
                                                </Text>
                                            </View>
                                        </View>

                                        {item.notes ? (
                                            <Text className="text-gray-500 text-sm mb-4 leading-relaxed">{item.notes}</Text>
                                        ) : null}

                                        {isReservedByOther ? (
                                            <View className="bg-gray-100 p-3 rounded-xl flex-row items-center justify-center">
                                                <Text className="text-gray-400 font-bold text-sm ml-2">RESERVADO POR OTRA PERSONA</Text>
                                            </View>
                                        ) : isReservedByMe ? (
                                            <Pressable
                                                onPress={() => handleCancelReserve(item)}
                                                className="bg-green-50 p-3 rounded-xl flex-row items-center justify-center border border-green-100"
                                            >
                                                <Text className="text-green-600 font-bold text-sm">✓ RESERVADO POR TI (Toca para cancelar)</Text>
                                            </Pressable>
                                        ) : (
                                            <Pressable
                                                onPress={() => handleReserve(item)}
                                                className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-600/20"
                                            >
                                                <Text className="text-white text-center font-bold">Reservar este regalo</Text>
                                            </Pressable>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
