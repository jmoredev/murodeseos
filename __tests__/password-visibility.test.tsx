import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginPage from '@/app/(auth)/login/index';
import SignupPage from '@/app/(auth)/signup/index';
import ResetPasswordPage from '@/app/(auth)/reset-password/index';
import { supabase } from '@/lib/supabase';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const session = { access_token: 'token-de-recuperacion' } as any;

/** Cada campo de contraseña de la app, con la pantalla que lo renderiza. */
const CAMPOS = [
    { pantalla: 'login', testID: 'password-input', pagina: () => <LoginPage /> },
    { pantalla: 'alta', testID: 'password-input', pagina: () => <SignupPage /> },
    { pantalla: 'alta', testID: 'confirm-password-input', pagina: () => <SignupPage /> },
    { pantalla: 'recuperación', testID: 'new-password-input', pagina: () => <ResetPasswordPage /> },
    { pantalla: 'recuperación', testID: 'confirm-password-input', pagina: () => <ResetPasswordPage /> },
];

describe('contraseñas: el ojo muestra lo que se escribe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as any);
    });

    for (const campo of CAMPOS) {
        it(`${campo.pantalla} · ${campo.testID}: oculta por defecto y alterna con el ojo`, async () => {
            render(campo.pagina());

            const input = await screen.findByTestId(campo.testID);
            expect(input).toHaveAttribute('type', 'password');

            const ojo = screen.getByTestId(`${campo.testID}-toggle`);
            expect(ojo).toHaveAttribute('aria-label', 'Mostrar contraseña');

            // react-native-web quita el atributo `type` cuando el campo deja de
            // ser `password`: el navegador asume texto por defecto.
            fireEvent.click(ojo);
            expect(input).not.toHaveAttribute('type', 'password');
            expect(ojo).toHaveAttribute('aria-label', 'Ocultar contraseña');

            fireEvent.click(ojo);
            expect(input).toHaveAttribute('type', 'password');
            expect(ojo).toHaveAttribute('aria-label', 'Mostrar contraseña');
        });
    }

    it('cada ojo descubre sólo su propio campo', async () => {
        render(<SignupPage />);

        const password = await screen.findByTestId('password-input');
        const confirmPassword = screen.getByTestId('confirm-password-input');

        fireEvent.click(screen.getByTestId('password-input-toggle'));

        expect(password).not.toHaveAttribute('type', 'password');
        expect(confirmPassword).toHaveAttribute('type', 'password');
    });
});
