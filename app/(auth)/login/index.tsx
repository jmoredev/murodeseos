import React, { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { AppIcon, AppIconName } from '@/components/ui/AppIcon';
import { AuthAlert } from '@/components/auth/AuthAlert';
import { AuthBackLink, AuthLink } from '@/components/auth/AuthBackLink';
import { AuthBrand } from '@/components/auth/AuthBrand';
import { AuthButton } from '@/components/auth/AuthButton';
import { AuthColumn, AuthScreen } from '@/components/auth/AuthScreen';
import { AuthTextField } from '@/components/auth/AuthTextField';
import { isOfflineError } from '@/components/auth/errors';
import { SCREEN_SUBTITLE, SCREEN_TITLE } from '@/components/auth/styles';

/**
 * Acceso (`design/rediseno-muro/11-acceso.html`): P1 iniciar sesión, P2 error de
 * credenciales, P3 mientras entra, P4 campos vacíos y P5 sin conexión. P6 (la
 * franja de invitación) es de T10 y no está aquí.
 *
 * La copy es la del artboard, literal: los errores se leen junto al campo o en
 * un aviso con título y explicación, nunca con prefijo «Error:», y **nada de lo
 * escrito se borra** al fallar.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CREDENCIALES_INCORRECTAS = {
    title: 'Correo electrónico o contraseña incorrectos',
    body: 'Revisa los dos datos. Si no recuerdas la contraseña, pide un enlace para cambiarla.',
};

const SIN_CONEXION = {
    title: 'Sin conexión',
    body: 'No hemos podido conectar. Comprueba tu conexión e inténtalo otra vez: lo que has escrito sigue aquí.',
};

const ERROR_INESPERADO = {
    title: 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
};

/** Los tres pasos de la columna izquierda del navegador (11 · .ac-step). */
const PASOS: { texto: string; icono: AppIconName }[] = [
    { texto: 'Apunta lo que te gustaría recibir.', icono: 'gift' },
    { texto: 'Compártelo con tu familia o amigos en un grupo.', icono: 'users' },
    { texto: 'Ellos reservan un regalo y nadie lo repite.', icono: 'heart' },
];

type FieldErrors = { email?: string; password?: string };
type Notice = { kind: 'error' | 'offline'; title: string; body?: string };

export default function LoginPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const isDesktop = useIsDesktop();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [notice, setNotice] = useState<Notice | null>(null);
    // El mensaje se deriva del parámetro de la URL; el estado sólo registra que el usuario
    // ya volvió a intentar entrar, para no repetirlo.
    const [dismissedWelcome, setDismissedWelcome] = useState(false);
    const successMessage =
        !dismissedWelcome && params.registered === 'true' ? 'Cuenta creada. Inicia sesión.' : '';
    const emailRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);

    const validate = (): FieldErrors => {
        const errors: FieldErrors = {};

        if (!email.trim()) {
            errors.email = 'Escribe tu correo electrónico';
        } else if (!EMAIL_RE.test(email)) {
            // Mensaje de siempre para un correo mal escrito (nota 4 del artboard).
            errors.email = 'Por favor, introduce un correo electrónico válido';
        }

        if (!password) {
            errors.password = 'Escribe tu contraseña';
        }

        return errors;
    };

    const handleLogin = async () => {
        setDismissedWelcome(true);
        setNotice(null);

        const errors = validate();
        setFieldErrors(errors);

        // El foco va al primer campo que falla: se corrige ahí mismo.
        if (errors.email) {
            emailRef.current?.focus();
            return;
        }
        if (errors.password) {
            passwordRef.current?.focus();
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
                    setNotice({ kind: 'error', ...CREDENCIALES_INCORRECTAS });
                } else if (loginError.message.includes('Email not confirmed')) {
                    setNotice({
                        kind: 'error',
                        title: 'Por favor, confirma tu correo electrónico antes de iniciar sesión',
                    });
                } else if (isOfflineError(loginError)) {
                    setNotice({ kind: 'offline', ...SIN_CONEXION });
                } else {
                    setNotice({ kind: 'error', title: loginError.message });
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
        } catch (thrown) {
            setNotice(
                isOfflineError(thrown)
                    ? { kind: 'offline', ...SIN_CONEXION }
                    : { kind: 'error', ...ERROR_INESPERADO },
            );
            setLoading(false);
        }
    };

    const offline = notice?.kind === 'offline';

    const form = (
        <>
            {notice ? (
                <AuthAlert
                    nativeID="login-alert"
                    testID="login-alert"
                    title={notice.title}
                    body={notice.body}
                    icon={offline ? 'wifi-off' : 'alert-triangle'}
                />
            ) : null}

            {successMessage ? (
                <AuthAlert
                    variant="ok"
                    title={successMessage}
                    icon="check-circle"
                    testID="login-success"
                />
            ) : null}

            <View
                testID="login-form"
                aria-busy={loading}
                accessibilityDescribedBy={notice ? 'login-alert' : undefined}
                className="mt-[18px] gap-4"
            >
                <AuthTextField
                    label="Correo electrónico"
                    testID="email-input"
                    accessibilityLabel="Correo electrónico"
                    placeholder="tu@ejemplo.com"
                    keyboardType="email-address"
                    autoComplete="email"
                    value={email}
                    off={loading}
                    inputRef={emailRef}
                    error={fieldErrors.email}
                    onChangeText={(text) => {
                        setEmail(text);
                        if (fieldErrors.email) {
                            setFieldErrors((current) => ({ ...current, email: undefined }));
                        }
                    }}
                />

                <AuthTextField
                    label="Contraseña"
                    testID="password-input"
                    accessibilityLabel="Contraseña"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    password={{ toggleMode: 'text' }}
                    value={password}
                    off={loading}
                    inputRef={passwordRef}
                    error={fieldErrors.password}
                    onChangeText={(text) => {
                        setPassword(text);
                        if (fieldErrors.password) {
                            setFieldErrors((current) => ({ ...current, password: undefined }));
                        }
                    }}
                />

                <AuthButton
                    onPress={handleLogin}
                    label={offline ? 'Volver a intentarlo' : 'Iniciar sesión'}
                    loadingLabel="Iniciando sesión…"
                    loading={loading}
                    accessibilityLabel={offline ? 'Volver a intentarlo' : 'Iniciar sesión'}
                    testID="login-button"
                    spinnerTestID="login-spinner"
                />
            </View>

            {loading ? (
                <View role="status" testID="login-status" className="mt-2.5">
                    <Text className="text-center text-[16px] font-sans leading-[1.35] text-ink-2">
                        Comprobando tu correo y tu contraseña. Esto tarda un segundo.
                    </Text>
                </View>
            ) : null}
        </>
    );

    const forgotLink = (
        <AuthLink
            label="¿Has olvidado tu contraseña?"
            onPress={() => router.push('/forgot-password')}
            testID="forgot-password-link"
            className="self-stretch"
        />
    );

    if (isDesktop) {
        return (
            <AuthScreen>
                <View className="flex-1 bg-surface">
                    <View className="h-[72px] flex-row items-center gap-6 border-b border-border bg-surface-container-lowest px-8">
                        <View className="flex-row items-center gap-2.5">
                            <View className="h-[38px] w-[38px] items-center justify-center rounded-[12px] bg-primary-soft">
                                <AppIcon name="gift" size={20} className="text-primary-dark" />
                            </View>
                            <Text className="text-[22px] font-display-extrabold tracking-[-0.02em] text-ink">
                                Muro de Deseos
                            </Text>
                        </View>

                        <View className="ml-auto flex-row items-center gap-2.5">
                            <Text className="text-[17px] font-sans text-ink-2">
                                ¿Primera vez aquí?
                            </Text>
                            <AuthLink
                                label="Crear mi cuenta"
                                onPress={() => router.push('/signup')}
                                testID="register-link"
                            />
                        </View>
                    </View>

                    <View className="w-full max-w-[1180px] flex-1 flex-row items-center gap-16 self-center px-4 py-6">
                        <View className="min-w-0 flex-1">
                            <Text className="text-[40px] font-display-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
                                Regalos sin repetir para la gente que quieres
                            </Text>
                            <Text className="mt-3 max-w-[520px] text-[19px] font-sans leading-[1.45] text-ink-2">
                                Muro de Deseos es tu lista de deseos compartida: apuntas lo que te
                                gustaría recibir y tu familia o tus amigos reservan un regalo para
                                que nadie lo repita.
                            </Text>

                            <View className="mt-[22px] max-w-[540px] gap-3">
                                {PASOS.map((paso, indice) => (
                                    <View
                                        key={paso.texto}
                                        className="flex-row items-center gap-3"
                                    >
                                        <View className="h-[30px] w-[30px] items-center justify-center rounded-full bg-primary-soft">
                                            <Text className="text-[16px] font-sans-bold text-primary-dark">
                                                {indice + 1}
                                            </Text>
                                        </View>
                                        <Text className="flex-1 text-[18px] font-sans leading-[1.35] text-ink">
                                            {paso.texto}
                                        </Text>
                                        <AppIcon
                                            name={paso.icono}
                                            size={22}
                                            className="text-accent"
                                            accessibilityElementsHidden
                                            importantForAccessibility="no"
                                        />
                                    </View>
                                ))}
                            </View>

                            <Text className="mt-4 max-w-[520px] text-[16px] font-sans leading-[1.4] text-ink-2">
                                La misma cuenta sirve en el móvil y aquí: lo que reserves en el
                                ordenador aparece al momento en el teléfono.
                            </Text>
                        </View>

                        <View className="w-[448px] rounded-[20px] border border-border bg-surface-container-lowest p-[26px] shadow-sh-2">
                            <Text className="text-[28px] font-display-extrabold leading-[1.14] tracking-[-0.02em] text-ink">
                                Iniciar sesión
                            </Text>
                            <Text className={SCREEN_SUBTITLE}>
                                Entra para ver tu lista y la de tu gente.
                            </Text>

                            {form}

                            <View className="mt-3">{forgotLink}</View>

                            <Text className="mt-3.5 text-center text-[16px] font-sans leading-[1.4] text-ink-2">
                                Tus deseos y los de tu familia siguen donde los dejaste.
                            </Text>
                        </View>
                    </View>
                </View>
            </AuthScreen>
        );
    }

    return (
        <AuthScreen>
            <AuthColumn>
                <AuthBackLink label="Volver" onPress={() => router.replace('/')} testID="back-link" />

                <AuthBrand />

                <Text className={SCREEN_TITLE}>Iniciar sesión</Text>
                <Text className={SCREEN_SUBTITLE}>Entra para ver tu lista y la de tu gente.</Text>

                {form}

                <View className="mt-3">{forgotLink}</View>

                <View className="mb-0.5 mt-4 h-px bg-border" />

                <Text className="text-center text-[17px] font-sans leading-[1.3] text-ink-2">
                    ¿No tienes cuenta?
                </Text>

                <View className="mt-[18px]">
                    <AuthButton
                        variant="secondary"
                        label="Crear mi cuenta"
                        onPress={() => router.push('/signup')}
                        testID="register-link"
                    />
                </View>

                <Text className="mt-2.5 text-center text-[16px] font-sans leading-[1.35] text-ink-2">
                    Tus deseos y los de tu familia siguen donde los dejaste.
                </Text>
            </AuthColumn>
        </AuthScreen>
    );
}
