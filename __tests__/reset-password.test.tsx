import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResetPasswordPage from '@/app/(auth)/reset-password/index';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/sign-out';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setViewportWidth } from './auth/viewport';

// El mock global de expo-router crea un router nuevo en cada llamada, así que
// aquí se sustituye por uno cuyo `replace` se puede observar.
const routerMocks = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock('expo-router', () => ({
    Link: ({ children }: any) => children,
    useRouter: () => ({
        replace: routerMocks.replace,
        push: routerMocks.push,
        back: vi.fn(),
        setParams: vi.fn(),
    }),
    useFocusEffect: vi.fn(),
    useSegments: () => [],
    usePathname: () => '/reset-password',
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
}));

vi.mock('@/lib/sign-out', () => ({ signOut: vi.fn(async () => {}) }));

const session = { access_token: 'token-de-recuperacion' } as any;
const anchoOriginal = Object.getOwnPropertyDescriptor(window, 'innerWidth');

function conSesion() {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as any);
}

describe('ResetPasswordPage · una sola contraseña (11 · P10, S4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setViewportWidth(390);
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: null },
            error: null,
        } as any);
        vi.mocked(supabase.auth.updateUser).mockResolvedValue({
            data: { user: null },
            error: null,
        } as any);
    });

    afterEach(() => {
        if (anchoOriginal) Object.defineProperty(window, 'innerWidth', anchoOriginal);
    });

    it('muestra el formulario cuando el enlace dejó una sesión', async () => {
        conSesion();

        render(<ResetPasswordPage />);

        expect(await screen.findByTestId('new-password-input')).toBeInTheDocument();
        expect(screen.queryByTestId('reset-link-invalid')).not.toBeInTheDocument();
    });

    it('pide la contraseña una sola vez: no hay campo de repetición ni error de coincidencia', async () => {
        conSesion();

        render(<ResetPasswordPage />);

        await screen.findByTestId('new-password-input');

        expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument();
        expect(screen.queryByTestId('confirm-password-input')).not.toBeInTheDocument();
        expect(screen.queryByText('Repite la contraseña')).not.toBeInTheDocument();

        fireEvent.change(screen.getByTestId('new-password-input'), {
            target: { value: 'nueva1234' },
        });
        fireEvent.click(screen.getByTestId('save-password-button'));

        await waitFor(() =>
            expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'nueva1234' }),
        );
        expect(screen.queryByText('Las contraseñas no coinciden')).not.toBeInTheDocument();
    });

    it('explica la ayuda del artboard: 8 caracteres y «Mostrar»', async () => {
        conSesion();

        render(<ResetPasswordPage />);

        await screen.findByTestId('new-password-input');

        expect(
            screen.getByText(
                'Al menos 8 caracteres. Pulsa «Mostrar» para comprobar que está bien escrita.',
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'No hace falta escribirla dos veces: con «Mostrar» lo compruebas y no hay dos sitios donde equivocarse.',
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Este enlace sirve solo en este dispositivo, el mismo donde pediste el correo.',
            ),
        ).toBeInTheDocument();
    });

    it('mantiene el mínimo de 8 caracteres junto al campo', async () => {
        conSesion();

        render(<ResetPasswordPage />);

        fireEvent.change(await screen.findByTestId('new-password-input'), {
            target: { value: 'abc' },
        });
        fireEvent.click(screen.getByTestId('save-password-button'));

        expect(await screen.findByTestId('reset-error')).toHaveTextContent(
            'al menos 8 caracteres',
        );
        expect(supabase.auth.updateUser).not.toHaveBeenCalled();
        expect(screen.getByTestId('new-password-input')).toHaveAttribute('aria-invalid', 'true');
    });
});

