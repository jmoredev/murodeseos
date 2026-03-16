import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.unmock('@/lib/group-utils')

import {
    generateUniqueGroupCode,
    createGroup,
    joinGroup,
    updateGroupName,
    deleteGroup,
    removeMemberFromGroup,
    generateShareMessage,
    shareGroup
} from '@/lib/group-utils'
import { supabase } from '@/lib/supabase'

// Mock de Supabase ya está en vitest.setup.ts, pero necesitamos resetear los mocks entre tests

describe('generateUniqueGroupCode', () => {
    beforeEach(() => {
        vi.clearAllMocks()

            // Configurar mock por defecto para generateUniqueGroupCode
            ; (supabase.from as any).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' } // Código no encontrado
                })
            })
    })

    it('genera un código con la longitud correcta por defecto (6 caracteres)', async () => {
        const code = await generateUniqueGroupCode()
        expect(code).toHaveLength(6)
    })

    it('genera un código con la longitud especificada', async () => {
        const customLength = 8
        const code = await generateUniqueGroupCode(customLength)
        expect(code).toHaveLength(customLength)
    })

    it('genera un código solo con caracteres alfanuméricos seguros', async () => {
        const code = await generateUniqueGroupCode()
        // Debe contener solo caracteres de SAFE_CHARS (sin O, 0, I, 1, l)
        const safeCharsRegex = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]+$/
        expect(code).toMatch(safeCharsRegex)
    })

    it('genera códigos únicos en diferentes llamadas', async () => {
        const code1 = await generateUniqueGroupCode()
        const code2 = await generateUniqueGroupCode()
        const code3 = await generateUniqueGroupCode()

        // Aunque no es garantía 100% de unicidad, la probabilidad de colisión es muy baja
        expect(code1).not.toBe(code2)
        expect(code2).not.toBe(code3)
        expect(code1).not.toBe(code3)
    })

    it('no contiene caracteres confusos (O, 0, I, 1, l)', async () => {
        const code = await generateUniqueGroupCode()
        // Verificar que NO contiene caracteres confusos
        expect(code).not.toMatch(/[O0I1l]/)
    })

    it('genera solo caracteres en mayúsculas', async () => {
        const code = await generateUniqueGroupCode()
        expect(code).toBe(code.toUpperCase())
    })
})

