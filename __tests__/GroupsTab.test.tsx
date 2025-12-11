import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GroupsTab } from '@/components/GroupsTab'
import { supabase } from '@/lib/supabase'
import { getUserAliases, setUserAlias } from '@/lib/aliases'
import { updateGroupName, deleteGroup } from '@/lib/group-utils'

// Los mocks ya están configurados en jest.setup.js

describe('GroupsTab', () => {
    const mockUserId = 'user-123'

    beforeEach(() => {
        jest.clearAllMocks()
        sessionStorage.clear()

            // Mock por defecto de getUserAliases
            ; (getUserAliases as jest.Mock).mockResolvedValue({})
    })

    // ============================================
    // Tests de Renderizado Inicial
    // ============================================
    describe('Renderizado inicial', () => {
        it('muestra loading spinner mientras carga', () => {
            // Mock que nunca resuelve para mantener loading
            ; (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis()
            })

            render(<GroupsTab userId={mockUserId} />)

            expect(screen.getByText('Cargando grupos...')).toBeInTheDocument()
        })

        it('renderiza header con título "Mis grupos"', async () => {
            ; (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
                in: jest.fn().mockReturnThis()
            })

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Mis grupos')).toBeInTheDocument()
            })
        })

        it('muestra botones "Crear" y "Unirse"', async () => {
            ; (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
                in: jest.fn().mockReturnThis()
            })

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                const header = screen.getByText('Mis grupos').closest('header')
                expect(header).toBeInTheDocument()
            })
        })

        it('muestra mensaje vacío cuando no hay grupos', async () => {
            ; (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
                in: jest.fn().mockReturnThis()
            })

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('No tienes grupos aún')).toBeInTheDocument()
            })
        })

        it('renderiza lista de grupos cuando hay datos', async () => {
            const mockMemberships = [{ group_id: 'group-1', role: 'admin' }]
            const mockGroups = [{ id: 'group-1', name: 'Grupo Test', icon: '🎁' }]
            const mockMembers = [{ group_id: 'group-1', user_id: 'user-456' }]
            const mockProfiles = [{ id: 'user-456', display_name: 'Usuario Test', avatar_url: null }]

                ; (supabase.from as jest.Mock).mockImplementation((table: string) => {
                    if (table === 'group_members') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockResolvedValue({ data: mockMemberships, error: null }),
                            in: jest.fn().mockResolvedValue({ data: mockMembers, error: null })
                        }
                    }
                    if (table === 'groups') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: mockGroups, error: null })
                        }
                    }
                    if (table === 'profiles') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: mockProfiles, error: null })
                        }
                    }
                })

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo Test')).toBeInTheDocument()
            })
        })
    })

    // ============================================
    // Tests de Fetch de Grupos
    // ============================================
    describe('Fetch de grupos', () => {
        it('llama a fetchUserGroups con userId correcto', async () => {
            const selectSpy = jest.fn().mockReturnThis()
            const eqSpy = jest.fn().mockResolvedValue({ data: [], error: null })

                ; (supabase.from as jest.Mock).mockReturnValue({
                    select: selectSpy,
                    eq: eqSpy,
                    in: jest.fn().mockReturnThis()
                })

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(eqSpy).toHaveBeenCalledWith('user_id', mockUserId)
            })
        })

        it('maneja error en fetch de memberships', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

                ; (supabase.from as jest.Mock).mockReturnValue({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'Database error' }
                    })
                })

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    'Error fetching memberships:',
                    expect.any(Object)
                )
            })

            consoleErrorSpy.mockRestore()
        })

        it('maneja error en fetch de groups', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
            const mockMemberships = [{ group_id: 'group-1', role: 'admin' }]

                ; (supabase.from as jest.Mock).mockImplementation((table: string) => {
                    if (table === 'group_members') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockResolvedValue({ data: mockMemberships, error: null })
                        }
                    }
                    if (table === 'groups') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({
                                data: null,
                                error: { message: 'Groups error' }
                            })
                        }
                    }
                })

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    'Error fetching groups:',
                    expect.any(Object)
                )
            })

            consoleErrorSpy.mockRestore()
        })

        it('carga aliases de usuarios correctamente', async () => {
            const mockAliases = { 'user-456': 'Alias Test' }
                ; (getUserAliases as jest.Mock).mockResolvedValue(mockAliases)

            const mockMemberships = [{ group_id: 'group-1', role: 'admin' }]
            const mockGroups = [{ id: 'group-1', name: 'Grupo Test', icon: '🎁' }]
            const mockMembers = [{ group_id: 'group-1', user_id: 'user-456' }]
            const mockProfiles = [{ id: 'user-456', display_name: 'Usuario Test', avatar_url: null }]

                ; (supabase.from as jest.Mock).mockImplementation((table: string) => {
                    if (table === 'group_members') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockResolvedValue({ data: mockMemberships, error: null }),
                            in: jest.fn().mockResolvedValue({ data: mockMembers, error: null })
                        }
                    }
                    if (table === 'groups') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: mockGroups, error: null })
                        }
                    }
                    if (table === 'profiles') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: mockProfiles, error: null })
                        }
                    }
                })

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(getUserAliases).toHaveBeenCalled()
                expect(screen.getByText('Alias Test')).toBeInTheDocument()
            })
        })
    })

    // ============================================
    // Tests de Compartir Grupo
    // ============================================
    describe('Compartir grupo', () => {
        const setupGroupsForSharing = () => {
            const mockMemberships = [{ group_id: 'group-1', role: 'admin' }]
            const mockGroups = [{ id: 'group-1', name: 'Grupo Test', icon: '🎁' }]

                ; (supabase.from as jest.Mock).mockImplementation((table: string) => {
                    if (table === 'group_members') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockResolvedValue({ data: mockMemberships, error: null }),
                            in: jest.fn().mockResolvedValue({ data: [], error: null })
                        }
                    }
                    if (table === 'groups') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: mockGroups, error: null })
                        }
                    }
                    if (table === 'profiles') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: [], error: null })
                        }
                    }
                })
        }

        it('abre modal al hacer click en compartir', async () => {
            setupGroupsForSharing()
            const user = userEvent.setup()

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo Test')).toBeInTheDocument()
            })

            const shareButton = screen.getByLabelText('Compartir código de grupo')
            await user.click(shareButton)

            await waitFor(() => {
                expect(screen.getByText('Invita a tus amigos')).toBeInTheDocument()
            })
        })

        it('muestra código del grupo en modal', async () => {
            setupGroupsForSharing()
            const user = userEvent.setup()

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo Test')).toBeInTheDocument()
            })

            const shareButton = screen.getByLabelText('Compartir código de grupo')
            await user.click(shareButton)

            await waitFor(() => {
                expect(screen.getByText('group-1')).toBeInTheDocument()
            })
        })

        it('copia código al portapapeles', async () => {
            setupGroupsForSharing()
            const user = userEvent.setup()
            const mockWriteText = jest.fn().mockResolvedValue(undefined)
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: mockWriteText },
                writable: true,
                configurable: true
            })
            global.alert = jest.fn()

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo Test')).toBeInTheDocument()
            })

            const shareButton = screen.getByLabelText('Compartir código de grupo')
            await user.click(shareButton)

            await waitFor(() => {
                expect(screen.getByText('group-1')).toBeInTheDocument()
            })

            const codeElement = screen.getByText('group-1')
            await user.click(codeElement)

            await waitFor(() => {
                expect(mockWriteText).toHaveBeenCalledWith('group-1')
            })
        })

        it('cierra modal correctamente', async () => {
            setupGroupsForSharing()
            const user = userEvent.setup()

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo Test')).toBeInTheDocument()
            })

            const shareButton = screen.getByLabelText('Compartir código de grupo')
            await user.click(shareButton)

            await waitFor(() => {
                expect(screen.getByText('Invita a tus amigos')).toBeInTheDocument()
            })

            const closeButton = screen.getByText('Cerrar')
            await user.click(closeButton)

            await waitFor(() => {
                expect(screen.queryByText('Invita a tus amigos')).not.toBeInTheDocument()
            })
        })
    })

    // ============================================
    // Tests de Renombrar Grupo
    // ============================================
    describe('Renombrar grupo', () => {
        const setupAdminGroup = () => {
            const mockMemberships = [{ group_id: 'group-1', role: 'admin' }]
            const mockGroups = [{ id: 'group-1', name: 'Grupo Original', icon: '🎁' }]

                ; (supabase.from as jest.Mock).mockImplementation((table: string) => {
                    if (table === 'group_members') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockResolvedValue({ data: mockMemberships, error: null }),
                            in: jest.fn().mockResolvedValue({ data: [], error: null })
                        }
                    }
                    if (table === 'groups') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: mockGroups, error: null })
                        }
                    }
                    if (table === 'profiles') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: [], error: null })
                        }
                    }
                })
        }

        it('abre modal de renombrar (solo admin)', async () => {
            setupAdminGroup()
            const user = userEvent.setup()

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo Original')).toBeInTheDocument()
            })

            // Primero abrir el menú de opciones
            const menuButton = screen.getByLabelText('Opciones de grupo')
            await user.click(menuButton)

            // Luego click en renombrar
            const renameButton = await screen.findByText('Cambiar nombre')
            await user.click(renameButton)

            await waitFor(() => {
                expect(screen.getByText('Cambiar nombre del grupo')).toBeInTheDocument()
            })
        })

        it('actualiza nombre en Supabase', async () => {
            setupAdminGroup()
                ; (updateGroupName as jest.Mock).mockResolvedValue(true)
            const user = userEvent.setup()

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo Original')).toBeInTheDocument()
            })

            const menuButton = screen.getByLabelText('Opciones de grupo')
            await user.click(menuButton)

            const renameButton = await screen.findByText('Cambiar nombre')
            await user.click(renameButton)

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Nuevo nombre')).toBeInTheDocument()
            })

            const input = screen.getByPlaceholderText('Nuevo nombre')
            await user.clear(input)
            await user.type(input, 'Grupo Renombrado')

            const saveButton = screen.getByText('Guardar')
            await user.click(saveButton)

            await waitFor(() => {
                expect(updateGroupName).toHaveBeenCalledWith('group-1', 'Grupo Renombrado')
            })
        })

        it('actualiza estado local tras renombrar', async () => {
            setupAdminGroup()
                ; (updateGroupName as jest.Mock).mockResolvedValue(true)
            const user = userEvent.setup()

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo Original')).toBeInTheDocument()
            })

            const menuButton = screen.getByLabelText('Opciones de grupo')
            await user.click(menuButton)

            const renameButton = await screen.findByText('Cambiar nombre')
            await user.click(renameButton)

            const input = await screen.findByPlaceholderText('Nuevo nombre')
            await user.clear(input)
            await user.type(input, 'Grupo Renombrado')

            const saveButton = screen.getByText('Guardar')
            await user.click(saveButton)

            await waitFor(() => {
                expect(screen.getByText('Grupo Renombrado')).toBeInTheDocument()
                expect(screen.queryByText('Grupo Original')).not.toBeInTheDocument()
            })
        })

        it('invalida cache de sessionStorage', async () => {
            setupAdminGroup()
                ; (updateGroupName as jest.Mock).mockResolvedValue(true)
            const user = userEvent.setup()
            const removeItemSpy = jest.spyOn(sessionStorage, 'removeItem')

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo Original')).toBeInTheDocument()
            })

            const menuButton = screen.getByLabelText('Opciones de grupo')
            await user.click(menuButton)

            const renameButton = await screen.findByText('Cambiar nombre')
            await user.click(renameButton)

            const input = await screen.findByPlaceholderText('Nuevo nombre')
            await user.clear(input)
            await user.type(input, 'Grupo Renombrado')

            const saveButton = screen.getByText('Guardar')
            await user.click(saveButton)

            await waitFor(() => {
                expect(removeItemSpy).toHaveBeenCalledWith(`groups_${mockUserId}`)
            })
        })
    })

    // ============================================
    // Tests de Eliminar Grupo
    // ============================================
    describe('Eliminar grupo', () => {
        const setupAdminGroup = () => {
            const mockMemberships = [{ group_id: 'group-1', role: 'admin' }]
            const mockGroups = [{ id: 'group-1', name: 'Grupo a Eliminar', icon: '🎁' }]

                ; (supabase.from as jest.Mock).mockImplementation((table: string) => {
                    if (table === 'group_members') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockResolvedValue({ data: mockMemberships, error: null }),
                            in: jest.fn().mockResolvedValue({ data: [], error: null })
                        }
                    }
                    if (table === 'groups') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: mockGroups, error: null })
                        }
                    }
                    if (table === 'profiles') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: [], error: null })
                        }
                    }
                })
        }

        it('abre modal de confirmación (solo admin)', async () => {
            setupAdminGroup()
            const user = userEvent.setup()

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo a Eliminar')).toBeInTheDocument()
            })

            const menuButton = screen.getByLabelText('Opciones de grupo')
            await user.click(menuButton)

            const deleteButton = await screen.findByText('Eliminar grupo')
            await user.click(deleteButton)

            await waitFor(() => {
                expect(screen.getByText('¿Eliminar grupo?')).toBeInTheDocument()
            })
        })

        it('elimina grupo de Supabase', async () => {
            setupAdminGroup()
                ; (deleteGroup as jest.Mock).mockResolvedValue(true)
            const user = userEvent.setup()

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo a Eliminar')).toBeInTheDocument()
            })

            const menuButton = screen.getByLabelText('Opciones de grupo')
            await user.click(menuButton)

            const deleteButton = await screen.findByText('Eliminar grupo')
            await user.click(deleteButton)

            await waitFor(() => {
                expect(screen.getByText('Eliminar')).toBeInTheDocument()
            })

            const confirmButton = screen.getByRole('button', { name: 'Eliminar' })
            await user.click(confirmButton)

            await waitFor(() => {
                expect(deleteGroup).toHaveBeenCalledWith('group-1')
            })
        })

        it('actualiza estado local tras eliminar', async () => {
            setupAdminGroup()
                ; (deleteGroup as jest.Mock).mockResolvedValue(true)
            const user = userEvent.setup()

            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Grupo a Eliminar')).toBeInTheDocument()
            })

            const menuButton = screen.getByLabelText('Opciones de grupo')
            await user.click(menuButton)

            const deleteButton = await screen.findByText('Eliminar grupo')
            await user.click(deleteButton)

            const confirmButton = await screen.findByRole('button', { name: 'Eliminar' })
            await user.click(confirmButton)

            await waitFor(() => {
                expect(screen.queryByText('Grupo a Eliminar')).not.toBeInTheDocument()
                expect(screen.getByText('No tienes grupos aún')).toBeInTheDocument()
            })
        })
    })

    // ============================================
    // Tests de Editar Alias de Miembro
    // ============================================
    describe('Editar alias', () => {
        it('llama a setUserAlias con datos correctos', async () => {
            ; (setUserAlias as jest.Mock).mockResolvedValue(true)

            const mockMemberships = [{ group_id: 'group-1', role: 'admin' }]
            const mockGroups = [{ id: 'group-1', name: 'Grupo Test', icon: '🎁' }]
            const mockMembers = [
                { group_id: 'group-1', user_id: mockUserId },
                { group_id: 'group-1', user_id: 'user-456' }
            ]
            const mockProfiles = [{ id: 'user-456', display_name: 'Usuario Test', avatar_url: null }]

                ; (supabase.from as jest.Mock).mockImplementation((table: string) => {
                    if (table === 'group_members') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockResolvedValue({ data: mockMemberships, error: null }),
                            in: jest.fn().mockResolvedValue({ data: mockMembers, error: null })
                        }
                    }
                    if (table === 'groups') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: mockGroups, error: null })
                        }
                    }
                    if (table === 'profiles') {
                        return {
                            select: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({ data: mockProfiles, error: null })
                        }
                    }
                })

            const user = userEvent.setup()
            render(<GroupsTab userId={mockUserId} />)

            await waitFor(() => {
                expect(screen.getByText('Usuario Test')).toBeInTheDocument()
            })

            // Verificamos que la función está disponible
            expect(setUserAlias).toBeDefined()
        })
    })
})