describe('ResetPasswordPage · contraseña cambiada (11 · P11)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setViewportWidth(390);
        conSesion();
        vi.mocked(supabase.auth.updateUser).mockResolvedValue({
            data: { user: null },
            error: null,
        } as any);
    });

    it('no salta a la lista: muestra «Contraseña cambiada» con sus dos salidas', async () => {
        render(<ResetPasswordPage />);

        fireEvent.change(await screen.findByTestId('new-password-input'), {
            target: { value: 'nueva1234' },
        });
        fireEvent.click(screen.getByTestId('save-password-button'));

        const exito = await screen.findByTestId('password-changed');
        expect(exito).toHaveTextContent('Contraseña cambiada');
        expect(exito).toHaveTextContent(
            'Ya puedes entrar con tu contraseña nueva. Te dejamos dentro, con tu lista y tus grupos como estaban.',
        );
        expect(routerMocks.replace).not.toHaveBeenCalled();
        expect(screen.getByText('Tus listas no cambian')).toBeInTheDocument();
        expect(
            screen.getByText(
                'Los grupos y los regalos que ya habías reservado siguen como estaban.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByTestId('go-to-list-button')).toHaveTextContent('Ir a mi lista');
        expect(screen.getByTestId('sign-out-button')).toHaveTextContent('Cerrar sesión');
    });

    it('«Ir a mi lista» entra en la portada', async () => {
        render(<ResetPasswordPage />);

        fireEvent.change(await screen.findByTestId('new-password-input'), {
            target: { value: 'nueva1234' },
        });
        fireEvent.click(screen.getByTestId('save-password-button'));

        fireEvent.click(await screen.findByTestId('go-to-list-button'));

        expect(routerMocks.replace).toHaveBeenCalledWith('/');
    });

    it('«Cerrar sesión» cierra la sesión y vuelve al acceso', async () => {
        render(<ResetPasswordPage />);

        fireEvent.change(await screen.findByTestId('new-password-input'), {
            target: { value: 'nueva1234' },
        });
        fireEvent.click(screen.getByTestId('save-password-button'));

        fireEvent.click(await screen.findByTestId('sign-out-button'));

        await waitFor(() => expect(signOut).toHaveBeenCalled());
        expect(routerMocks.replace).toHaveBeenCalledWith('/login');
    });

    it('«Cerrar sesión» cuenta lo que está pasando mientras cierra (R3-004)', async () => {
        let liberar: () => void = () => {};
        vi.mocked(signOut).mockReturnValue(
            new Promise<void>((resolve) => {
                liberar = resolve;
            }),
        );

        render(<ResetPasswordPage />);

        fireEvent.change(await screen.findByTestId('new-password-input'), {
            target: { value: 'nueva1234' },
        });
        fireEvent.click(screen.getByTestId('save-password-button'));

        fireEvent.click(await screen.findByTestId('sign-out-button'));

        expect(await screen.findByText('Cerrando sesión…')).toBeInTheDocument();
        expect(screen.getByTestId('sign-out-button')).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByTestId('sign-out-spinner')).toBeInTheDocument();

        // Mientras cierra, volver a pulsar no cierra dos veces.
        fireEvent.click(screen.getByTestId('sign-out-button'));
        expect(signOut).toHaveBeenCalledTimes(1);

        liberar();
        await waitFor(() => expect(routerMocks.replace).toHaveBeenCalledWith('/login'));
    });
});

