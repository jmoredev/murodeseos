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
});
