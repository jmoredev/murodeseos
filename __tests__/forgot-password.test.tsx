import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ForgotPasswordPage from '@/app/(auth)/forgot-password/index';
import { supabase } from '@/lib/supabase';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setViewportWidth } from './auth/viewport';

const routerMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));

vi.mock('expo-router', () => ({
    Link: ({ children }: any) => children,
    useRouter: () => ({
        push: routerMocks.push,
        replace: routerMocks.replace,
        back: routerMocks.back,
        setParams: vi.fn(),
    }),
    useFocusEffect: vi.fn(),
    useSegments: () => [],
    usePathname: () => '/forgot-password',
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
}));

const anchoOriginal = Object.getOwnPropertyDescriptor(window, 'innerWidth');

const AVISO_LIMITE =
    'Se pidieron demasiados enlaces seguidos';

function pedirEnlace(email = 'lucia.martin@gmail.com') {
    fireEvent.change(screen.getByTestId('forgot-email-input'), { target: { value: email } });
    fireEvent.click(screen.getByTestId('send-recovery-button'));
}

beforeEach(() => {
    vi.clearAllMocks();
    setViewportWidth(390);
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: {}, error: null } as any);
});

afterEach(() => {
    if (anchoOriginal) Object.defineProperty(window, 'innerWidth', anchoOriginal);
});

describe('recuperar contraseña (11 · P7)', () => {
    it('explica para qué es el correo y promete la misma respuesta exista o no la cuenta', () => {
        render(<ForgotPasswordPage />);

        expect(screen.getByText('Recuperar contraseña')).toBeInTheDocument();
        expect(
            screen.getByText(
                'Escribe tu correo y te mandamos un enlace para elegir una contraseña nueva.',
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Solo puede ser el correo con el que entras en Muro de Deseos.'),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Te contestaremos lo mismo tanto si ese correo tiene cuenta como si no. Así nadie puede averiguar quién está en la app.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
    });

    it('pide el correo antes de enviar nada', () => {
        render(<ForgotPasswordPage />);

        fireEvent.click(screen.getByTestId('send-recovery-button'));

        expect(screen.getByText('Escribe tu correo electrónico')).toBeInTheDocument();
        expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
        expect(screen.getByTestId('forgot-email-input')).toHaveAttribute('aria-invalid', 'true');
    });

    it('no envía nada con un correo mal escrito', () => {
        render(<ForgotPasswordPage />);

        pedirEnlace('no-es-un-correo');

        expect(
            screen.getByText('Por favor, introduce un correo electrónico válido'),
        ).toBeInTheDocument();
        expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it('envía el enlace al sitio y pasa a «Te hemos enviado un correo» (11 · P8)', async () => {
        render(<ForgotPasswordPage />);

        pedirEnlace();

        await waitFor(() =>
            expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
                'lucia.martin@gmail.com',
                expect.objectContaining({ redirectTo: expect.stringMatching(/\/reset-password$/) }),
            ),
        );
        expect(routerMocks.replace).toHaveBeenCalledWith({
            pathname: '/recovery-sent',
            params: { email: 'lucia.martin@gmail.com' },
        });
    });

    it('«Enviar enlace» cuenta lo que está pasando mientras trabaja', async () => {
        let resolver: (valor: unknown) => void = () => {};
        vi.mocked(supabase.auth.resetPasswordForEmail).mockReturnValue(
            new Promise((resolve) => {
                resolver = resolve;
            }) as any,
        );

        render(<ForgotPasswordPage />);

        pedirEnlace();

        expect(await screen.findByText('Enviando…')).toBeInTheDocument();
        expect(screen.getByTestId('forgot-form')).toHaveAttribute('aria-busy', 'true');

        resolver({ data: {}, error: null });
        await waitFor(() => expect(routerMocks.replace).toHaveBeenCalled());
    });
});

describe('recuperar contraseña · demasiados enlaces (11 · P9)', () => {
    it('explica el límite y deja el botón sin efecto', async () => {
        vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
            data: {},
            error: { status: 429, code: 'over_email_send_rate_limit', message: 'rate limit' },
        } as any);

        render(<ForgotPasswordPage />);

        pedirEnlace();

        const alerta = await screen.findByTestId('forgot-alert');
        expect(alerta).toHaveTextContent(AVISO_LIMITE);
        expect(alerta).toHaveTextContent(
            'Espera unos minutos e inténtalo otra vez. No hace falta pedir uno nuevo ahora.',
        );
        expect(
            screen.getByText(
                'Cuando pasen unos minutos, vuelve a intentarlo. Si te acuerdas de la contraseña, entra con ella.',
            ),
        ).toBeInTheDocument();
        expect(routerMocks.replace).not.toHaveBeenCalled();

        // El límite se respeta: volver a pulsar no vuelve a pedir el enlace.
        expect(screen.getByTestId('send-recovery-button')).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(screen.getByTestId('send-recovery-button'));
        expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    });
});

describe('recuperar contraseña · fallos que no son el límite', () => {
    it('avisa de un error devuelto y deja volver a intentarlo', async () => {
        vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
            data: {},
            error: { status: 500, code: 'unexpected_failure', message: 'boom' },
        } as any);

        render(<ForgotPasswordPage />);

        pedirEnlace();

        expect(await screen.findByTestId('forgot-alert')).toHaveTextContent(
            'No pudimos enviar el enlace',
        );
        expect(routerMocks.replace).not.toHaveBeenCalled();
        expect(screen.getByTestId('send-recovery-button')).not.toHaveAttribute(
            'aria-disabled',
            'true',
        );
    });

    it('avisa si el envío lanza y libera el botón', async () => {
        vi.mocked(supabase.auth.resetPasswordForEmail).mockRejectedValueOnce(
            new TypeError('Failed to fetch'),
        );

        render(<ForgotPasswordPage />);

        pedirEnlace();

        expect(await screen.findByTestId('forgot-alert')).toHaveTextContent('conexión');

        // El botón vuelve a responder: un fallo lanzado no lo deja bloqueado.
        await waitFor(() =>
            expect(screen.getByTestId('send-recovery-button')).toHaveTextContent('Enviar enlace'),
        );
        fireEvent.click(screen.getByTestId('send-recovery-button'));
        await waitFor(() =>
            expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(2),
        );
    });
});

