import {
    notifyWishAdded,
    notifyWishReserved,
    notifyWishDeletedByOwner,
} from '@/lib/notification-utils';
import { supabase } from '@/lib/supabase';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Supabase directamente en la factory para evitar problemas de inicialización
vi.mock('@/lib/supabase', () => {
    const mockMethods = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn(),
        then: vi.fn(),
        auth: {
            getUser: vi.fn(),
        },
    };
    return {
        supabase: mockMethods
    };
});

describe('Notification Utils', () => {
    const mockSupabase = supabase as any;

    beforeEach(() => {
        vi.clearAllMocks();
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

    describe('notifyWishDeletedByOwner', () => {
        it('inserts a notification for the reserver with common group_id and wish_title in metadata', async () => {
            const insertMock = vi.fn(() => Promise.resolve({ error: null }));
            const groupChain = () => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() =>
                        Promise.resolve({
                            data: [{ group_id: 'shared-g' }],
                            error: null,
                        })
                    ),
                })),
            });

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'group_members') return groupChain() as any;
                if (table === 'notifications') return { insert: insertMock } as any;
                return mockSupabase;
            });

            await notifyWishDeletedByOwner('owner-1', 'reserver-1', 'Mi libro');

            expect(insertMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 'reserver-1',
                    actor_id: 'owner-1',
                    group_id: 'shared-g',
                    wish_id: null,
                    type: 'wish_deleted_by_owner',
                    metadata: { wish_title: 'Mi libro' },
                })
            );
        });

        it('uses null group_id when owner and reserver share no groups', async () => {
            const insertMock = vi.fn(() => Promise.resolve({ error: null }));
            let groupCall = 0;
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'group_members') {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => {
                                groupCall += 1;
                                return Promise.resolve({
                                    data:
                                        groupCall === 1
                                            ? [{ group_id: 'g-owner' }]
                                            : [{ group_id: 'g-other' }],
                                    error: null,
                                });
                            }),
                        })),
                    } as any;
                }
                if (table === 'notifications') return { insert: insertMock } as any;
                return mockSupabase;
            });

            await notifyWishDeletedByOwner('owner-1', 'reserver-1', 'Wish X');

            expect(insertMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    group_id: null,
                    metadata: { wish_title: 'Wish X' },
                })
            );
        });

        it('does not insert when reservedById is missing', async () => {
            const insertMock = vi.fn(() => Promise.resolve({ error: null }));
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'notifications') return { insert: insertMock } as any;
                return mockSupabase;
            });

            await notifyWishDeletedByOwner('owner-1', '', 'T');

            expect(insertMock).not.toHaveBeenCalled();
        });

        it('does not insert when owner and reserver are the same user', async () => {
            const insertMock = vi.fn(() => Promise.resolve({ error: null }));
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'notifications') return { insert: insertMock } as any;
                return mockSupabase;
            });

            await notifyWishDeletedByOwner('same', 'same', 'T');

            expect(insertMock).not.toHaveBeenCalled();
        });
    });

    describe('getNotifications', () => {
        it('should fetch notifications for a user', async () => {
            const userId = 'user-1';
            const mockData = [{ id: 'notif-1', user_id: userId }];

            mockSupabase.then.mockImplementationOnce((callback: any) =>
                Promise.resolve({ data: mockData, error: null }).then(callback)
            );

            const { getNotifications } = await import('@/lib/notification-utils');
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

            const { markAsRead } = await import('@/lib/notification-utils');
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

            const { markAllAsRead } = await import('@/lib/notification-utils');
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

            const { notifySecretSantaDraw } = await import('@/lib/notification-utils');
            await notifySecretSantaDraw(groupId, memberIds);

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ user_id: 'user-1', actor_id: adminId, group_id: groupId, type: 'draw_performed' }),
                expect.objectContaining({ user_id: 'user-2', actor_id: adminId, group_id: groupId, type: 'draw_performed' })
            ]));
        });
    });
});
