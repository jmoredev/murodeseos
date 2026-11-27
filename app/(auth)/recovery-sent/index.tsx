import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getSiteBaseUrl } from '@/lib/site-url';
import { AppIcon } from '@/components/ui/AppIcon';
import { AuthAlert } from '@/components/auth/AuthAlert';
import { AuthBackLink } from '@/components/auth/AuthBackLink';
import { AuthButton } from '@/components/auth/AuthButton';
import { AuthColumn, AuthScreen } from '@/components/auth/AuthScreen';
import { SCREEN_SUBTITLE, SCREEN_TITLE } from '@/components/auth/styles';

/**
 * «Te hemos enviado un correo» (`11-acceso.html`, P8): la confirmación que no
 * revela si el correo tiene cuenta, con el correo a la vista por si se escribió
 * mal, y el reenvío.
 *
 * `Enviar otra vez` respeta el 429 de P9: cuando el servidor dice que se han
 * pedido demasiados enlaces seguidos, el botón deja de tener efecto y el aviso
 * explica qué hacer.
 */

const DEMASIADOS_ENLACES = {
    title: 'Se pidieron demasiados enlaces seguidos',
    body: 'Espera unos minutos e inténtalo otra vez. No hace falta pedir uno nuevo ahora.',
};

type ResendState = 'idle' | 'sending' | 'sent' | 'limited';

export default function RecoverySentPage() {
    const router = useRouter();
    const params = useLocalSearchParams<{ email?: string }>();
    const email = typeof params.email === 'string' ? params.email : '';

    const [resendState, setResendState] = useState<ResendState>('idle');
    const [resendError, setResendError] = useState('');

    const limited = resendState === 'limited';
    const sending = resendState === 'sending';

    const handleResend = async () => {
        if (sending || limited) return;

        // Sin correo (llegada directa a la ruta) no hay a quién reenviar: se vuelve
        // a la pantalla donde se escribe.
        if (!email) {
            router.replace('/forgot-password');
            return;
        }

        setResendError('');
        setResendState('sending');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${getSiteBaseUrl()}/reset-password`,
            });

            if (error) {
                if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
                    setResendState('limited');
                    return;
                }

                setResendState('idle');
                setResendError('No pudimos enviar el enlace. Inténtalo otra vez en unos minutos.');
                return;
            }

            setResendState('sent');
        } catch {
            setResendState('idle');
            setResendError('No pudimos enviar el enlace. Comprueba tu conexión e inténtalo otra vez.');
        }
    };

    return (
        <AuthScreen>
            <AuthColumn>
                <AuthBackLink
                    label="Iniciar sesión"
                    onPress={() => router.replace('/login')}
                    testID="back-to-login-link"
                />

                <View role="status" testID="recovery-sent" className="mt-6 items-center">
                    <View className="h-[76px] w-[76px] items-center justify-center rounded-full border-2 border-accent-line bg-accent-soft">
                        <AppIcon
                            name="mail"
                            size={38}
                            className="text-accent-ink"
                            accessibilityElementsHidden
                            importantForAccessibility="no"
                        />
                    </View>

                    <Text className={`${SCREEN_TITLE} mt-4 text-center`}>
                        Te hemos enviado un correo
                    </Text>
                    <Text
                        testID="recovery-sent-message"
                        className={`${SCREEN_SUBTITLE} max-w-[320px] text-center`}
                    >
                        Si este correo tiene cuenta, te enviamos un enlace para restablecer la
                        contraseña. Ábrelo en este mismo dispositivo.
                    </Text>

                    {email ? (
                        <View
                            testID="recovery-email-chip"
                            className="mt-3.5 flex-row items-center gap-[7px] rounded-full border-[1.5px] border-border-strong bg-surface-container-lowest px-3 py-1.5"
                        >
                            <AppIcon
                                name="mail"
                                size={19}
                                className="text-ink-2"
                                accessibilityElementsHidden
                                importantForAccessibility="no"
                            />
                            <Text className="text-[17px] font-sans-bold text-ink">{email}</Text>
                        </View>
                    ) : null}
                </View>

                {limited ? <AuthAlert testID="resend-alert" {...DEMASIADOS_ENLACES} /> : null}

                {resendError ? (
                    <AuthAlert testID="resend-error" title={resendError} />
                ) : null}

                {resendState === 'sent' ? (
                    <AuthAlert
                        testID="resend-confirmation"
                        variant="ok"
                        icon="check-circle"
                        title="Te hemos enviado otro correo."
                    />
                ) : null}

                <View className="mt-[18px] gap-2.5">
                    <AuthButton
                        label="Volver a iniciar sesión"
                        onPress={() => router.replace('/login')}
                        testID="back-to-login-button"
                    />
                    <AuthButton
                        variant="secondary"
                        label="Enviar otra vez"
                        loadingLabel="Enviando…"
                        loading={sending}
                        disabled={limited}
                        onPress={handleResend}
                        testID="resend-button"
                        spinnerTestID="resend-spinner"
                    />
                </View>

                <View className="mt-3.5 flex-row items-start gap-[9px] rounded-[14px] bg-primary-soft px-3 py-2.5">
                    <AppIcon
                        name="key"
                        size={20}
                        className="mt-px text-primary-dark"
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                    />
                    <Text className="flex-1 text-[17px] font-sans leading-[1.35] text-ink">
                        El enlace caduca en una hora. Si no lo ves, mira en la carpeta de spam antes
                        de pedir otro.
                    </Text>
                </View>
            </AuthColumn>
        </AuthScreen>
    );
}
