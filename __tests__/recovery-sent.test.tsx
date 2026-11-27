import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecoverySentPage from '@/app/(auth)/recovery-sent/index';
import { supabase } from '@/lib/supabase';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setViewportWidth } from './auth/viewport';

const routerMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
const searchParams = vi.hoisted(() => ({ current: {} as Record<string, string> }));

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
    usePathname: () => '/recovery-sent',
    useLocalSearchParams: () => searchParams.current,
    useGlobalSearchParams: () => searchParams.current,
}));

const anchoOriginal = Object.getOwnPropertyDescriptor(window, 'innerWidth');

beforeEach(() => {
    vi.clearAllMocks();
    setViewportWidth(390);
    searchParams.current = { email: 'lucia.martin@gmail.com' };
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: {}, error: null } as any);
});

afterEach(() => {
    if (anchoOriginal) Object.defineProperty(window, 'innerWidth', anchoOriginal);
});

describe('te hemos enviado un correo (11 · P8)', () => {
    it('dice lo mismo exista o no la cuenta y muestra el correo al que fue', () => {
        render(<RecoverySentPage />);

        expect(screen.getByText('Te hemos enviado un correo')).toBeInTheDocument();
        expect(
            screen.getByText(
                'Si este correo tiene cuenta, te enviamos un enlace para restablecer la contraseña. Ábrelo en este mismo dispositivo.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByTestId('recovery-email-chip')).toHaveTextContent(
            'lucia.martin@gmail.com',
        );
        expect(screen.getByTestId('back-to-login-button')).toHaveTextContent(
            'Volver a iniciar sesión',
        );
        expect(screen.getByTestId('resend-button')).toHaveTextContent('Enviar otra vez');
        expect(
            screen.getByText(
                'El enlace caduca en una hora. Si no lo ves, mira en la carpeta de spam antes de pedir otro.',
            ),
        ).toBeInTheDocument();
    });

    it('«Volver a iniciar sesión» vuelve al acceso', () => {
        render(<RecoverySentPage />);

        fireEvent.click(screen.getByTestId('back-to-login-button'));

        expect(routerMocks.replace).toHaveBeenCalledWith('/login');
    });

    it('«Enviar otra vez» pide un enlace nuevo al mismo correo', async () => {
        render(<RecoverySentPage />);

        fireEvent.click(screen.getByTestId('resend-button'));

        await waitFor(() =>
            expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
                'lucia.martin@gmail.com',
                expect.objectContaining({ redirectTo: expect.stringMatching(/\/reset-password$/) }),
            ),
        );
        expect(await screen.findByTestId('resend-confirmation')).toHaveTextContent(
            'Te hemos enviado otro correo.',
        );
    });

    it('el reenvío cuenta lo que está pasando mientras trabaja', async () => {
        let resolver: (valor: unknown) => void = () => {};
        vi.mocked(supabase.auth.resetPasswordForEmail).mockReturnValue(
            new Promise((resolve) => {
                resolver = resolve;
            }) as any,
        );

        render(<RecoverySentPage />);

        fireEvent.click(screen.getByTestId('resend-button'));

        expect(await screen.findByText('Enviando…')).toBeInTheDocument();
        expect(screen.getByTestId('resend-button')).toHaveAttribute('aria-disabled', 'true');

        resolver({ data: {}, error: null });
        await waitFor(() =>
            expect(screen.getByTestId('resend-button')).toHaveTextContent('Enviar otra vez'),
        );
    });

    it('respeta el límite de enlaces: tras un 429 deja de ofrecer «Enviar otra vez»', async () => {
        vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
            data: {},
            error: { status: 429, code: 'over_email_send_rate_limit', message: 'rate limit' },
        } as any);

        render(<RecoverySentPage />);

        fireEvent.click(screen.getByTestId('resend-button'));

        const alerta = await screen.findByTestId('resend-alert');
        expect(alerta).toHaveTextContent('Se pidieron demasiados enlaces seguidos');
        expect(alerta).toHaveTextContent(
            'Espera unos minutos e inténtalo otra vez. No hace falta pedir uno nuevo ahora.',
        );
        expect(screen.getByTestId('resend-button')).toHaveAttribute('aria-disabled', 'true');

        fireEvent.click(screen.getByTestId('resend-button'));
        expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    });

    it('sin correo (llegada directa) reenvía llevando a pedirlo otra vez', () => {
        searchParams.current = {};

        render(<RecoverySentPage />);

        expect(screen.queryByTestId('recovery-email-chip')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('resend-button'));

        expect(routerMocks.replace).toHaveBeenCalledWith('/forgot-password');
        expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    });
});
