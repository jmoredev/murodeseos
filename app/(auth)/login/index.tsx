import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [emailError, setEmailError] = useState('');

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    useEffect(() => {
        if (params.registered === 'true') {
            setSuccessMessage('¡Cuenta creada exitosamente! Por favor, inicia sesión.');
        }
    }, [params]);

    const handleLogin = async () => {
        setError('');
        setSuccessMessage('');

        if (!validateEmail(email)) {
            setEmailError('Por favor, introduce un correo electrónico válido');
            return;
        }

        setLoading(true);

        try {
            const { data, error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (loginError) {
                if (loginError.message.includes('Invalid login credentials')) {
                    setError('Correo electrónico o contraseña incorrectos');
                } else if (loginError.message.includes('Email not confirmed')) {
                    setError('Por favor, confirma tu correo electrónico antes de iniciar sesión');
                } else {
                    setError(loginError.message);
                }
                setLoading(false);
                return;
            }

            if (data.user) {
                await supabase.auth.refreshSession();

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', data.user.id)
                    .single();

                if (!profile || !profile.display_name) {
                    router.replace('/profile/setup');
                } else {
                    router.replace('/');
                }
            }
        } catch (err) {
            setError('Ocurrió un error inesperado. Por favor, intenta de nuevo.');
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
                    <View className="w-full max-w-sm mx-auto">
                        <Text className="text-3xl font-extrabold text-blue-600 text-center">
                            Bienvenido de nuevo
                        </Text>
                        <Text className="mt-2 text-sm text-gray-600 text-center">
                            Inicia sesión para acceder a tu lista de deseos
                        </Text>

                        {successMessage ? (
                            <View className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <Text className="text-green-800 text-sm">{successMessage}</Text>
                            </View>
                        ) : null}

                        {error ? (
                            <View className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <Text className="text-red-600 text-sm font-medium">Error: {error}</Text>
                            </View>
                        ) : null}

                        <View className="mt-8 space-y-4">
                            <View>
                                <Text className="text-sm font-medium text-gray-700 mb-1">Correo electrónico</Text>
                                <TextInput
                                    className={`p-3 border rounded-lg bg-gray-50 ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="tu@ejemplo.com"
                                    value={email}
                                    onChangeText={(text) => {
                                        setEmail(text);
                                        if (emailError && validateEmail(text)) setEmailError('');
                                    }}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    accessibilityLabel="Correo electrónico"
                                    testID="email-input"
                                />
                                {emailError ? <Text className="mt-1 text-xs text-red-500">{emailError}</Text> : null}
                            </View>

                            <View>
                                <Text className="text-sm font-medium text-gray-700 mb-1">Contraseña</Text>
                                <TextInput
                                    className="p-3 border border-gray-300 rounded-lg bg-gray-50"
                                    placeholder="••••••••"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    accessibilityLabel="Contraseña"
                                    testID="password-input"
                                />
                            </View>

                            <Pressable
                                onPress={handleLogin}
                                disabled={loading}
                                className={`mt-4 p-4 rounded-lg bg-purple-600 ${loading ? 'opacity-50' : 'active:opacity-80'}`}
                                accessibilityRole="button"
                                accessibilityLabel="Iniciar sesión"
                                testID="login-button"
                            >
                                <Text className="text-white text-center font-bold">
                                    {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                                </Text>
                            </Pressable>
                        </View>

                        <View className="mt-8">
                            <Text className="text-center text-gray-600">¿No tienes una cuenta?</Text>
                            <Pressable
                                onPress={() => router.push('/signup')}
                                accessibilityRole="button"
                                accessibilityLabel="Regístrate"
                                testID="register-link"
                                className="mt-2"
                            >
                                <Text className="text-center text-blue-600 font-bold">Regístrate</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