describe('ResetPasswordPage · fallo al cerrar sesión (11 · P11, R3-004)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setViewportWidth(390);
        conSesion();
        vi.mocked(supabase.auth.updateUser).mockResolvedValue({
            data: { user: null },
            error: null,
        } as any);
        vi.mocked(signOut).mockResolvedValue(undefined);
    });

    async function cambiarContrasena() {
        render(<ResetPasswordPage />);

        fireEvent.change(await screen.findByTestId('new-password-input'), {
            target: { value: 'nueva1234' },
        });
        fireEvent.click(screen.getByTestId('save-password-button'));

        await screen.findByTestId('sign-out-button');
    }

    it('avisa del fallo, se queda en la pantalla y deja reintentar', async () => {
        vi.mocked(signOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));

        await cambiarContrasena();

        fireEvent.click(screen.getByTestId('sign-out-button'));

        const alerta = await screen.findByTestId('sign-out-error');
        expect(alerta).toHaveTextContent('No pudimos cerrar la sesión');
        expect(alerta).toHaveTextContent('Comprueba tu conexión e inténtalo otra vez.');
        expect(routerMocks.replace).not.toHaveBeenCalledWith('/login');
        expect(screen.getByTestId('password-changed')).toBeInTheDocument();

        // El fallo no deja la pantalla bloqueada: el botón vuelve y el reintento entra.
        await waitFor(() =>
            expect(screen.getByTestId('sign-out-button')).toHaveTextContent('Cerrar sesión'),
        );
        fireEvent.click(screen.getByTestId('sign-out-button'));

        await waitFor(() => expect(routerMocks.replace).toHaveBeenCalledWith('/login'));
        expect(signOut).toHaveBeenCalledTimes(2);
    });

    it('un fallo lanzado que no es de red usa el aviso genérico', async () => {
        vi.mocked(signOut).mockRejectedValueOnce(new Error('boom'));

        await cambiarContrasena();

        fireEvent.click(screen.getByTestId('sign-out-button'));

        const alerta = await screen.findByTestId('sign-out-error');
        expect(alerta).toHaveTextContent('No pudimos cerrar la sesión. Inténtalo otra vez.');
        expect(alerta).not.toHaveTextContent('conexión');
        expect(routerMocks.replace).not.toHaveBeenCalledWith('/login');
    });
});

describe('ResetPasswordPage · fallos al guardar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setViewportWidth(390);
        conSesion();
    });

    it('avisa si el guardado devuelve error y no da la contraseña por cambiada', async () => {
        vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
            data: { user: null },
            error: { message: 'no se pudo guardar' },
        } as any);

        render(<ResetPasswordPage />);

        fireEvent.change(await screen.findByTestId('new-password-input'), {
            target: { value: 'nueva1234' },
        });
        fireEvent.click(screen.getByTestId('save-password-button'));

        expect(await screen.findByTestId('reset-error')).toHaveTextContent('no se pudo guardar');
        expect(screen.queryByTestId('password-changed')).not.toBeInTheDocument();
    });

    it('avisa si el guardado lanza y libera el formulario', async () => {
        vi.mocked(supabase.auth.updateUser).mockRejectedValueOnce(new TypeError('Failed to fetch'));

        render(<ResetPasswordPage />);

        fireEvent.change(await screen.findByTestId('new-password-input'), {
            target: { value: 'nueva1234' },
        });
        fireEvent.click(screen.getByTestId('save-password-button'));

        expect(await screen.findByTestId('reset-error')).toHaveTextContent('conexión');
        expect(screen.queryByTestId('password-changed')).not.toBeInTheDocument();

        // El botón vuelve a responder: el fallo lanzado no lo deja bloqueado.
        await waitFor(() =>
            expect(screen.getByTestId('save-password-button')).toHaveTextContent(
                'Guardar contraseña',
            ),
        );
        fireEvent.click(screen.getByTestId('save-password-button'));
        await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalledTimes(2));
    });
});

describe('ResetPasswordPage · enlace caducado (11 · P12)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setViewportWidth(390);
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: null },
            error: null,
        } as any);
    });

    afterEach(() => {
        if (anchoOriginal) Object.defineProperty(window, 'innerWidth', anchoOriginal);
    });

    it('avisa de que caducó y ofrece pedir otro enlace', async () => {
        render(<ResetPasswordPage />);

        expect(
            await screen.findByTestId('reset-link-invalid', {}, { timeout: 4000 }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Este enlace no es válido o ha caducado'),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Los enlaces duran una hora. Pide uno nuevo desde el inicio de sesión y ábrelo en este mismo dispositivo.',
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Si ya pediste el enlace en el ordenador, ábrelo ahí: en el móvil no funcionará.',
            ),
        ).toBeInTheDocument();
        expect(screen.queryByTestId('new-password-input')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('request-new-link-button'));
        expect(routerMocks.replace).toHaveBeenCalledWith('/forgot-password');

        fireEvent.click(screen.getByTestId('back-to-login-button'));
        expect(routerMocks.replace).toHaveBeenCalledWith('/login');
    }, 10000);
});
