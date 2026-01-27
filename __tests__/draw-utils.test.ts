import { performDraw, endDraw, getMyAssignments, getMyAssignmentInGroup, addExclusion, getExclusions, removeExclusion } from '@/lib/draw-utils';
import { supabase } from '@/lib/supabase';
import { notifySecretSantaDraw } from '@/lib/notification-utils';

// Mock dependencies
jest.mock('@/lib/supabase', () => {
    const mockMethods = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
        then: jest.fn(),
    };
    return {
        supabase: mockMethods
    };
});

jest.mock('@/lib/notification-utils', () => ({
    notifySecretSantaDraw: jest.fn(),
}));

describe('Draw Utils', () => {
    const mockSupabase = supabase as any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup chainable mocks
        const mockChain = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            then: jest.fn().mockImplementation(function (this: any, callback) {
                return Promise.resolve(this.resolvedValue || { data: [], error: null }).then(callback);
            })
        };

        mockSupabase.from.mockImplementation(() => {
            const chain = { ...mockChain };
            (chain as any).resolvedValue = null;
            // Overwrite then to use the specific chain context
            chain.then = function (callback) {
                return Promise.resolve((this as any).resolvedValue || { data: [], error: null }).then(callback);
            }.bind(chain);
            return chain;
        });
    });

    const mockResponseOnce = (data: any, error: any = null) => {
        mockSupabase.from.mockImplementationOnce(() => {
            const chain: any = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                single: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockReturnThis(),
                delete: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
            };
            chain.then = (callback: any) => Promise.resolve({ data, error }).then(callback);
            return chain;
        });
    };

    describe('performDraw', () => {
        it('should successfully perform a draw when admin and enough members', async () => {
            const groupId = 'group-1';
            const adminId = 'admin-1';
            const memberIds = ['admin-1', 'user-2', 'user-3'];

            // 1. Check admin role
            mockResponseOnce({ role: 'admin' });
            // 2. Mock members fetch
            mockResponseOnce(memberIds.map(id => ({ user_id: id })));
            // 3. Mock exclusions fetch (empty)
            mockResponseOnce([]);
            // 4. Mock delete previous draws
            mockResponseOnce(null);
            // 5. Mock insert new assignments
            mockResponseOnce(null);
            // 6. Mock update group status
            mockResponseOnce(null);

            const result = await performDraw(groupId, adminId);

            expect(result).toBe(true);
            expect(notifySecretSantaDraw).toHaveBeenCalledWith(groupId, memberIds);
        });

        it('should throw error if user is not admin', async () => {
            mockResponseOnce({ role: 'member' });
            await expect(performDraw('g1', 'u1')).rejects.toThrow('Solo el administrador puede realizar el sorteo');
        });

        it('should throw error if less than 2 members', async () => {
            mockResponseOnce({ role: 'admin' });
            mockResponseOnce([{ user_id: 'admin-1' }]);
            await expect(performDraw('g1', 'u1')).rejects.toThrow('Se necesitan al menos 2 miembros para el sorteo');
        });
    });

    describe('endDraw', () => {
        it('should clear assignments and deactivate draw status', async () => {
            mockResponseOnce({ role: 'admin' });
            mockResponseOnce(null); // delete
            mockResponseOnce(null); // update

            const result = await endDraw('g1', 'u1');
            expect(result).toBe(true);
        });
    });

    describe('getMyAssignments', () => {
        it('should fetch assignments for a user filtered by active groups', async () => {
            const mockData = [
                { id: '1', group: { is_draw_active: true } },
                { id: '2', group: { is_draw_active: false } }
            ];
            mockResponseOnce(mockData);

            const result = await getMyAssignments('u1');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });
    });

    describe('getMyAssignmentInGroup', () => {
        it('should fetch assignment for specific group if active', async () => {
            const mockData = { id: '1', group: { is_draw_active: true } };
            mockResponseOnce(mockData);

            const result = await getMyAssignmentInGroup('u1', 'g1');
            expect(result.id).toBe('1');
        });

        it('should return null if group draw is not active', async () => {
            const mockData = { id: '1', group: { is_draw_active: false } };
            mockResponseOnce(mockData);

            const result = await getMyAssignmentInGroup('u1', 'g1');
            expect(result).toBeNull();
        });
    });

    describe('Exclusions Management', () => {
        it('should add an exclusion', async () => {
            mockResponseOnce(null);
            await addExclusion('g1', 'u1', 'u2');
            expect(mockSupabase.from).toHaveBeenCalledWith('draw_exclusions');
        });

        it('should fetch exclusions', async () => {
            const mockExclusions = [{ user_a_id: 'u1', user_b_id: 'u2' }];
            mockResponseOnce(mockExclusions);
            const result = await getExclusions('g1');
            expect(result).toEqual(mockExclusions);
        });

        it('should remove an exclusion', async () => {
            mockResponseOnce(null);
            await removeExclusion('exc-1');
            expect(mockSupabase.from).toHaveBeenCalledWith('draw_exclusions');
        });
    });
});
