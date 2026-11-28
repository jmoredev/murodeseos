import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginPage from '@/app/(auth)/login/index';
import { supabase } from '@/lib/supabase';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setViewportWidth } from './auth/viewport';

// El mock global de expo-router crea un router nuevo en cada llamada; aquí se
// sustituye por uno cuyas llamadas se pueden observar (y por unos parámetros de
// URL que cada prueba puede fijar).
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
    usePathname: () => '/login',
    useLocalSearchParams: () => searchParams.current,
    useGlobalSearchParams: () => searchParams.current,
}));

const anchoOriginal = Object.getOwnPropertyDescriptor(window, 'innerWidth');

const CREDENCIALES_OK = {
    data: { user: { id: 'u1', email: 'lucia.martin@gmail.com' } },
    error: null,
};

/** Rellena los dos campos con datos válidos. */
function rellenar(email = 'lucia.martin@gmail.com', password = 'Muro2026lucia') {
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: email } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: password } });
}

beforeEach(() => {
    vi.clearAllMocks();
    searchParams.current = {};
    // El alta de perfil se resuelve como «sin nombre» para poder observar la
    // navegación de un acceso correcto: el resto de pruebas no llega ahí.
    (supabase.auth as any).refreshSession = vi.fn(async () => ({ data: {}, error: null }));
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(CREDENCIALES_OK as any);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as any);
});

afterEach(() => {
    if (anchoOriginal) Object.defineProperty(window, 'innerWidth', anchoOriginal);
});

describe('acceso · iniciar sesión (11 · P1)', () => {
    it('en el móvil: «Volver», la marca, el título y el pie con «Crear mi cuenta»', () => {
        setViewportWidth(390);

        render(<LoginPage />);

        expect(screen.getByText('Volver')).toBeInTheDocument();
        expect(screen.getByText('Listas de deseos compartidas')).toBeInTheDocument();
        expect(screen.getByText('Entra para ver tu lista y la de tu gente.')).toBeInTheDocument();
        expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
        expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
        expect(screen.getByTestId('login-button')).toHaveTextContent('Iniciar sesión');
        expect(screen.getByText('¿No tienes cuenta?')).toBeInTheDocument();
        expect(screen.getByTestId('register-link')).toHaveTextContent('Crear mi cuenta');
        expect(
            screen.getByText('Tus deseos y los de tu familia siguen donde los dejaste.'),
        ).toBeInTheDocument();
    });

    it('en el escritorio reparte explicación y formulario en dos columnas', () => {
        setViewportWidth(1280);

        render(<LoginPage />);

        expect(
            screen.getByText('Regalos sin repetir para la gente que quieres'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Apunta lo que te gustaría recibir.'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Compártelo con tu familia o amigos en un grupo.'),
        ).toBeInTheDocument();
        expect(screen.getByText('Ellos reservan un regalo y nadie lo repite.')).toBeInTheDocument();
        expect(screen.getByText('¿Primera vez aquí?')).toBeInTheDocument();
        expect(screen.getByTestId('email-input')).toBeInTheDocument();
        expect(screen.getByTestId('login-button')).toBeInTheDocument();
        expect(
            screen.getByText('Tus deseos y los de tu familia siguen donde los dejaste.'),
        ).toBeInTheDocument();
    });

    it('lleva a «Crear mi cuenta» y a «¿Has olvidado tu contraseña?»', () => {
        setViewportWidth(390);

        render(<LoginPage />);

        fireEvent.click(screen.getByTestId('register-link'));
        expect(routerMocks.push).toHaveBeenCalledWith('/signup');

        fireEvent.click(screen.getByTestId('forgot-password-link'));
        expect(routerMocks.push).toHaveBeenCalledWith('/forgot-password');
    });

    it('«Volver» regresa a la portada', () => {
        setViewportWidth(390);

        render(<LoginPage />);

        fireEvent.click(screen.getByTestId('back-link'));

        expect(routerMocks.replace).toHaveBeenCalledWith('/');
    });
});

describe('acceso · campos vacíos (11 · P4)', () => {
    it('dice qué falta junto a cada campo, sin borrar nada ni llamar al servidor', () => {
        setViewportWidth(390);

        render(<LoginPage />);

        fireEvent.click(screen.getByTestId('login-button'));

        expect(screen.getByText('Escribe tu correo electrónico')).toBeInTheDocument();
        expect(screen.getByText('Escribe tu contraseña')).toBeInTheDocument();
        expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();

        const email = screen.getByTestId('email-input');
        const password = screen.getByTestId('password-input');
        expect(email).toHaveAttribute('aria-invalid', 'true');
        expect(password).toHaveAttribute('aria-invalid', 'true');
        expect(email.getAttribute('aria-describedby')).toContain('email-input-error');
        expect(password.getAttribute('aria-describedby')).toContain('password-input-error');
    });

    it('mantiene el mensaje de siempre para un correo mal escrito', () => {
        setViewportWidth(390);

        render(<LoginPage />);

        fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'no-es-un-correo' } });
        fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Muro2026lucia' } });
        fireEvent.click(screen.getByTestId('login-button'));

        expect(
            screen.getByText('Por favor, introduce un correo electrónico válido'),
        ).toBeInTheDocument();
        expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('el mensaje del campo desaparece al corregirlo', () => {
        setViewportWidth(390);

        render(<LoginPage />);

        fireEvent.click(screen.getByTestId('login-button'));
        expect(screen.getByText('Escribe tu correo electrónico')).toBeInTheDocument();

        fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'lucia@ejemplo.com' } });

        expect(screen.queryByText('Escribe tu correo electrónico')).not.toBeInTheDocument();
    });
});

