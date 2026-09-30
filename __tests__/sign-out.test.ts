import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/sign-out';

function createCacheApi(names: string[]) {
    const store = new Set(names);
    return {
        store,
        keys: vi.fn(async () => [...store]),
        delete: vi.fn(async (name: string) => {
            store.delete(name);
        }),
    };
}

describe('signOut', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as any);
    });

    it('cierra la sesión de Supabase', async () => {
        vi.stubGlobal('caches', createCacheApi([]));

        await signOut();

        expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('borra solo las caches con prefijo murodeseos- y conserva las ajenas', async () => {
        const cacheApi = createCacheApi(['murodeseos-v3', 'murodeseos-v2', 'other-repo-v1']);
        vi.stubGlobal('caches', cacheApi);

        await signOut();

        expect(cacheApi.delete).toHaveBeenCalledWith('murodeseos-v3');
        expect(cacheApi.delete).toHaveBeenCalledWith('murodeseos-v2');
        expect(cacheApi.delete).not.toHaveBeenCalledWith('other-repo-v1');
        expect(cacheApi.store.has('other-repo-v1')).toBe(true);
    });

    it('resuelve sin caches disponibles (entorno no web)', async () => {
        vi.stubGlobal('caches', undefined);

        await expect(signOut()).resolves.toBeUndefined();
        expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('resuelve aunque la limpieza de caché falle', async () => {
        const cacheApi = createCacheApi(['murodeseos-v3']);
        cacheApi.delete.mockRejectedValue(new Error('storage gone'));
        vi.stubGlobal('caches', cacheApi);

        await expect(signOut()).resolves.toBeUndefined();
        expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    });
});