// ============================================
// Tests para createGroup
// ============================================
describe('createGroup', () => {
    beforeEach(() => {
        vi.clearAllMocks()

            // Mock generateUniqueGroupCode en el beforeEach para que devuelva un código fijo
            ; (supabase.from as any).mockImplementation((table: string) => {
                if (table === 'groups') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({
                            data: null,
                            error: { code: 'PGRST116' } // Código no encontrado - para generateUniqueGroupCode
                        }),
                        insert: vi.fn().mockReturnThis()
                    }
                }
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn(),
                    insert: vi.fn()
                }
            })
    })

    it('crea un grupo exitosamente con todos los parámetros', async () => {
        const mockGroup = {
            id: expect.any(String), // El ID será generado
            name: 'Grupo Test',
            icon: '🎉',
            creator_id: 'user-123',
            created_at: expect.any(String)
        }

        // Mock de insert para groups
        const mockInsert = vi.fn().mockReturnThis()
        const mockSelect = vi.fn().mockReturnThis()
        const mockSingle = vi.fn().mockResolvedValue({ data: mockGroup, error: null })

        // Mock de insert para group_members
        const mockMemberInsert = vi.fn().mockResolvedValue({ error: null })

            ; (supabase.from as any).mockImplementation((table: string) => {
                if (table === 'groups') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
                        insert: mockInsert
                    }
                } else if (table === 'group_members') {
                    return {
                        insert: mockMemberInsert
                    }
                }
            })

        // Conectar los mocks
        mockInsert.mockReturnValue({ select: mockSelect })
        mockSelect.mockReturnValue({ single: mockSingle })

        const result = await createGroup({
            name: 'Grupo Test',
            icon: '🎉',
            creatorId: 'user-123'
        })

        expect(result).toMatchObject({
            name: 'Grupo Test',
            icon: '🎉',
            creator_id: 'user-123'
        })
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Grupo Test',
            icon: '🎉',
            creator_id: 'user-123'
        }))
        expect(mockMemberInsert).toHaveBeenCalledWith(expect.objectContaining({
            user_id: 'user-123',
            role: 'admin'
        }))
    })

    it('usa icono por defecto 🎁 si no se proporciona', async () => {
        const mockInsert = vi.fn().mockReturnThis()
        const mockSelect = vi.fn().mockReturnThis()
        const mockSingle = vi.fn().mockResolvedValue({
            data: { id: expect.any(String), name: 'Test', icon: '🎁' },
            error: null
        })

            ; (supabase.from as any).mockImplementation((table: string) => {
                if (table === 'groups') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
                        insert: mockInsert
                    }
                }
                return { insert: vi.fn().mockResolvedValue({ error: null }) }
            })

        mockInsert.mockReturnValue({ select: mockSelect })
        mockSelect.mockReturnValue({ single: mockSingle })

        await createGroup({
            name: 'Test',
            creatorId: 'user-123'
        })

        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
            icon: '🎁'
        }))
    })

    it('lanza error si falla la creación del grupo', async () => {
        const mockError = { message: 'Database error', code: 'DB_ERROR' }
        const mockInsert = vi.fn().mockReturnThis()
        const mockSelect = vi.fn().mockReturnThis()
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: mockError })

            ; (supabase.from as any).mockImplementation((table: string) => {
                if (table === 'groups') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
                        insert: mockInsert
                    }
                }
                return { insert: vi.fn() }
            })

        mockInsert.mockReturnValue({ select: mockSelect })
        mockSelect.mockReturnValue({ single: mockSingle })

        await expect(createGroup({
            name: 'Test',
            creatorId: 'user-123'
        })).rejects.toEqual(mockError)
    })

    it('lanza error si falla añadir al creador como miembro', async () => {
        const mockMemberError = { message: 'Member insert failed', code: 'MEMBER_ERROR' }
        const mockInsert = vi.fn().mockReturnThis()
        const mockSelect = vi.fn().mockReturnThis()
        const mockSingle = vi.fn().mockResolvedValue({ data: { id: expect.any(String) }, error: null })

            ; (supabase.from as any).mockImplementation((table: string) => {
                if (table === 'groups') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
                        insert: mockInsert
                    }
                } else if (table === 'group_members') {
                    return {
                        insert: vi.fn().mockResolvedValue({ error: mockMemberError })
                    }
                }
            })

        mockInsert.mockReturnValue({ select: mockSelect })
        mockSelect.mockReturnValue({ single: mockSingle })

        await expect(createGroup({
            name: 'Test',
            creatorId: 'user-123'
        })).rejects.toEqual(mockMemberError)
    })
})

