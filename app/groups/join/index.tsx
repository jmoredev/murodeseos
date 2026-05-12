import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { joinGroup } from '@/lib/group-utils';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

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

            await joinGroup({
                groupCode: code.trim(),
                userId: user.id
            });

            router.replace('/');
        } catch (err: any) {
            console.error('Error joining group:', err);
            setError(err.message || 'Error al unirse al grupo');
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
                <Text className="text-lg font-display text-on-background">Unirse a un grupo</Text>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1 p-6">
                <View className="items-center mb-8">
                    <View className="w-24 h-24 bg-surface-container-low rounded-full items-center justify-center shadow-ambient">
                        <Text className="text-5xl">🔑</Text>
                    </View>
                    <Text className="mt-4 text-on-background font-sans-bold text-xl">¿Tienes un código?</Text>
                    <Text className="text-on-surface/65 text-center text-sm mt-2 px-6 font-sans">
                        Introduce el código que te han compartido para unirte al grupo.
                    </Text>
                </View>

                <View className="space-y-6">
                    <View>
                        <Text className="text-sm font-sans-semibold text-on-background mb-2">Código del grupo</Text>
                        <TextInput
                            value={code}
                            onChangeText={(val) => setCode(val.toUpperCase())}
                            placeholder="Ej: AB12C3"
                            placeholderTextColor="#4c212b88"
                            maxLength={8}
                            autoCapitalize="characters"
                            className="bg-surface-container-highest p-4 rounded-2xl text-center text-2xl font-sans-bold text-primary tracking-widest"
                        />
                    </View>

                    {error ? (
                        <View className="bg-primary/10 p-4 rounded-xl ring-1 ring-primary/20">
                            <Text className="text-primary text-sm text-center font-sans-medium">{error}</Text>
                        </View>
                    ) : null}

                    <PrimaryButton
                        onPress={handleJoin}
                        disabled={loading}
                        textClassName="text-on-primary font-sans-bold text-lg"
                        accessibilityLabel="Unirse al grupo"
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            'Unirse al grupo'
                        )}
                    </PrimaryButton>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
