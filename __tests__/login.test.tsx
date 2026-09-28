import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/app/(auth)/login/index'
import { supabase } from '@/lib/supabase'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock de Suspense para evitar errores en tests
vi.mock('react', async () => {
    const actual = await vi.importActual('react')
    return {
        ...actual as any,
        Suspense: ({ children }: { children: React.ReactNode }) => children,
    }
})


vi.mock('next/link', () => {
    return ({ children, href }: any) => {
        return <a href={href}>{children}</a>;
    };
})


describe('LoginPage', () => {
    it('renders login form', () => {
        render(<LoginPage />)

        // Verificar que los elementos principales están presentes
        expect(screen.getByText('Bienvenido de nuevo')).toBeInTheDocument()
        expect(screen.getByText('Correo electrónico')).toBeInTheDocument()
        expect(screen.getByText('Contraseña')).toBeInTheDocument()
        expect(screen.getByText('Iniciar sesión')).toBeInTheDocument()
    })

    it('shows link to signup page', () => {
        render(<LoginPage />)

        // El componente tiene un Pressable/Text con el texto "Regístrate"
        expect(screen.getByText('Regístrate')).toBeInTheDocument()
    })
})

describe('LoginPage — recuperación de contraseña', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: {}, error: null } as any)
    })

    it('ofrece el enlace de recuperación sin revelar si la cuenta existe', async () => {
        render(<LoginPage />)

        fireEvent.click(screen.getByTestId('forgot-password-link'))
        fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'alguien@ejemplo.com' } })
        fireEvent.click(screen.getByTestId('send-recovery-button'))

        await waitFor(() => {
            expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
                'alguien@ejemplo.com',
                expect.objectContaining({ redirectTo: expect.stringMatching(/\/reset-password$/) }),
            )
        })

        expect(await screen.findByTestId('recovery-sent-message')).toBeInTheDocument()
    })

    it('no pide el enlace con un correo inválido', () => {
        render(<LoginPage />)

        fireEvent.click(screen.getByTestId('forgot-password-link'))
        fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'no-es-un-correo' } })
        fireEvent.click(screen.getByTestId('send-recovery-button'))

        expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled()
        expect(screen.getByText('Por favor, introduce un correo electrónico válido')).toBeInTheDocument()
    })

    it('avisa si el envío lanza y libera el botón', async () => {
        vi.mocked(supabase.auth.resetPasswordForEmail).mockRejectedValueOnce(new Error('sin red'))

        render(<LoginPage />)

        fireEvent.click(screen.getByTestId('forgot-password-link'))
        fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'alguien@ejemplo.com' } })
        fireEvent.click(screen.getByTestId('send-recovery-button'))

        expect(await screen.findByTestId('recovery-error')).toHaveTextContent('conexión')
        expect(screen.queryByTestId('recovery-sent-message')).not.toBeInTheDocument()

        // El botón vuelve a responder: un fallo lanzado no lo deja bloqueado.
        fireEvent.click(screen.getByTestId('send-recovery-button'))
        await waitFor(() => expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(2))
    })

    it('distingue el límite de envíos de un fallo cualquiera', async () => {
        vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
            data: {},
            error: { status: 429, code: 'over_email_send_rate_limit', message: 'rate limit' },
        } as any)

        render(<LoginPage />)

        fireEvent.click(screen.getByTestId('forgot-password-link'))
        fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'alguien@ejemplo.com' } })
        fireEvent.click(screen.getByTestId('send-recovery-button'))

        expect(await screen.findByTestId('recovery-error')).toHaveTextContent('demasiados enlaces')
        expect(screen.queryByTestId('recovery-sent-message')).not.toBeInTheDocument()
    })

    it('avisa de un error devuelto que no es el límite de envíos', async () => {
        vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
            data: {},
            error: { status: 500, code: 'unexpected_failure', message: 'boom' },
        } as any)

        render(<LoginPage />)

        fireEvent.click(screen.getByTestId('forgot-password-link'))
        fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'alguien@ejemplo.com' } })
        fireEvent.click(screen.getByTestId('send-recovery-button'))

        expect(await screen.findByTestId('recovery-error')).toHaveTextContent('No pudimos enviar el enlace')
        expect(screen.queryByTestId('recovery-sent-message')).not.toBeInTheDocument()
    })
})