// ============================================
// Tests para joinGroup
// ============================================
describe('joinGroup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('une a un usuario a un grupo existente', async () => {
        const mockGroup = { id: 'ABC123', name: 'Grupo Test', icon: '🎉' }

            ; (supabase.from as any).mockImplementation((table: string) => {
                if (table === 'groups') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: mockGroup, error: null })
                    }
                } else if (table === 'group_members') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
                        insert: vi.fn().mockResolvedValue({ error: null })
                    }
                }
            })

        const result = await joinGroup({
            groupCode: 'ABC123',
            userId: 'user-456'
        })

        expect(result).toEqual({
            group: mockGroup,
            alreadyMember: false
        })
    })

    it('normaliza el código a mayúsculas', async () => {
        const mockGroup = { id: 'ABC123', name: 'Test', icon: '🎁' }
        let capturedCode = ''

            ; (supabase.from as any).mockImplementation((table: string) => {
                if (table === 'groups') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn((field: string, value: string) => {
                            if (field === 'id') capturedCode = value
                            return {
                                single: vi.fn().mockResolvedValue({ data: mockGroup, error: null })
                            }
                        })
                    }
                }
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
                    insert: vi.fn().mockResolvedValue({ error: null })
                }
            })

        await joinGroup({
            groupCode: 'abc123',  // minúsculas
            userId: 'user-456'
        })

        expect(capturedCode).toBe('ABC123')  // debe convertirse a mayúsculas
    })

    it('detecta si el usuario ya es miembro', async () => {
        const mockGroup = { id: 'ABC123', name: 'Test', icon: '🎁' }

            ; (supabase.from as any).mockImplementation((table: string) => {
                if (table === 'groups') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: mockGroup, error: null })
                    }
                } else if (table === 'group_members') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: { id: 'member-1' }, error: null })
                    }
                }
            })

        const result = await joinGroup({
            groupCode: 'ABC123',
            userId: 'user-456'
        })

        expect(result).toEqual({
            group: mockGroup,
            alreadyMember: true
        })
    })

    it('lanza error si el código de grupo no existe', async () => {
        ; (supabase.from as any).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
        })

        await expect(joinGroup({
            groupCode: 'INVALID',
            userId: 'user-456'
        })).rejects.toThrow('Código incorrecto o grupo no encontrado')
    })

    it('lanza error si falla la inserción en group_members', async () => {
        const mockGroup = { id: 'ABC123', name: 'Test', icon: '🎁' }

            ; (supabase.from as any).mockImplementation((table: string) => {
                if (table === 'groups') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: mockGroup, error: null })
                    }
                } else if (table === 'group_members') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
                        insert: vi.fn().mockResolvedValue({ error: { message: 'Insert failed' } })
                    }
                }
            })

        await expect(joinGroup({
            groupCode: 'ABC123',
            userId: 'user-456'
        })).rejects.toThrow('No se pudo unir al grupo')
    })
})

// ============================================
// Tests para updateGroupName
// ============================================
describe('updateGroupName', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('actualiza el nombre del grupo correctamente', async () => {
        const mockUpdate = vi.fn().mockReturnThis()
        const mockEq = vi.fn().mockResolvedValue({ error: null })

                ; (supabase.from as any).mockReturnValue({
                    update: mockUpdate,
                    eq: mockEq
                })

        await updateGroupName('ABC123', 'Nuevo Nombre')

        expect(mockUpdate).toHaveBeenCalledWith({ name: 'Nuevo Nombre' })
        expect(mockEq).toHaveBeenCalledWith('id', 'ABC123')
    })

    it('retorna true en caso de éxito', async () => {
        ; (supabase.from as any).mockReturnValue({
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null })
        })

        const result = await updateGroupName('ABC123', 'Nuevo Nombre')
        expect(result).toBe(true)
    })

    it('lanza error si falla la actualización', async () => {
        ; (supabase.from as any).mockReturnValue({
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } })
        })

        await expect(updateGroupName('ABC123', 'Nuevo Nombre'))
            .rejects.toThrow('No se pudo actualizar el nombre del grupo')
    })
})

// ============================================
// Tests para deleteGroup
// ============================================
describe('deleteGroup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('elimina un grupo correctamente', async () => {
        const mockDelete = vi.fn().mockReturnThis()
        const mockEq = vi.fn().mockResolvedValue({ error: null })

                ; (supabase.from as any).mockReturnValue({
                    delete: mockDelete,
                    eq: mockEq
                })

        await deleteGroup('ABC123')

        expect(mockDelete).toHaveBeenCalled()
        expect(mockEq).toHaveBeenCalledWith('id', 'ABC123')
    })

    it('retorna true en caso de éxito', async () => {
        ; (supabase.from as any).mockReturnValue({
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null })
        })

        const result = await deleteGroup('ABC123')
        expect(result).toBe(true)
    })

    it('lanza error si falla la eliminación', async () => {
        ; (supabase.from as any).mockReturnValue({
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } })
        })

        await expect(deleteGroup('ABC123'))
            .rejects.toThrow('No se pudo eliminar el grupo')
    })
})

