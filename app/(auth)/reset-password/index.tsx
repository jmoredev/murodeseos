import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { validateNewPassword } from '@/lib/password';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

/** Margen para que el cliente canjee el código del enlace antes de darlo por inválido. */
const LINK_CHECK_MS = 3000;

export default function ResetPasswordPage() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [hasSession, setHasSession] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;

        // El enlace de recuperación vuelve con un código; el cliente lo canjea al
        // cargar y deja una sesión temporal, que es la que permite cambiar la
        // contraseña. El verificador del código vive en este navegador, así que un
        // enlace abierto en otro dispositivo no puede canjearse.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!cancelled && session) {
                setHasSession(true);
                setChecking(false);
            }
        });

        void supabase.auth.getSession().then(({ data }) => {
            if (cancelled) return;
            if (data.session) {
                setHasSession(true);
                setChecking(false);
            }
        });

        const timer = setTimeout(() => {
            if (!cancelled) setChecking(false);
        }, LINK_CHECK_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            subscription.unsubscribe();
        };
    }, []);

    const handleSubmit = async () => {
        const passwordError = validateNewPassword(password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setSaving(true);
        setError('');

        let saved = false;

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });

            if (updateError) {
                setError(updateError.message);
                return;
            }

            saved = true;
        } catch {
            // Igual que al pedir el enlace: un fallo lanzado no puede dejar el
            // formulario bloqueado.
            setError('No pudimos guardar la contraseña. Comprueba tu conexión e inténtalo otra vez.');
        } finally {
            setSaving(false);
        }

        // La navegación queda **fuera** del `catch`: si fallara, el mensaje no puede
        // decir que la contraseña no se guardó cuando sí se guardó.
        if (saved) {
            router.replace('/');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} className="px-6">
                    <View className="w-full max-w-md self-center">
                        <Text className="text-3xl font-display text-on-background tracking-tight mb-3">
                            Nueva contraseña
                        </Text>

                        {checking ? (
                            <View testID="reset-checking" className="items-center py-10">
                                <ActivityIndicator size="large" color="#aa2c32" />
                                <Text className="mt-4 text-on-surface/55 font-sans-medium">Comprobando el enlace...</Text>
                            </View>
                        ) : !hasSession ? (
                            <View testID="reset-link-invalid">
                                <Text className="text-on-surface/70 font-sans mb-6">
                                    Este enlace no es válido o ha caducado. Pide uno nuevo desde el inicio de
                                    sesión y ábrelo en este mismo dispositivo.
                                </Text>
                                <PrimaryButton
                                    onPress={() => router.replace('/login')}
                                    accessibilityLabel="Volver al inicio de sesión"
                                    testID="back-to-login-button"
                                    textClassName="text-on-primary font-sans-bold text-base"
                                >
                                    Volver al inicio de sesión
                                </PrimaryButton>
                            </View>
                        ) : (
                            <>
                                <Text className="text-on-surface/70 font-sans mb-8">
                                    Escribe tu contraseña nueva. Entrarás directamente.
                                </Text>

                                {error ? (
                                    <View className="mb-4 p-4 rounded-2xl bg-primary/10">
                                        <Text testID="reset-error" className="text-primary text-sm font-sans-medium">
                                            {error}
                                        </Text>
                                    </View>
                                ) : null}

                                <View className="space-y-4">
                                    <View>
                                        <Text className="text-sm font-sans-semibold text-on-background mb-2">
                                            Contraseña nueva
                                        </Text>
                                        <TextInput
                                            className="p-4 rounded-full bg-surface-container-highest text-on-background font-sans"
                                            placeholder="••••••••"
                                            placeholderTextColor="#4c212b88"
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry
                                            accessibilityLabel="Contraseña nueva"
                                            testID="new-password-input"
                                        />
                                    </View>

                                    <View>
                                        <Text className="text-sm font-sans-semibold text-on-background mb-2">
                                            Repite la contraseña
                                        </Text>
                                        <TextInput
                                            className="p-4 rounded-full bg-surface-container-highest text-on-background font-sans"
                                            placeholder="••••••••"
                                            placeholderTextColor="#4c212b88"
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            secureTextEntry
                                            accessibilityLabel="Repite la contraseña nueva"
                                            testID="confirm-password-input"
                                        />
                                    </View>

                                    <PrimaryButton
                                        onPress={handleSubmit}
                                        disabled={saving}
                                        accessibilityLabel="Guardar contraseña"
                                        testID="save-password-button"
                                        textClassName="text-on-primary font-sans-bold text-base"
                                    >
                                        {saving ? 'Guardando...' : 'Guardar contraseña'}
                                    </PrimaryButton>
                                </View>
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
