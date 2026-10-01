import {
    GROUP_NOTIFICATION_OPTIONS,
    defaultGroupNotificationPreferences,
    getGroupNotificationPreferences,
    setGroupNotificationPreference,
} from '@/lib/group-notification-preferences';
import { supabase } from '@/lib/supabase';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Supabase directamente en la factory para evitar problemas de inicialización
vi.mock('@/lib/supabase', () => {
    const mockMethods = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        upsert: vi.fn(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn(),
    };
    return {
        supabase: mockMethods
    };
});

describe('Group Notification Preferences', () => {
    const mockSupabase = supabase as any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset chainable mock por defecto: consulta sin filas
        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
        mockSupabase.eq.mockReturnThis();
        mockSupabase.then.mockImplementation((callback: any) => Promise.resolve({ data: [], error: null }).then(callback));
        mockSupabase.upsert.mockImplementation(() => Promise.resolve({ error: null }));
    });

    describe('GROUP_NOTIFICATION_OPTIONS', () => {
        it('incluye los seis tipos en el orden reserva, alta, borrado, sorteo, cumpleaños y onomástico', () => {
            expect(GROUP_NOTIFICATION_OPTIONS.map((option) => option.type)).toEqual([
                'wish_reserved',
                'wish_added',
                'wish_deleted_by_owner',
                'draw_performed',
                'birthday',
                'name_day'
            ]);
        });

        it('describe los tipos nuevos con etiqueta y descripción en español', () => {
            const birthday = GROUP_NOTIFICATION_OPTIONS.find((option) => option.type === 'birthday');
            const nameDay = GROUP_NOTIFICATION_OPTIONS.find((option) => option.type === 'name_day');

            expect(birthday).toMatchObject({ label: 'Cumpleaños' });
            expect(birthday?.description).toContain('miembro del grupo');
            expect(nameDay).toMatchObject({ label: 'Onomástico' });
            expect(nameDay?.description).toContain('miembro del grupo');
        });
    });

    describe('defaultGroupNotificationPreferences', () => {
        it('devuelve todas las preferencias activadas', () => {
            expect(defaultGroupNotificationPreferences()).toEqual({
                wish_reserved: true,
                wish_added: true,
                wish_deleted_by_owner: true,
                draw_performed: true,
                birthday: true,
                name_day: true
            });
        });
    });

    describe('getGroupNotificationPreferences', () => {
        it('devuelve los valores por defecto cuando no hay filas guardadas', async () => {
            const prefs = await getGroupNotificationPreferences('user-1', 'group-1');

            expect(prefs).toEqual(defaultGroupNotificationPreferences());
            expect(mockSupabase.from).toHaveBeenCalledWith('group_notification_preferences');
            expect(mockSupabase.select).toHaveBeenCalledWith('notification_type, enabled');
            expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-1');
            expect(mockSupabase.eq).toHaveBeenCalledWith('group_id', 'group-1');
        });

        it('aplica una fila desactivada solo a su tipo y deja el resto activados', async () => {
            mockSupabase.then.mockImplementationOnce((callback: any) =>
                Promise.resolve({
                    data: [{ notification_type: 'wish_added', enabled: false }],
                    error: null
                }).then(callback)
            );

            const prefs = await getGroupNotificationPreferences('user-1', 'group-1');

            expect(prefs).toEqual({
                wish_reserved: true,
                wish_added: false,
                wish_deleted_by_owner: true,
                draw_performed: true,
                birthday: true,
                name_day: true
            });
        });

        it('ignora los tipos de notificación desconocidos', async () => {
            mockSupabase.then.mockImplementationOnce((callback: any) =>
                Promise.resolve({
                    data: [
                        { notification_type: 'tipo_futuro', enabled: false },
                        { notification_type: 'draw_performed', enabled: false },
                        { notification_type: 'birthday', enabled: false }
                    ],
                    error: null
                }).then(callback)
            );

            const prefs = await getGroupNotificationPreferences('user-1', 'group-1');

            expect(prefs).toEqual({
                wish_reserved: true,
                wish_added: true,
                wish_deleted_by_owner: true,
                draw_performed: false,
                birthday: false,
                name_day: true
            });
        });

        it('lanza el error cuando la consulta falla', async () => {
            const failure = new Error('rls violation');
            mockSupabase.then.mockImplementationOnce((callback: any) =>
                Promise.resolve({ data: null, error: failure }).then(callback)
            );

            await expect(getGroupNotificationPreferences('user-1', 'group-1')).rejects.toThrow('rls violation');
        });
    });

    describe('setGroupNotificationPreference', () => {
        it('guarda la preferencia con el payload exacto y el objetivo de conflicto correcto', async () => {
            const spyDateNow = vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-01-02T03:04:05.000Z');

            try {
                await setGroupNotificationPreference('user-1', 'group-1', 'wish_reserved', false);

                expect(mockSupabase.from).toHaveBeenCalledWith('group_notification_preferences');
                expect(mockSupabase.upsert).toHaveBeenCalledWith(
                    {
                        user_id: 'user-1',
                        group_id: 'group-1',
                        notification_type: 'wish_reserved',
                        enabled: false,
                        updated_at: '2026-01-02T03:04:05.000Z'
                    },
                    { onConflict: 'user_id,group_id,notification_type' }
                );
            } finally {
                spyDateNow.mockRestore();
            }
        });

        it('lanza el error cuando el guardado falla', async () => {
            const failure = new Error('network down');
            mockSupabase.upsert.mockImplementationOnce(() => Promise.resolve({ error: failure }));

            await expect(
                setGroupNotificationPreference('user-1', 'group-1', 'draw_performed', false)
            ).rejects.toThrow('network down');
        });
    });
});