// ============================================
// Tests para removeMemberFromGroup
// ============================================
describe('removeMemberFromGroup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('elimina un miembro del grupo correctamente', async () => {
        const mockDelete = vi.fn(() => ({
            eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null })
            }))
        }))

                ; (supabase.from as any).mockReturnValue({
                    delete: mockDelete
                })

        await removeMemberFromGroup('ABC123', 'user-456')

        expect(mockDelete).toHaveBeenCalled()
    })

    it('retorna true en caso de éxito', async () => {
        ; (supabase.from as any).mockReturnValue({
            delete: vi.fn(() => ({
                eq: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null })
                }))
            }))
        })

        const result = await removeMemberFromGroup('ABC123', 'user-456')
        expect(result).toBe(true)
    })

    it('lanza error si falla la eliminación', async () => {
        ; (supabase.from as any).mockReturnValue({
            delete: vi.fn(() => ({
                eq: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } })
                }))
            }))
        })

        await expect(removeMemberFromGroup('ABC123', 'user-456'))
            .rejects.toThrow('No se pudo eliminar al miembro del grupo')
    })
})

// ============================================
// Tests para generateShareMessage
// ============================================
describe('generateShareMessage', () => {
    const originalWindow = global.window

    afterEach(() => {
        global.window = originalWindow
    })

    it('genera mensaje con nombre de grupo y código', () => {
        // Mock window.location usando jsdom
        delete (global as any).window
            ; (global as any).window = { location: { origin: 'http://localhost:3000' } }

        const message = generateShareMessage('Grupo Navidad', 'ABC123')

        expect(message).toContain('Grupo Navidad')
        expect(message).toContain('ABC123')
        expect(message).toContain('🎁')
    })

    it('incluye deep link con código', () => {
        delete (global as any).window
            ; (global as any).window = { location: { origin: 'http://localhost:3000' } }

        const message = generateShareMessage('Grupo Test', 'XYZ789')

        expect(message).toContain('/groups/join?code=XYZ789')
    })

    it('funciona en entorno sin window (SSR)', () => {
        // @ts-ignore
        delete global.window

        const message = generateShareMessage('Grupo SSR', 'SSR123')

        expect(message).toContain('Grupo SSR')
        expect(message).toContain('SSR123')
        expect(message).toContain('/groups/join?code=SSR123')
    })
})

// ============================================
// Tests para shareGroup
// ============================================
describe('shareGroup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('usa navigator.share si está disponible', async () => {
        const mockShare = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(global.navigator, 'share', {
            value: mockShare,
            writable: true
        })

        await shareGroup('Grupo Test', 'ABC123')

        expect(mockShare).toHaveBeenCalledWith({
            title: 'Únete a Grupo Test',
            text: expect.stringContaining('ABC123')
        })
    })

    it('retorna true si share es exitoso', async () => {
        Object.defineProperty(global.navigator, 'share', {
            value: vi.fn().mockResolvedValue(undefined),
            writable: true
        })

        const result = await shareGroup('Grupo Test', 'ABC123')
        expect(result).toBe(true)
    })

    it('fallback a clipboard si share no disponible', async () => {
        // Configurar navigator sin share usando Object.assign
        const mockWriteText = vi.fn().mockResolvedValue(undefined)
        const originalNavigator = global.navigator

        // Crear un nuevo navigator sin share
        Object.defineProperty(global, 'navigator', {
            value: {
                ...originalNavigator,
                share: undefined,
                clipboard: { writeText: mockWriteText }
            },
            writable: true,
            configurable: true
        })

        await shareGroup('Grupo Test', 'ABC123')

        expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('ABC123'))

        // Restaurar navigator
        Object.defineProperty(global, 'navigator', {
            value: originalNavigator,
            writable: true,
            configurable: true
        })
    })

    it('retorna false si usuario cancela', async () => {
        Object.defineProperty(global.navigator, 'share', {
            value: vi.fn().mockRejectedValue(new Error('User cancelled')),
            writable: true
        })

        const result = await shareGroup('Grupo Test', 'ABC123')
        expect(result).toBe(false)
    })
})
