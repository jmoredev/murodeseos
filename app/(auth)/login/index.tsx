import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getSiteBaseUrl } from '@/lib/site-url';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

export default function LoginPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // El mensaje se deriva del parámetro de la URL; el estado sólo registra que el usuario
    // ya volvió a intentar entrar, para no repetirlo.
    const [dismissedWelcome, setDismissedWelcome] = useState(false);
    const successMessage =
        !dismissedWelcome && params.registered === 'true'
            ? 'Cuenta creada. Inicia sesión.'
            : '';
    const [emailError, setEmailError] = useState('');
    const [showRecovery, setShowRecovery] = useState(false);
    const [recoverySent, setRecoverySent] = useState(false);
    const [sendingRecovery, setSendingRecovery] = useState(false);
    const [recoveryError, setRecoveryError] = useState('');
    const emailErrorId = 'login-email-error';
    const formStatusId = 'login-form-status';

    const validateEmail = (emailValue: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(emailValue);
    };

    const handlePasswordRecovery = async () => {
        if (!validateEmail(email)) {
            setEmailError('Por favor, introduce un correo electrónico válido');
            return;
        }

        setSendingRecovery(true);
        setRecoveryError('');

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${getSiteBaseUrl()}/reset-password`,
            });

            // Supabase responde correctamente aunque la cuenta no exista, así que un
            // error devuelto es un fallo real y se puede contar sin revelar nada; el
            // mensaje neutro se reserva para la respuesta correcta.
            if (resetError) {
                setRecoveryError(
                    resetError.status === 429 || resetError.code === 'over_email_send_rate_limit'
                        ? 'Se pidieron demasiados enlaces seguidos. Espera unos minutos e inténtalo otra vez.'
                        : 'No pudimos enviar el enlace. Inténtalo otra vez en unos minutos.',
                );
                return;
            }

            setRecoverySent(true);
        } catch {
            // Un fallo lanzado (la red caída, por ejemplo) no puede dejar el botón
            // bloqueado: el estado se libera siempre, pase lo que pase.
            setRecoveryError('No pudimos enviar el enlace. Comprueba tu conexión e inténtalo otra vez.');
        } finally {
            setSendingRecovery(false);
        }
    };

    const handleLogin = async () => {
        setError('');
        setDismissedWelcome(true);

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
                        <Text className="mt-3 text-sm text-on-surface/70 text-center font-sans">
                            Inicia sesión para acceder a tu lista de deseos
                        </Text>

                        {successMessage ? (
                            <View
                                className="mt-6 p-4 bg-success/12 rounded-2xl"
                                accessibilityLiveRegion="polite"
                                nativeID={formStatusId}
                            >
                                <Text className="text-success text-sm font-sans-medium">{successMessage}</Text>
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
                                    style={{ fontSize: 16 }}
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
                                    style={{ fontSize: 16 }}
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

                        {/* Recuperación de contraseña: el enlace del correo vuelve a
                            `/reset-password`, que necesita el código que Supabase deja en
                            este navegador, así que hay que abrirlo en el mismo dispositivo. */}
                        <View className="mt-6">
                            <Pressable
                                onPress={() => {
                                    setShowRecovery((visible) => !visible);
                                    setRecoverySent(false);
                                    setRecoveryError('');
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="¿Olvidaste tu contraseña?"
                                testID="forgot-password-link"
                                className="self-center"
                            >
                                <Text className="text-center text-sm text-on-surface/70 font-sans-medium">
                                    ¿Olvidaste tu contraseña?
                                </Text>
                            </Pressable>
                        </View>

                        {showRecovery ? (
                            <View className="mt-4 p-5 rounded-3xl bg-surface-container-low">
                                {recoverySent ? (
                                    <Text testID="recovery-sent-message" className="text-sm text-on-surface/80 font-sans">
                                        Si este correo tiene cuenta, te enviamos un enlace para restablecer la
                                        contraseña. Ábrelo en este mismo dispositivo.
                                    </Text>
                                ) : (
                                    <>
                                        <Text className="mb-3 text-sm font-sans-medium text-on-surface/70">
                                            Te enviamos un enlace al correo que escribiste arriba.
                                        </Text>
                                        {recoveryError ? (
                                            <Text testID="recovery-error" className="mb-3 text-xs text-primary font-sans-medium">
                                                {recoveryError}
                                            </Text>
                                        ) : null}
                                        <PrimaryButton
                                            onPress={handlePasswordRecovery}
                                            disabled={sendingRecovery}
                                            accessibilityLabel="Enviar enlace de recuperación"
                                            testID="send-recovery-button"
                                            textClassName="text-on-primary font-sans-bold text-sm"
                                        >
                                            {sendingRecovery ? 'Enviando...' : 'Enviar enlace'}
                                        </PrimaryButton>
                                    </>
                                )}
                            </View>
                        ) : null}

                        <View className="mt-8">
                            <Text className="text-center text-on-surface/70 font-sans">¿No tienes una cuenta?</Text>
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
