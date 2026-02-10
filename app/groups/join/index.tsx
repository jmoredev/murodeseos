import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { joinGroup } from '@/lib/group-utils';

export default function JoinGroupPage() {
    const router = useRouter();
    const { code: initialCode } = useLocalSearchParams();
    const [code, setCode] = useState((initialCode as string) || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (initialCode) {
            setCode(initialCode as string);
        }
    }, [initialCode]);

    const handleJoin = async () => {
        if (!code.trim()) {
            setError('Debes introducir un código de grupo');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No se encontró el usuario');

            const result = await joinGroup({
                groupCode: code.trim(),
                userId: user.id
            });

            // result.alreadyMember nos dice si ya estaba unido
            router.replace('/');
        } catch (err: any) {
            console.error('Error joining group:', err);
            setError(err.message || 'Error al unirse al grupo');
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
                <Text className="text-lg font-bold">Unirse a un Grupo</Text>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1 p-6">
                <View className="items-center mb-8">
                    <View className="w-24 h-24 bg-purple-50 rounded-full items-center justify-center border-2 border-purple-100">
                        <Text className="text-5xl">🔑</Text>
                    </View>
                    <Text className="mt-4 text-gray-900 font-bold text-xl">¿Tienes un código?</Text>
                    <Text className="text-gray-500 text-center text-sm mt-2 px-6">
                        Introduce el código de 6 caracteres que te han compartido para unirte al grupo.
                    </Text>
                </View>

                <View className="space-y-6">
                    <View>
                        <Text className="text-sm font-bold text-gray-700 mb-2">Código del grupo</Text>
                        <TextInput
                            value={code}
                            onChangeText={(val) => setCode(val.toUpperCase())}
                            placeholder="Ej: AB12C3"
                            maxLength={8}
                            autoCapitalize="characters"
                            className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-center text-2xl font-black text-purple-600 tracking-widest"
                        />
                    </View>

                    {error ? (
                        <View className="bg-red-50 p-4 rounded-xl border border-red-100">
                            <Text className="text-red-600 text-sm text-center font-medium">{error}</Text>
                        </View>
                    ) : null}

                    <Pressable
                        onPress={handleJoin}
                        disabled={loading}
                        className={`mt-6 p-4 rounded-2xl bg-purple-600 shadow-lg shadow-purple-600/30 ${loading ? 'opacity-70' : ''}`}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-center font-bold text-lg">Unirse al Grupo</Text>
                        )}
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
