import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

export default function LoginPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [emailError, setEmailError] = useState('');
    const emailErrorId = 'login-email-error';
    const formStatusId = 'login-form-status';

    const validateEmail = (emailValue: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(emailValue);
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
        } catch {
            setError('Ocurrió un error inesperado. Por favor, intenta de nuevo.');
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
                    <View className="w-full max-w-sm mx-auto">
                        <Text className="text-3xl font-display text-on-background text-center tracking-tight">
                            Bienvenido de nuevo
                        </Text>
                        <Text className="mt-3 text-sm text-on-surface/65 text-center font-sans">
                            Inicia sesión para acceder a tu lista de deseos
                        </Text>

                        {successMessage ? (
                            <View
                                className="mt-6 p-4 bg-tertiary/12 rounded-2xl"
                                accessibilityLiveRegion="polite"
                                nativeID={formStatusId}
                            >
                                <Text className="text-tertiary text-sm font-sans-medium">{successMessage}</Text>
                            </View>
                        ) : null}

                        {error ? (
                            <View
                                className="mt-6 p-4 bg-primary/10 rounded-2xl ring-1 ring-primary/20"
                                accessibilityLiveRegion="polite"
                                nativeID={formStatusId}
                            >
                                <Text className="text-primary text-sm font-sans-medium">Error: {error}</Text>
                            </View>
                        ) : null}

                        <View className="mt-8 space-y-4">
                            <View>
                                <Text className="text-sm font-sans-semibold text-on-background mb-2">Correo electrónico</Text>
                                <TextInput
                                    className={`p-4 rounded-full bg-surface-container-highest text-on-background font-sans ${emailError ? 'ring-2 ring-primary/30' : ''}`}
                                    placeholder="tu@ejemplo.com"
                                    placeholderTextColor="#4c212b88"
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
                                    <Text nativeID={emailErrorId} className="mt-1 text-xs text-primary font-sans-medium">
                                        {emailError}
                                    </Text>
                                ) : null}
                            </View>

                            <View>
                                <Text className="text-sm font-sans-semibold text-on-background mb-2">Contraseña</Text>
                                <TextInput
                                    className="p-4 rounded-full bg-surface-container-highest text-on-background font-sans"
                                    placeholder="••••••••"
                                    placeholderTextColor="#4c212b88"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    accessibilityLabel="Contraseña"
                                    testID="password-input"
                                />
                            </View>

                            <PrimaryButton
                                onPress={handleLogin}
                                disabled={loading}
                                accessibilityLabel="Iniciar sesión"
                                testID="login-button"
                                textClassName="text-on-primary font-sans-bold text-base"
                            >
                                {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                            </PrimaryButton>
                        </View>

                        <View className="mt-8">
                            <Text className="text-center text-on-surface/65 font-sans">¿No tienes una cuenta?</Text>
                            <Pressable
                                onPress={() => router.push('/signup')}
                                accessibilityRole="button"
                                accessibilityLabel="Regístrate"
                                testID="register-link"
                                className="mt-2"
                            >
                                <Text className="text-center text-primary font-sans-bold">Regístrate</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