describe('acceso · credenciales incorrectas (11 · P2)', () => {
    it('avisa con título y explicación, sin prefijo «Error:» y sin borrar lo escrito', async () => {
        setViewportWidth(390);
        vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
            data: { user: null },
            error: { message: 'Invalid login credentials' },
        } as any);

        render(<LoginPage />);

        rellenar();
        fireEvent.click(screen.getByTestId('login-button'));

        const alerta = await screen.findByTestId('login-alert');
        expect(alerta).toHaveAttribute('role', 'alert');
        expect(alerta).toHaveTextContent('Correo electrónico o contraseña incorrectos');
        expect(alerta).toHaveTextContent(
            'Revisa los dos datos. Si no recuerdas la contraseña, pide un enlace para cambiarla.',
        );
        expect(alerta.textContent).not.toContain('Error:');
        expect(screen.getByTestId('email-input')).toHaveValue('lucia.martin@gmail.com');
        expect(screen.getByTestId('password-input')).toHaveValue('Muro2026lucia');
        expect(routerMocks.replace).not.toHaveBeenCalled();
    });
});

describe('acceso · mientras entra (11 · P3)', () => {
    it('el botón dice «Iniciando sesión…», gira un anillo y el formulario queda ocupado', async () => {
        setViewportWidth(390);
        vi.mocked(supabase.auth.signInWithPassword).mockReturnValue(new Promise(() => {}) as any);

        render(<LoginPage />);

        rellenar();
        fireEvent.click(screen.getByTestId('login-button'));

        expect(await screen.findByText('Iniciando sesión…')).toBeInTheDocument();
        expect(screen.getByTestId('login-form')).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByTestId('login-spinner')).toBeInTheDocument();
        expect(screen.getByTestId('login-status')).toHaveAttribute('role', 'status');
        expect(
            screen.getByText('Comprobando tu correo y tu contraseña. Esto tarda un segundo.'),
        ).toBeInTheDocument();
        // Lo escrito sigue ahí mientras se comprueba.
        expect(screen.getByTestId('email-input')).toHaveValue('lucia.martin@gmail.com');
        expect(screen.getByTestId('password-input')).toHaveValue('Muro2026lucia');
    });
});

describe('acceso · sin conexión (11 · P5)', () => {
    it('avisa «Sin conexión» y ofrece «Volver a intentarlo» sin perder lo escrito', async () => {
        setViewportWidth(390);
        vi.mocked(supabase.auth.signInWithPassword).mockRejectedValueOnce(
            new TypeError('Failed to fetch'),
        );

        render(<LoginPage />);

        rellenar();
        fireEvent.click(screen.getByTestId('login-button'));

        const alerta = await screen.findByTestId('login-alert');
        expect(alerta).toHaveTextContent('Sin conexión');
        expect(alerta).toHaveTextContent(
            'No hemos podido conectar. Comprueba tu conexión e inténtalo otra vez: lo que has escrito sigue aquí.',
        );
        expect(screen.getByTestId('login-button')).toHaveTextContent('Volver a intentarlo');
        expect(screen.getByTestId('email-input')).toHaveValue('lucia.martin@gmail.com');

        // Y el botón vuelve a responder: el segundo intento entra.
        fireEvent.click(screen.getByTestId('login-button'));

        await waitFor(() => expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(routerMocks.replace).toHaveBeenCalled());
    });
});

describe('acceso · destinos de siempre (S7)', () => {
    it('sin nombre en el perfil, al alta de perfil', async () => {
        setViewportWidth(390);

        render(<LoginPage />);

        rellenar();
        fireEvent.click(screen.getByTestId('login-button'));

        await waitFor(() => expect(routerMocks.replace).toHaveBeenCalledWith('/profile/setup'));
    });

    it('con nombre en el perfil, entra en la portada', async () => {
        setViewportWidth(390);
        vi.mocked(supabase.from).mockReturnValue({
            select: () => ({
                eq: () => ({
                    single: async () => ({ data: { display_name: 'Lucía' }, error: null }),
                }),
            }),
        } as any);

        render(<LoginPage />);

        rellenar();
        fireEvent.click(screen.getByTestId('login-button'));

        await waitFor(() => expect(routerMocks.replace).toHaveBeenCalledWith('/'));
    });

    it('conserva el aviso de «Cuenta creada» que llega desde el alta', () => {
        setViewportWidth(390);
        searchParams.current = { registered: 'true' };

        render(<LoginPage />);

        expect(screen.getByText('Cuenta creada. Inicia sesión.')).toBeInTheDocument();
    });
});
