import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ProfileSetupPage from '@/app/profile/setup/index'
import { supabase } from '@/lib/supabase'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// El mock global de expo-router crea un router nuevo en cada llamada, así que
// aquí se sustituye por uno cuyo `replace` se puede observar.
const routerMocks = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('expo-router', () => ({
    Link: ({ children }: any) => children,
    useRouter: () => ({ replace: routerMocks.replace, push: vi.fn(), back: vi.fn(), setParams: vi.fn() }),
    useFocusEffect: vi.fn(),
    useSegments: () => [],
    usePathname: () => '/',
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
}))

const upsert = vi.fn()

/** Abre el alta con sesión iniciada y el upsert observable. */
function renderSetup(user: { id: string } | null = { id: 'user-1' }) {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user }, error: null } as any)
    vi.mocked(supabase.from).mockReturnValue({ upsert } as any)
    return render(<ProfileSetupPage />)
}

/** Completa el paso 1 con un nombre válido y avanza al paso 2. */
function fillStepOneAndContinue(name = 'Ana López') {
    fireEvent.change(screen.getByTestId('setup-name-input'), { target: { value: name } })
    fireEvent.click(screen.getByTestId('setup-continue-button'))
}

beforeEach(() => {
    vi.clearAllMocks()
    upsert.mockResolvedValue({ error: null })
})

describe('Alta de usuario nuevo — paso 1 (identidad)', () => {
    it('pide el nombre y no muestra tallas ni estilo todavía', () => {
        renderSetup()

        expect(screen.getByTestId('setup-name-input')).toBeInTheDocument()
        expect(screen.getByText('Tu cumpleaños (opcional)')).toBeInTheDocument()
        expect(screen.queryByTestId('setup-shirt-input')).not.toBeInTheDocument()
        expect(screen.queryByTestId('setup-save-button')).not.toBeInTheDocument()
    })

    it('no avanza sin un nombre de tres caracteres y no guarda nada', () => {
        renderSetup()

        fireEvent.click(screen.getByTestId('setup-continue-button'))
        expect(screen.getByText('El nombre debe tener al menos 3 caracteres')).toBeInTheDocument()
        expect(screen.queryByTestId('setup-shirt-input')).not.toBeInTheDocument()

        fireEvent.change(screen.getByTestId('setup-name-input'), { target: { value: 'ab' } })
        fireEvent.click(screen.getByTestId('setup-continue-button'))
        expect(screen.getByText('El nombre debe tener al menos 3 caracteres')).toBeInTheDocument()
        expect(screen.queryByTestId('setup-shirt-input')).not.toBeInTheDocument()

        expect(upsert).not.toHaveBeenCalled()
        expect(routerMocks.replace).not.toHaveBeenCalled()
    })

    it('con el nombre avanza al paso de tallas y estilo', () => {
        renderSetup()

        fillStepOneAndContinue()

        expect(screen.getByTestId('setup-shirt-input')).toBeInTheDocument()
        expect(screen.getByTestId('setup-save-button')).toBeInTheDocument()
        expect(upsert).not.toHaveBeenCalled()
    })

    it('sigue mandando a /login cuando no hay sesión', async () => {
        renderSetup(null)

        await waitFor(() => expect(routerMocks.replace).toHaveBeenCalledWith('/login'))
    })
})

describe('Alta de usuario nuevo — paso 2 (tallas y estilo)', () => {
    it('guarda el perfil con el nombre y las fechas del paso 1 sin pedir tallas', async () => {
        renderSetup()

        fireEvent.change(screen.getByTestId('setup-name-input'), { target: { value: 'Ana López' } })
        fireEvent.change(screen.getByLabelText('Tu cumpleaños (opcional)'), {
            target: { value: '1990-05-12' },
        })
        fireEvent.click(screen.getByTestId('setup-continue-button'))
        fireEvent.click(screen.getByTestId('setup-save-button'))

        await waitFor(() => expect(routerMocks.replace).toHaveBeenCalledWith('/'))
        expect(upsert).toHaveBeenCalledTimes(1)
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'user-1',
                display_name: 'Ana López',
                birth_date: '1990-05-12',
                name_day: null,
                shirt_size: null,
                pants_size: null,
                shoe_size: null,
                favorite_brands: null,
                favorite_color: null,
            }),
        )
    })

    it('guarda tallas y estilo en el mismo upsert que la identidad', async () => {
        renderSetup()

        fillStepOneAndContinue('Ana López')
        fireEvent.change(screen.getByTestId('setup-shirt-input'), { target: { value: 'M' } })
        fireEvent.change(screen.getByTestId('setup-pants-input'), { target: { value: '38' } })
        fireEvent.change(screen.getByTestId('setup-shoes-input'), { target: { value: '39' } })
        fireEvent.change(screen.getByTestId('setup-brands-input'), { target: { value: 'Zara, Mango' } })
        fireEvent.change(screen.getByTestId('setup-color-input'), { target: { value: 'Rojo' } })
        fireEvent.click(screen.getByTestId('setup-save-button'))

        await waitFor(() => expect(routerMocks.replace).toHaveBeenCalledWith('/'))
        expect(upsert).toHaveBeenCalledTimes(1)
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                display_name: 'Ana López',
                shirt_size: 'M',
                pants_size: '38',
                shoe_size: '39',
                favorite_brands: 'Zara, Mango',
                favorite_color: 'Rojo',
            }),
        )
    })

    it('«Completar más tarde» también guarda y deja entrar al muro', async () => {
        renderSetup()

        fillStepOneAndContinue("O'Neil")
        fireEvent.click(screen.getByTestId('setup-skip-button'))

        await waitFor(() => expect(routerMocks.replace).toHaveBeenCalledWith('/'))
        expect(upsert).toHaveBeenCalledTimes(1)
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({ display_name: "O'Neil", shirt_size: null, favorite_color: null }),
        )
    })

    it('vuelve al paso 1 sin perder el nombre', () => {
        renderSetup()

        fillStepOneAndContinue('Ana López')
        fireEvent.click(screen.getByTestId('setup-back-button'))

        expect(screen.getByTestId('setup-name-input')).toHaveValue('Ana López')
        expect(screen.queryByTestId('setup-shirt-input')).not.toBeInTheDocument()
    })
})
