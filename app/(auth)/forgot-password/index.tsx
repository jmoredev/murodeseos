import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getSiteBaseUrl } from '@/lib/site-url';
import { AppIcon } from '@/components/ui/AppIcon';
import { AuthAlert } from '@/components/auth/AuthAlert';
import { AuthBackLink } from '@/components/auth/AuthBackLink';
import { AuthButton } from '@/components/auth/AuthButton';
import { AuthColumn, AuthScreen } from '@/components/auth/AuthScreen';
import { AuthTextField } from '@/components/auth/AuthTextField';
import { isOfflineError } from '@/components/auth/errors';
import { SCREEN_SUBTITLE, SCREEN_TITLE } from '@/components/auth/styles';

/**
 * Recuperar contraseña como pantalla propia (`11-acceso.html`, P7 y P9): el
 * enlace por correo y el caso de haber pedido demasiados seguidos.
 *
 * Responde lo mismo exista o no la cuenta —lo hace Supabase y lo dice la nota
 * de la pantalla— y sigue enviando lo mismo que antes: el mismo
 * `resetPasswordForEmail` con el mismo `redirectTo` (S9: no cambia la API).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEMASIADOS_ENLACES = {
    title: 'Se pidieron demasiados enlaces seguidos',
    body: 'Espera unos minutos e inténtalo otra vez. No hace falta pedir uno nuevo ahora.',
};

const FALLO_AL_ENVIAR = {
    title: 'No pudimos enviar el enlace',
    body: 'Inténtalo otra vez en unos minutos. Lo que has escrito sigue aquí.',
};

const FALLO_SIN_CONEXION = {
    title: 'No pudimos enviar el enlace',
    body: 'Comprueba tu conexión e inténtalo otra vez. Lo que has escrito sigue aquí.',
};

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState<{ title: string; body?: string } | null>(null);
    const [sending, setSending] = useState(false);
    // 429: el servidor ya no acepta más enlaces por ahora, así que el botón deja
    // de tener efecto hasta que se vuelva a entrar en la pantalla.
    const [limited, setLimited] = useState(false);
    // La pantalla puede desaparecer mientras el envío está en vuelo (se vuelve al
    // acceso, se cierra la pestaña): lo que llegue después no navega ni escribe
    // estado en una pantalla que ya no existe.
    const mountedRef = useRef(true);

    useEffect(
        () => () => {
            mountedRef.current = false;
        },
        [],
    );

    const handleSubmit = async () => {
        if (limited || sending) return;

        setNotice(null);

        if (!email.trim()) {
            setError('Escribe tu correo electrónico');
            return;
        }
        if (!EMAIL_RE.test(email)) {
            setError('Por favor, introduce un correo electrónico válido');
            return;
        }

        setError('');
        setSending(true);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${getSiteBaseUrl()}/reset-password`,
            });

            if (!mountedRef.current) return;

            // Supabase responde correctamente aunque la cuenta no exista, así que un
            // error devuelto es un fallo real y se puede contar sin revelar nada; el
            // mensaje neutro se reserva para la respuesta correcta.
            if (resetError) {
                if (
                    resetError.status === 429 ||
                    resetError.code === 'over_email_send_rate_limit'
                ) {
                    setLimited(true);
                    setNotice(DEMASIADOS_ENLACES);
                } else {
                    setNotice(FALLO_AL_ENVIAR);
                }
                return;
            }

            router.replace({ pathname: '/recovery-sent', params: { email } });
        } catch (thrown) {
            // Un fallo lanzado (la red caída, por ejemplo) no puede dejar el botón
            // bloqueado; y solo el fallo de red habla de la conexión: cualquier otro
            // se cuenta con el aviso genérico, que es lo que se sabe (`R3-002`).
            if (!mountedRef.current) return;
            setNotice(isOfflineError(thrown) ? FALLO_SIN_CONEXION : FALLO_AL_ENVIAR);
        } finally {
            if (mountedRef.current) setSending(false);
        }
    };

    // Mientras el envío está en vuelo, «Iniciar sesión» queda apagado, como el
    // `.ac-back-off` de P3 en el artboard: si se pudiera tocar, la respuesta que
    // llega después cambiaría la pantalla a la que el usuario acaba de irse
    // (`R3-001`). `inert` es de web, como en el velo del tour; en nativo basta con
    // el guardia del manejador y `pointerEvents`.
    const backProps =
        sending && Platform.OS === 'web'
            ? ({ inert: true } as unknown as Record<string, unknown>)
            : {};

    return (
        <AuthScreen>
            <AuthColumn>
                <View
                    testID="back-to-login-guard"
                    aria-hidden={sending || undefined}
                    pointerEvents={sending ? 'none' : 'auto'}
                    className={sending ? 'opacity-45' : ''}
                    {...backProps}
                >
                    <AuthBackLink
                        label="Iniciar sesión"
                        onPress={() => {
                            if (sending) return;
                            router.replace('/login');
                        }}
                        testID="back-to-login-link"
                    />
                </View>

                <Text className={`${SCREEN_TITLE} mt-2`}>Recuperar contraseña</Text>
                <Text className={SCREEN_SUBTITLE}>
                    Escribe tu correo y te mandamos un enlace para elegir una contraseña nueva.
                </Text>

                {notice ? (
                    <AuthAlert
                        nativeID="forgot-alert"
                        testID="forgot-alert"
                        title={notice.title}
                        body={notice.body}
                    />
                ) : null}

                <View
                    testID="forgot-form"
                    aria-busy={sending}
                    accessibilityDescribedBy={notice ? 'forgot-alert' : undefined}
                    className="mt-[18px] gap-4"
                >
                    <AuthTextField
                        label="Correo electrónico"
                        testID="forgot-email-input"
                        accessibilityLabel="Correo electrónico"
                        placeholder="tu@ejemplo.com"
                        keyboardType="email-address"
                        autoComplete="email"
                        value={email}
                        off={sending}
                        error={error || undefined}
                        hint="Solo puede ser el correo con el que entras en Muro de Deseos."
                        hintIcon="mail"
                        onChangeText={(text) => {
                            setEmail(text);
                            if (error) setError('');
                        }}
                    />

                    <AuthButton
                        onPress={handleSubmit}
                        label="Enviar enlace"
                        loadingLabel="Enviando…"
                        loading={sending}
                        disabled={limited}
                        testID="send-recovery-button"
                        spinnerTestID="send-recovery-spinner"
                    />
                </View>

                {limited ? (
                    <Text className="mt-2.5 text-center text-[16px] font-sans leading-[1.35] text-ink-2">
                        Cuando pasen unos minutos, vuelve a intentarlo. Si te acuerdas de la
                        contraseña, entra con ella.
                    </Text>
                ) : null}

                <View className="mt-3.5 flex-row items-start gap-[9px] rounded-[14px] bg-primary-soft px-3 py-2.5">
                    <AppIcon
                        name="info"
                        size={20}
                        className="mt-px text-primary-dark"
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                    />
                    <Text className="flex-1 text-[17px] font-sans leading-[1.35] text-ink">
                        Te contestaremos lo mismo tanto si ese correo tiene cuenta como si no. Así
                        nadie puede averiguar quién está en la app.
                    </Text>
                </View>
            </AuthColumn>
        </AuthScreen>
    );
}
