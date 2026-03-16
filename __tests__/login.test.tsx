import { render, screen } from '@testing-library/react'
import LoginPage from '@/app/(auth)/login/index'
import { vi, describe, it, expect } from 'vitest'

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
