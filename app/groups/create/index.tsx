import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { createGroup } from '@/lib/group-utils';

export default function CreateGroupPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('🎁');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!name.trim()) {
            setError('El nombre del grupo es obligatorio');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No se encontró el usuario');

            const group = await createGroup({
                name: name.trim(),
                icon,
                creatorId: user.id
            });

            // Navegar al home (el dashboard se actualizará)
            router.replace('/');
        } catch (err: any) {
            console.error('Error creating group:', err);
            setError(err.message || 'Error al crear el grupo');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100">
                <Pressable onPress={() => router.back()} className="p-2">
                    <Text className="text-blue-600 font-bold">Volver</Text>
                </Pressable>
                <Text className="text-lg font-bold">Crear Grupo</Text>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1 p-6">
                <View className="items-center mb-8">
                    <View className="w-24 h-24 bg-blue-50 rounded-full items-center justify-center border-2 border-blue-100">
                        <Text className="text-5xl">{icon}</Text>
                    </View>
                    <Text className="mt-4 text-gray-500 text-sm">Toca para cambiar el icono (Próximamente)</Text>
                </View>

                <View className="space-y-6">
                    <View>
                        <Text className="text-sm font-bold text-gray-700 mb-2">Nombre del grupo</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Ej: Amigos de la Uni, Familia..."
                            className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-gray-900"
                        />
                    </View>

                    {error ? (
                        <View className="bg-red-50 p-4 rounded-xl border border-red-100">
                            <Text className="text-red-600 text-sm text-center font-medium">{error}</Text>
                        </View>
                    ) : null}

                    <Pressable
                        onPress={handleCreate}
                        disabled={loading}
                        className={`mt-6 p-4 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 ${loading ? 'opacity-70' : ''}`}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-center font-bold text-lg">Crear Grupo</Text>
                        )}
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
