import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/sign-out';
import { validateNewPassword } from '@/lib/password';
import { AppIcon } from '@/components/ui/AppIcon';
import { AuthAlert } from '@/components/auth/AuthAlert';
import { AuthButton } from '@/components/auth/AuthButton';
import { AuthColumn, AuthScreen } from '@/components/auth/AuthScreen';
import { AuthTextField } from '@/components/auth/AuthTextField';
import { isOfflineError } from '@/components/auth/errors';
import { SCREEN_SUBTITLE, SCREEN_TITLE } from '@/components/auth/styles';

/**
 * Nueva contraseña desde el enlace del correo (`11-acceso.html`, P10–P12).
 *
 * Un solo campo con «Mostrar» (decisión del propietario, S4): nadie escribe dos
 * veces lo mismo ni tiene que adivinar cuál de los dos se equivocó. Se mantiene
 * el mínimo de 8 caracteres y la misma llamada `updateUser`.
 *
 * Al guardar no se salta a la lista: P11 confirma lo hecho y ofrece las dos
 * salidas. P12 cubre el enlace abierto en otro dispositivo o caducado.
 */

/** Margen para que el cliente canjee el código del enlace antes de darlo por inválido. */
const LINK_CHECK_MS = 3000;

export default function ResetPasswordPage() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [hasSession, setHasSession] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [changed, setChanged] = useState(false);
    // Cerrar sesión puede fallar (la red se cayó entre el cambio y la salida): el
    // botón cuenta que trabaja y, si falla, se dice aquí sin dejar la pantalla
    // bloqueada (`R3-004`).
    const [signingOut, setSigningOut] = useState(false);
    const [signOutError, setSignOutError] = useState('');

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
        } catch (thrown) {
            // Igual que al pedir el enlace: un fallo lanzado no puede dejar el
            // formulario bloqueado.
            setError(
                isOfflineError(thrown)
                    ? 'No pudimos guardar la contraseña. Comprueba tu conexión e inténtalo otra vez.'
                    : 'No pudimos guardar la contraseña. Inténtalo otra vez.',
            );
        } finally {
            setSaving(false);
        }

        if (saved) setChanged(true);
    };

    const handleSignOut = async () => {
        if (signingOut) return;

        setSignOutError('');
        setSigningOut(true);

        try {
            await signOut();
            router.replace('/login');
        } catch (thrown) {
            setSignOutError(
                isOfflineError(thrown)
                    ? 'No pudimos cerrar la sesión. Comprueba tu conexión e inténtalo otra vez.'
                    : 'No pudimos cerrar la sesión. Inténtalo otra vez.',
            );
        } finally {
            setSigningOut(false);
        }
    };

    if (checking) {
        return (
            <AuthScreen>
                <AuthColumn className="justify-center">
                    <View role="status" testID="reset-checking" className="items-center py-10">
                        <Text className="text-[17px] font-sans text-ink-2">
                            Comprobando el enlace…
                        </Text>
                    </View>
                </AuthColumn>
            </AuthScreen>
        );
    }

    if (!hasSession && !changed) {
        return (
            <AuthScreen>
                <AuthColumn>
                    <Text className={SCREEN_TITLE}>Nueva contraseña</Text>

                    <View testID="reset-link-invalid">
                        <AuthAlert
                            className="mt-[18px]"
                            title="Este enlace no es válido o ha caducado"
                            body="Los enlaces duran una hora. Pide uno nuevo desde el inicio de sesión y ábrelo en este mismo dispositivo."
                        />

                        <View className="mt-[18px] gap-2.5">
                            <AuthButton
                                label="Pedir un enlace nuevo"
                                onPress={() => router.replace('/forgot-password')}
                                testID="request-new-link-button"
                            />
                            <AuthButton
                                variant="secondary"
                                label="Volver al inicio de sesión"
                                onPress={() => router.replace('/login')}
                                testID="back-to-login-button"
                            />
                        </View>

                        <View className="mt-3.5 flex-row items-start gap-[9px] rounded-[14px] bg-primary-soft px-3 py-2.5">
                            <AppIcon
                                name="info"
                                size={20}
                                className="mt-px text-primary-dark"
                                accessibilityElementsHidden
                                importantForAccessibility="no"
                            />
                            <Text className="flex-1 text-[17px] font-sans leading-[1.35] text-ink">
                                Si ya pediste el enlace en el ordenador, ábrelo ahí: en el móvil no
                                funcionará.
                            </Text>
                        </View>
                    </View>
                </AuthColumn>
            </AuthScreen>
        );
    }

    if (changed) {
        return (
            <AuthScreen>
                <AuthColumn>
                    <View role="status" testID="password-changed" className="mt-6 items-center">
                        <View className="h-[76px] w-[76px] items-center justify-center rounded-full border-2 border-accent-line bg-accent-soft">
                            <AppIcon
                                name="check"
                                size={38}
                                className="text-accent-ink"
                                accessibilityElementsHidden
                                importantForAccessibility="no"
                            />
                        </View>
                        <Text className={`${SCREEN_TITLE} mt-4 text-center`}>
                            Contraseña cambiada
                        </Text>
                        <Text className={`${SCREEN_SUBTITLE} max-w-[320px] text-center`}>
                            Ya puedes entrar con tu contraseña nueva. Te dejamos dentro, con tu
                            lista y tus grupos como estaban.
                        </Text>
                    </View>

                    <View className="mt-[18px] gap-2.5">
                        <AuthButton
                            label="Ir a mi lista"
                            onPress={() => router.replace('/')}
                            testID="go-to-list-button"
                        />
                        <AuthButton
                            variant="secondary"
                            label="Cerrar sesión"
                            loadingLabel="Cerrando sesión…"
                            loading={signingOut}
                            onPress={handleSignOut}
                            testID="sign-out-button"
                            spinnerTestID="sign-out-spinner"
                        />
                    </View>

                    {signOutError ? (
                        <AuthAlert title={signOutError} testID="sign-out-error" />
                    ) : null}

                    <AuthAlert
                        variant="ok"
                        title="Tus listas no cambian"
                        body="Los grupos y los regalos que ya habías reservado siguen como estaban."
                        testID="password-changed-note"
                    />
                </AuthColumn>
            </AuthScreen>
        );
    }

    return (
        <AuthScreen>
            <AuthColumn>
                <Text className={`${SCREEN_TITLE} mt-4`}>Nueva contraseña</Text>
                <Text className={SCREEN_SUBTITLE}>
                    Escribe tu contraseña nueva. Entrarás directamente.
                </Text>

                <View
                    testID="reset-form"
                    aria-busy={saving}
                    className="mt-[18px] gap-4"
                >
                    <AuthTextField
                        label="Contraseña nueva"
                        testID="new-password-input"
                        accessibilityLabel="Contraseña nueva"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        password={{ toggleMode: 'text' }}
                        value={password}
                        off={saving}
                        error={error || undefined}
                        errorTestID="reset-error"
                        hint="Al menos 8 caracteres. Pulsa «Mostrar» para comprobar que está bien escrita."
                        hintIcon="key"
                        onChangeText={(text) => {
                            setPassword(text);
                            if (error) setError('');
                        }}
                    />

                    <AuthButton
                        onPress={handleSubmit}
                        label="Guardar contraseña"
                        loadingLabel="Guardando…"
                        loading={saving}
                        testID="save-password-button"
                        spinnerTestID="save-password-spinner"
                    />
                </View>

                <View className="mt-3.5 flex-row items-start gap-[9px] rounded-[14px] bg-primary-soft px-3 py-2.5">
                    <AppIcon
                        name="info"
                        size={20}
                        className="mt-px text-primary-dark"
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                    />
                    <Text className="flex-1 text-[17px] font-sans leading-[1.35] text-ink">
                        No hace falta escribirla dos veces: con «Mostrar» lo compruebas y no hay dos
                        sitios donde equivocarse.
                    </Text>
                </View>

                <Text className="mt-2.5 text-center text-[16px] font-sans leading-[1.35] text-ink-2">
                    Este enlace sirve solo en este dispositivo, el mismo donde pediste el correo.
                </Text>
            </AuthColumn>
        </AuthScreen>
    );
}
