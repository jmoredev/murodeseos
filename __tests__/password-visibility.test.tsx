import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginPage from '@/app/(auth)/login/index';
import SignupPage from '@/app/(auth)/signup/index';
import ResetPasswordPage from '@/app/(auth)/reset-password/index';
import { supabase } from '@/lib/supabase';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const session = { access_token: 'token-de-recuperacion' } as any;

/**
 * Cada campo de contraseña de la app, con la pantalla que lo renderiza y la
 * forma del control que lo descubre: el ojo de siempre en el alta (S9: el alta
 * no cambia) y el «Mostrar» de texto en el acceso y la contraseña nueva
 * (`11-acceso.html · .ac-show`).
 */
const CAMPOS = [
    { pantalla: 'login', testID: 'password-input', control: 'text', pagina: () => <LoginPage /> },
    { pantalla: 'alta', testID: 'password-input', control: 'icon', pagina: () => <SignupPage /> },
    {
        pantalla: 'alta',
        testID: 'confirm-password-input',
        control: 'icon',
        pagina: () => <SignupPage />,
    },
    {
        pantalla: 'recuperación',
        testID: 'new-password-input',
        control: 'text',
        pagina: () => <ResetPasswordPage />,
    },
];

describe('contraseñas: el control muestra lo que se escribe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as any);
    });

    for (const campo of CAMPOS) {
        it(`${campo.pantalla} · ${campo.testID}: oculta por defecto y alterna`, async () => {
            render(campo.pagina());

            const input = await screen.findByTestId(campo.testID);
            expect(input).toHaveAttribute('type', 'password');

            const control = screen.getByTestId(`${campo.testID}-toggle`);
            expect(control).toHaveAttribute('aria-label', 'Mostrar contraseña');

            // react-native-web quita el atributo `type` cuando el campo deja de
            // ser `password`: el navegador asume texto por defecto.
            fireEvent.click(control);
            expect(input).not.toHaveAttribute('type', 'password');
            expect(control).toHaveAttribute('aria-label', 'Ocultar contraseña');

            fireEvent.click(control);
            expect(input).toHaveAttribute('type', 'password');
            expect(control).toHaveAttribute('aria-label', 'Mostrar contraseña');
        });
    }

    it('el acceso y la contraseña nueva dicen «Mostrar» y «Ocultar» con texto', async () => {
        for (const campo of CAMPOS.filter((c) => c.control === 'text')) {
            const { unmount } = render(campo.pagina());

            const control = await screen.findByTestId(`${campo.testID}-toggle`);
            expect(control).toHaveTextContent('Mostrar');

            fireEvent.click(control);
            expect(control).toHaveTextContent('Ocultar');

            unmount();
        }
    });

    it('el alta conserva el ojo: su control no lleva texto (S9)', async () => {
        render(<SignupPage />);

        const ojo = await screen.findByTestId('password-input-toggle');

        // El mock de Feather pinta el nombre del glifo, no su dibujo: lo que se
        // comprueba es que el control NO lleva la palabra del artboard.
        expect(ojo).not.toHaveTextContent('Mostrar');
        expect(screen.queryByText('Mostrar')).not.toBeInTheDocument();
    });

    it('cada ojo descubre sólo su propio campo', async () => {
        render(<SignupPage />);

        const password = await screen.findByTestId('password-input');
        const confirmPassword = screen.getByTestId('confirm-password-input');

        fireEvent.click(screen.getByTestId('password-input-toggle'));

        expect(password).not.toHaveAttribute('type', 'password');
        expect(confirmPassword).toHaveAttribute('type', 'password');
    });
});
