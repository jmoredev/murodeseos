import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignupPage from '@/app/(auth)/signup/index';
import { supabase } from '@/lib/supabase';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// El mock global de expo-router crea un router nuevo en cada llamada; aquí se
// sustituye por uno cuyas llamadas se pueden observar.
const routerMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('expo-router', () => ({
    Link: ({ children }: any) => children,
    useRouter: () => ({
        push: routerMocks.push,
        replace: routerMocks.replace,
        back: vi.fn(),
        setParams: vi.fn(),
    }),
    useFocusEffect: vi.fn(),
    useSegments: () => [],
    usePathname: () => '/',
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
}));

async function rellenarAlta() {
    render(<SignupPage />);

    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'nueva@ejemplo.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'nueva1234' } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'nueva1234' } });
    fireEvent.click(screen.getByTestId('signup-button'));

    await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled());
}

describe('SignupPage — destino después del alta', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('con la sesión ya abierta entra directo al alta de perfil, sin pedir la contraseña otra vez', async () => {
        // «Confirm email» apagado: Supabase devuelve la sesión en el propio alta.
        vi.mocked(supabase.auth.signUp).mockResolvedValue({
            data: { session: { access_token: 'token' }, user: { id: 'u1' } },
            error: null,
        } as any);

        await rellenarAlta();

        await waitFor(() => {
            expect(routerMocks.replace).toHaveBeenCalledWith('/profile/setup');
            expect(routerMocks.push).not.toHaveBeenCalled();
        });
    });

    it('sin sesión —el proyecto todavía exige confirmar el correo— vuelve al login con el aviso', async () => {
        vi.mocked(supabase.auth.signUp).mockResolvedValue({
            data: { session: null, user: { id: 'u1' } },
            error: null,
        } as any);

        await rellenarAlta();

        await waitFor(() => {
            expect(routerMocks.push).toHaveBeenCalledWith({
                pathname: '/login',
                params: { registered: 'true' },
            });
            expect(routerMocks.replace).not.toHaveBeenCalled();
        });
    });

    it('con un error del alta no navega a ninguna parte', async () => {
        vi.mocked(supabase.auth.signUp).mockResolvedValue({
            data: { session: null, user: null },
            error: { message: 'Email rate limit exceeded' },
        } as any);

        await rellenarAlta();

        await waitFor(() => {
            expect(screen.getByText(/Email rate limit exceeded/)).toBeInTheDocument();
        });
        expect(routerMocks.push).not.toHaveBeenCalled();
        expect(routerMocks.replace).not.toHaveBeenCalled();
    });
});
