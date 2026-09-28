import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResetPasswordPage from '@/app/(auth)/reset-password/index';
import { supabase } from '@/lib/supabase';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// El mock global de expo-router crea un router nuevo en cada llamada, así que
// aquí se sustituye por uno cuyo `replace` se puede observar.
const routerMocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('expo-router', () => ({
    Link: ({ children }: any) => children,
    useRouter: () => ({ replace: routerMocks.replace, push: vi.fn(), back: vi.fn(), setParams: vi.fn() }),
    useFocusEffect: vi.fn(),
    useSegments: () => [],
    usePathname: () => '/',
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
}));

const session = { access_token: 'token-de-recuperacion' } as any;

describe('ResetPasswordPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as any);
        vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: { user: null }, error: null } as any);
    });

    it('muestra el formulario cuando el enlace dejó una sesión', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as any);

        render(<ResetPasswordPage />);

        expect(await screen.findByTestId('new-password-input')).toBeInTheDocument();
        expect(screen.queryByTestId('reset-link-invalid')).not.toBeInTheDocument();
    });

    it('avisa cuando el enlace no es válido o se abrió en otro dispositivo', async () => {
        render(<ResetPasswordPage />);

        expect(await screen.findByTestId('reset-link-invalid', {}, { timeout: 4000 })).toBeInTheDocument();
        expect(screen.queryByTestId('new-password-input')).not.toBeInTheDocument();
    }, 10000);

    it('cambia la contraseña y entra', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as any);

        render(<ResetPasswordPage />);

        fireEvent.change(await screen.findByTestId('new-password-input'), { target: { value: 'nueva1234' } });
        fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'nueva1234' } });
        fireEvent.click(screen.getByTestId('save-password-button'));

        await waitFor(() => {
            expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'nueva1234' });
            expect(routerMocks.replace).toHaveBeenCalledWith('/');
        });
    });

    it('exige una contraseña mínima', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as any);

        render(<ResetPasswordPage />);

        fireEvent.change(await screen.findByTestId('new-password-input'), { target: { value: 'abc' } });
        fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'abc' } });
        fireEvent.click(screen.getByTestId('save-password-button'));

        expect(await screen.findByTestId('reset-error')).toHaveTextContent('al menos 6 caracteres');
        expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('no acepta dos contraseñas distintas', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as any);

        render(<ResetPasswordPage />);

        fireEvent.change(await screen.findByTestId('new-password-input'), { target: { value: 'nueva1234' } });
        fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'otra1234' } });
        fireEvent.click(screen.getByTestId('save-password-button'));

        expect(await screen.findByTestId('reset-error')).toHaveTextContent('no coinciden');
        expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });
});
