import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { createGroup } from '@/lib/group-utils';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

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

            await createGroup({
                name: name.trim(),
                icon,
                creatorId: user.id
            });

            router.replace('/');
        } catch (err: any) {
            console.error('Error creating group:', err);
            setError(err.message || 'Error al crear el grupo');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <View className="px-6 py-4 flex-row items-center justify-between bg-surface-container-low">
                <Pressable onPress={() => router.back()} className="p-2">
                    <Text className="text-primary font-sans-bold">Volver</Text>
                </Pressable>
                <Text className="text-lg font-display text-on-background">Crear grupo</Text>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1 p-6">
                <View className="items-center mb-8">
                    <View className="w-24 h-24 bg-surface-container-low rounded-full items-center justify-center shadow-ambient">
                        <Text className="text-5xl">{icon}</Text>
                    </View>
                    <Text className="mt-4 text-on-surface/55 text-sm font-sans">Icono del grupo</Text>
                </View>

                <View className="space-y-6">
                    <View>
                        <Text className="text-sm font-sans-semibold text-on-background mb-2">Nombre del grupo</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Ej: Amigos de la Uni, Familia..."
                            placeholderTextColor="#4c212b88"
                            className="bg-surface-container-highest p-4 rounded-full text-on-background font-sans"
                        />
                    </View>

                    {error ? (
                        <View className="bg-primary/10 p-4 rounded-xl ring-1 ring-primary/20">
                            <Text className="text-primary text-sm text-center font-sans-medium">{error}</Text>
                        </View>
                    ) : null}

                    <PrimaryButton
                        onPress={handleCreate}
                        disabled={loading}
                        textClassName="text-on-primary font-sans-bold text-lg"
                        accessibilityLabel="Crear grupo"
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            'Crear grupo'
                        )}
                    </PrimaryButton>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
