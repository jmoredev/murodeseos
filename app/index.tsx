import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function LandingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

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
    }, []);

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <Text className="text-blue-600">Cargando...</Text>
            </View>
        );
    }

    if (user) {
        // Redirigir a la vista principal si ya está logueado
        // Por ahora mostramos un placeholder o navegamos a una ruta privada
        return (
            <SafeAreaView className="flex-1 bg-white">
                <View className="p-4">
                    <Text className="text-2xl font-bold">¡Bienvenido de nuevo!</Text>
                    <Pressable
                        onPress={() => supabase.auth.signOut()}
                        className="mt-4 bg-red-500 p-3 rounded-lg"
                    >
                        <Text className="text-white text-center">Cerrar Sesión</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
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
                        className="bg-purple-600 p-4 rounded-full active:opacity-80"
                    >
                        <Text className="text-white text-center font-bold text-lg">Iniciar Sesión</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => router.push('/signup')}
                        className="bg-white border border-gray-300 p-4 rounded-full active:bg-gray-50"
                    >
                        <Text className="text-gray-900 text-center font-semibold text-lg">Registrarse</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