describe('recuperar contraseña · fallos lanzados (11 · P7, R3-002)', () => {
    it('solo un fallo de red habla de la conexión', async () => {
        vi.mocked(supabase.auth.resetPasswordForEmail).mockRejectedValueOnce(
            new TypeError('Failed to fetch'),
        );

        render(<ForgotPasswordPage />);

        pedirEnlace();

        const alerta = await screen.findByTestId('forgot-alert');
        expect(alerta).toHaveTextContent('No pudimos enviar el enlace');
        expect(alerta).toHaveTextContent('Comprueba tu conexión e inténtalo otra vez.');
        expect(routerMocks.replace).not.toHaveBeenCalled();
    });

    it('un fallo lanzado que no es de red usa el aviso genérico, sin hablar de la conexión', async () => {
        vi.mocked(supabase.auth.resetPasswordForEmail).mockRejectedValueOnce(
            new Error('boom'),
        );

        render(<ForgotPasswordPage />);

        pedirEnlace();

        const alerta = await screen.findByTestId('forgot-alert');
        expect(alerta).toHaveTextContent('No pudimos enviar el enlace');
        expect(alerta).toHaveTextContent('Inténtalo otra vez en unos minutos.');
        expect(alerta).not.toHaveTextContent('conexión');
        expect(routerMocks.replace).not.toHaveBeenCalled();
    });
});

describe('recuperar contraseña · salir mientras envía (11 · P7, R3-001)', () => {
    function envioEnVuelo() {
        let resolver: (valor: unknown) => void = () => {};
        vi.mocked(supabase.auth.resetPasswordForEmail).mockReturnValue(
            new Promise((resolve) => {
                resolver = resolve;
            }) as any,
        );
        return { resolver: (valor: unknown) => resolver(valor) };
    }

    it('mientras envía, «Iniciar sesión» está apagado y no se lleva de la pantalla', async () => {
        const envio = envioEnVuelo();

        render(<ForgotPasswordPage />);

        pedirEnlace();
        await screen.findByText('Enviando…');

        expect(screen.getByTestId('back-to-login-guard')).toHaveAttribute('aria-hidden', 'true');
        fireEvent.click(screen.getByTestId('back-to-login-link'));
        expect(routerMocks.replace).not.toHaveBeenCalledWith('/login');

        envio.resolver({ data: {}, error: null });
        await waitFor(() =>
            expect(routerMocks.replace).toHaveBeenCalledWith({
                pathname: '/recovery-sent',
                params: { email: 'lucia.martin@gmail.com' },
            }),
        );
        expect(routerMocks.replace).not.toHaveBeenCalledWith('/login');
    });

    it('en reposo «Iniciar sesión» sigue llevando al acceso', () => {
        render(<ForgotPasswordPage />);

        expect(screen.getByTestId('back-to-login-guard')).not.toHaveAttribute(
            'aria-hidden',
            'true',
        );
        fireEvent.click(screen.getByTestId('back-to-login-link'));
        expect(routerMocks.replace).toHaveBeenCalledWith('/login');
    });

    it('si se sale de la pantalla mientras envía, el resultado que llega después no navega', async () => {
        const envio = envioEnVuelo();

        const { unmount } = render(<ForgotPasswordPage />);

        pedirEnlace();
        await screen.findByText('Enviando…');

        unmount();
        envio.resolver({ data: {}, error: null });
        await new Promise((listo) => setTimeout(listo, 0));

        expect(routerMocks.replace).not.toHaveBeenCalled();
    });
});
