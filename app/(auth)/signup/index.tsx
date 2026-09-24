import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

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

    const validateEmail = (emailValue: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(emailValue);
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
            const redirectTo = 'http://localhost:8081/login';

            const { error: signupError } = await supabase.auth.signUp({
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
                            Crear una cuenta
                        </Text>
                        <Text className="mt-3 text-sm text-on-surface/65 text-center font-sans">
                            Únete a Muro de deseos hoy
                        </Text>

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

                            <View>
                                <Text className="text-sm font-sans-semibold text-on-background mb-2">Confirmar contraseña</Text>
                                <TextInput
                                    className={`p-4 rounded-full bg-surface-container-highest text-on-background font-sans ${confirmPasswordError ? 'ring-2 ring-primary/30' : ''}`}
                                    placeholder="••••••••"
                                    placeholderTextColor="#4c212b88"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                    accessibilityLabel="Confirmar contraseña"
                                    accessibilityInvalid={!!confirmPasswordError}
                                    accessibilityDescribedBy={confirmPasswordError ? confirmPasswordErrorId : undefined}
                                    testID="confirm-password-input"
                                />
                                {confirmPasswordError ? (
                                    <Text nativeID={confirmPasswordErrorId} className="mt-1 text-xs text-primary font-sans-medium">
                                        {confirmPasswordError}
                                    </Text>
                                ) : null}
                            </View>

                            <PrimaryButton
                                onPress={handleSignup}
                                disabled={loading}
                                accessibilityLabel="Registrarse"
                                testID="signup-button"
                                textClassName="text-on-primary font-sans-bold text-base"
                            >
                                {loading ? 'Creando cuenta...' : 'Registrarse'}
                            </PrimaryButton>
                        </View>

                        <View className="mt-8">
                            <Text className="text-center text-on-surface/65 font-sans">¿Ya tienes una cuenta?</Text>
                            <Pressable
                                onPress={() => router.push('/login')}
                                accessibilityRole="button"
                                accessibilityLabel="Inicia sesión"
                                testID="login-link"
                                className="mt-2"
                            >
                                <Text className="text-center text-primary font-sans-bold">Inicia sesión</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
