import { notifyWishAdded, notifyWishReserved } from '@/lib/notification-utils';
import { supabase } from '@/lib/supabase';

// Mock Supabase directamente en la factory para evitar problemas de inicialización
jest.mock('@/lib/supabase', () => {
    const mockMethods = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
        then: jest.fn(),
        auth: {
            getUser: jest.fn(),
        },
    };
    return {
        supabase: mockMethods
    };
});

describe('Notification Utils', () => {
    const mockSupabase = supabase as any;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset chainable mock por defecto
        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
        mockSupabase.eq.mockReturnThis();
        mockSupabase.in.mockReturnThis();
        mockSupabase.neq.mockReturnThis();
        mockSupabase.then.mockImplementation((callback: any) => Promise.resolve({ data: [], error: null }).then(callback));
        mockSupabase.insert.mockImplementation(() => Promise.resolve({ error: null }));
    });

    describe('notifyWishAdded', () => {
        it('should create notifications for all group members except the actor', async () => {
            const actorId = 'actor-1';
            const wishId = 'wish-1';

            // 1. Llamada a obtener grupos del autor
            mockSupabase.then
                .mockImplementationOnce((callback: any) => Promise.resolve({ data: [{ group_id: 'group-1' }], error: null }).then(callback))
                // 2. Llamada a obtener miembros
                .mockImplementationOnce((callback: any) => Promise.resolve({
                    data: [
                        { user_id: 'user-2', group_id: 'group-1' },
                        { user_id: 'user-3', group_id: 'group-1' }
                    ],
                    error: null
                }).then(callback));

            await notifyWishAdded(actorId, wishId);

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ user_id: 'user-2', actor_id: actorId, wish_id: wishId }),
                expect.objectContaining({ user_id: 'user-3', actor_id: actorId, wish_id: wishId })
            ]));
        });
    });

    describe('notifyWishReserved', () => {
        it('should notify common group members but NOT the actor and NOT the owner', async () => {
            const actorId = 'actor-1';
            const ownerId = 'owner-1';
            const wishId = 'wish-1';

            // Configurar respuestas
            mockSupabase.single.mockResolvedValueOnce({ data: { user_id: ownerId, title: 'Gift' }, error: null });

            mockSupabase.then
                .mockImplementationOnce((callback: any) => Promise.resolve({ data: [{ group_id: 'group-shared' }], error: null }).then(callback)) // actor groups
                .mockImplementationOnce((callback: any) => Promise.resolve({ data: [{ group_id: 'group-shared' }], error: null }).then(callback)) // owner groups
                .mockImplementationOnce((callback: any) => Promise.resolve({
                    data: [{ user_id: 'user-3', group_id: 'group-shared' }],
                    error: null
                }).then(callback)); // members

            await notifyWishReserved(actorId, wishId);

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ user_id: 'user-3', actor_id: actorId, type: 'wish_reserved' })
            ]));
        });
    });

    describe('getNotifications', () => {
        it('should fetch notifications for a user', async () => {
            const userId = 'user-1';
            const mockData = [{ id: 'notif-1', user_id: userId }];

            mockSupabase.then.mockImplementationOnce((callback: any) =>
                Promise.resolve({ data: mockData, error: null }).then(callback)
            );

            const { getNotifications } = require('@/lib/notification-utils');
            const result = await getNotifications(userId);

            expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
            expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
            expect(result).toEqual(mockData);
        });
    });

    describe('markAsRead', () => {
        it('should update is_read to true for a specific notification', async () => {
            const notifId = 'notif-1';

            mockSupabase.then.mockImplementationOnce((callback: any) =>
                Promise.resolve({ error: null }).then(callback)
            );

            const { markAsRead } = require('@/lib/notification-utils');
            await markAsRead(notifId);

            expect(mockSupabase.update).toHaveBeenCalledWith({ is_read: true });
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', notifId);
        });
    });

    describe('markAllAsRead', () => {
        it('should update all unread notifications for a user', async () => {
            const userId = 'user-1';

            mockSupabase.then.mockImplementationOnce((callback: any) =>
                Promise.resolve({ error: null }).then(callback)
            );

            const { markAllAsRead } = require('@/lib/notification-utils');
            await markAllAsRead(userId);

            expect(mockSupabase.update).toHaveBeenCalledWith({ is_read: true });
            expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
            expect(mockSupabase.eq).toHaveBeenCalledWith('is_read', false);
        });
    });

    describe('notifySecretSantaDraw', () => {
        it('should create notifications for all members when a draw is performed', async () => {
            const groupId = 'group-1';
            const memberIds = ['user-1', 'user-2'];
            const adminId = 'admin-1';

            // Mock auth.getUser
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: adminId } }, error: null });

            mockSupabase.then.mockImplementationOnce((callback: any) =>
                Promise.resolve({ error: null }).then(callback)
            );

            const { notifySecretSantaDraw } = require('@/lib/notification-utils');
            await notifySecretSantaDraw(groupId, memberIds);

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ user_id: 'user-1', actor_id: adminId, group_id: groupId, type: 'draw_performed' }),
                expect.objectContaining({ user_id: 'user-2', actor_id: adminId, group_id: groupId, type: 'draw_performed' })
            ]));
        });
    });
});
