import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const emailErrorId = 'signup-email-error';
    const confirmPasswordErrorId = 'signup-confirm-password-error';
    const formStatusId = 'signup-form-status';

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSignup = async () => {
        setError('');
        setEmailError('');
        setConfirmPasswordError('');

        if (!validateEmail(email)) {
            setEmailError('Por favor, introduce un correo electrónico válido');
            return;
        }

        if (password !== confirmPassword) {
            setConfirmPasswordError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            // Nota: En Expo PWA, el redirectTo debe apuntar al dominio configurado
            // Para desarrollo local, usaremos localhost:8081 que es el puerto por defecto de Expo
            const redirectTo = 'http://localhost:8081/login';

            const { data, error: signupError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: redirectTo,
                },
            });

            if (signupError) {
                if (signupError.message.includes('already registered')) {
                    setError('Este correo electrónico ya está registrado');
                } else {
                    setError(signupError.message);
                }
                setLoading(false);
                return;
            }

            router.push({ pathname: '/login', params: { registered: 'true' } });
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
                            Crear una cuenta
                        </Text>
                        <Text className="mt-2 text-sm text-gray-600 text-center">
                            Únete a Muro de deseos hoy
                        </Text>

                        {error ? (
                            <View
                                className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
                                accessibilityLiveRegion="polite"
                                nativeID={formStatusId}
                            >
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
                                    accessibilityInvalid={!!emailError}
                                    accessibilityDescribedBy={emailError ? emailErrorId : undefined}
                                    testID="email-input"
                                />
                                {emailError ? (
                                    <Text nativeID={emailErrorId} className="mt-1 text-xs text-red-500">
                                        {emailError}
                                    </Text>
                                ) : null}
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

                            <View>
                                <Text className="text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</Text>
                                <TextInput
                                    className={`p-3 border rounded-lg bg-gray-50 ${confirmPasswordError ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                    accessibilityLabel="Confirmar contraseña"
                                    accessibilityInvalid={!!confirmPasswordError}
                                    accessibilityDescribedBy={confirmPasswordError ? confirmPasswordErrorId : undefined}
                                    testID="confirm-password-input"
                                />
                                {confirmPasswordError ? (
                                    <Text nativeID={confirmPasswordErrorId} className="mt-1 text-xs text-red-500">
                                        {confirmPasswordError}
                                    </Text>
                                ) : null}
                            </View>

                            <Pressable
                                onPress={handleSignup}
                                disabled={loading}
                                className={`mt-4 p-4 rounded-lg bg-purple-600 ${loading ? 'opacity-50' : 'active:opacity-80'}`}
                                accessibilityRole="button"
                                accessibilityLabel="Registrarse"
                                testID="signup-button"
                            >
                                <Text className="text-white text-center font-bold">
                                    {loading ? 'Creando cuenta...' : 'Registrarse'}
                                </Text>
                            </Pressable>
                        </View>

                        <View className="mt-8">
                            <Text className="text-center text-gray-600">¿Ya tienes una cuenta?</Text>
                            <Pressable
                                onPress={() => router.push('/login')}
                                accessibilityRole="button"
                                accessibilityLabel="Inicia sesión"
                                testID="login-link"
                                className="mt-2"
                            >
                                <Text className="text-center text-blue-600 font-bold">Inicia sesión</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
