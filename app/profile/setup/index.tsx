import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function ProfileSetupPage() {
    const router = useRouter();
    const [displayName, setDisplayName] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState('👤');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/login');
            }
        };
        checkUser();
    }, []);

    const handleSave = async () => {
        if (displayName.trim().length < 3) {
            setError('El nombre debe tener al menos 3 caracteres');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No se encontró el usuario');

            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    display_name: displayName.trim(),
                    avatar_url: selectedAvatar,
                    updated_at: new Date().toISOString(),
                });

            if (updateError) throw updateError;

            router.replace('/');
        } catch (err: any) {
            console.error('Error in profile setup:', err);
            setError(err.message || 'Error al guardar el perfil');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1 p-8" contentContainerStyle={{ justifyContent: 'center', minHeight: '100%' }}>
                <View className="items-center mb-10">
                    <Text className="text-3xl font-black text-gray-900 text-center">¡Bienvenido!</Text>
                    <Text className="text-gray-500 text-center mt-2 px-4">
                        Antes de empezar, dinos cómo quieres que te vean los demás.
                    </Text>
                </View>

                <View className="items-center mb-10">
                    <View className="w-28 h-28 bg-indigo-50 rounded-full items-center justify-center border-2 border-indigo-100 shadow-sm">
                        <Text className="text-6xl">{selectedAvatar}</Text>
                    </View>
                    <View className="flex-row flex-wrap justify-center gap-3 mt-6 px-4">
                        {['👤', '😊', '😎', '🤓', '🥳', '😇', '🦸', '👨‍💻'].map((emoji) => (
                            <Pressable
                                key={emoji}
                                onPress={() => setSelectedAvatar(emoji)}
                                className={`p-2 rounded-xl border-2 ${selectedAvatar === emoji ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100'}`}
                            >
                                <Text className="text-2xl">{emoji}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View className="space-y-6">
                    <View>
                        <Text className="text-sm font-bold text-gray-700 mb-2">Tu nombre o apodo</Text>
                        <TextInput
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Ej: John Doe, El Mago..."
                            className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-gray-900 text-lg"
                        />
                        <Text className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider ml-1">
                            Mínimo 3 caracteres
                        </Text>
                    </View>

                    {error ? (
                        <View className="bg-red-50 p-4 rounded-xl border border-red-100">
                            <Text className="text-red-600 text-sm text-center font-medium">{error}</Text>
                        </View>
                    ) : null}

                    <Pressable
                        onPress={handleSave}
                        disabled={loading}
                        className={`mt-10 p-5 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-600/30 ${loading ? 'opacity-70' : ''}`}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-center font-bold text-lg">Empezar a usar Muro de Deseos</Text>
                        )}
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
