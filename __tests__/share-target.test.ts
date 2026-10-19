import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    parseSharedPayload,
    shareCacheKeyUrl,
    takeSharedPayload,
    SHARE_CACHE_NAME,
    SHARE_KEY_PREFIX,
} from '@/lib/share-target';

const SW_SOURCE = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8');

/** El payload que deja el service worker, tal cual lo escribe `storeShare`. */
function storedBody(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
        url: 'https://www.amazon.es/dp/B09B8X9RGM',
        title: 'Producto',
        text: '',
        createdAt: 1_760_000_000_000,
        ...overrides,
    });
}

/**
 * `caches` falso con la forma que usa la página: una caché por nombre, `match` por clave y
 * `delete`. Las claves se guardan ya resueltas, como las guarda el SW (URL absoluta).
 */
function fakeCaches(entries: Record<string, Response> = {}) {
    const store = new Map(Object.entries(entries));
    const cache = {
        match: vi.fn(async (key: string) => store.get(key)),
        delete: vi.fn(async (key: string) => store.delete(key)),
    };
    return {
        store,
        cache,
        caches: {
            open: vi.fn(async (name: string) => {
                expect(name).toBe(SHARE_CACHE_NAME);
                return cache;
            }),
        },
    };
}

const originalCaches = (globalThis as any).caches;

afterEach(() => {
    (globalThis as any).caches = originalCaches;
    vi.restoreAllMocks();
});

describe('contrato del share target entre el service worker y la app', () => {
    it('la app y el service worker usan la misma caché y el mismo prefijo de clave', () => {
        // No se puede importar `sw.js` (no es un módulo, corre en otro contexto), así que el
        // contrato se afirma contra su fuente. Es lo que evita que un renombre en un lado deje
        // los compartires huérfanos en el otro, en silencio y solo en producción.
        expect(SW_SOURCE).toContain(`const SHARE_CACHE = '${SHARE_CACHE_NAME}';`);
        expect(SW_SOURCE).toContain(`const SHARE_KEY_PREFIX = '${SHARE_KEY_PREFIX}';`);
    });

    it('arma la clave como URL absoluta, con y sin base de GitHub Pages', () => {
        expect(shareCacheKeyUrl('abc', '', 'https://user.github.io')).toBe(
            'https://user.github.io/share-payload/abc',
        );
        expect(shareCacheKeyUrl('abc', '/murodeseos', 'https://user.github.io')).toBe(
            'https://user.github.io/murodeseos/share-payload/abc',
        );
    });
});

describe('lectura del compartir pendiente', () => {
    it('devuelve el payload y lo borra: un compartir se consume una sola vez', async () => {
        const key = shareCacheKeyUrl('abc');
        const fake = fakeCaches({ [key]: new Response(storedBody()) });
        (globalThis as any).caches = fake.caches;

        const payload = await takeSharedPayload('abc');

        expect(payload).toEqual({
            url: 'https://www.amazon.es/dp/B09B8X9RGM',
            title: 'Producto',
            text: '',
            createdAt: 1_760_000_000_000,
        });
        expect(fake.cache.delete).toHaveBeenCalledWith(key);
        expect(fake.store.size).toBe(0);
    });

    it('sin entrada para ese id devuelve null', async () => {
        const fake = fakeCaches();
        (globalThis as any).caches = fake.caches;

        await expect(takeSharedPayload('no-existe')).resolves.toBeNull();
    });

    it('una entrada ilegible se borra igual y no rompe la app', async () => {
        // El caso que importa: si el JSON quedó corrupto, reintentar no lo arregla y dejarlo
        // ahí haría que el mismo error reaparezca en cada apertura.
        const key = shareCacheKeyUrl('abc');
        const fake = fakeCaches({ [key]: new Response('{no es json') });
        (globalThis as any).caches = fake.caches;

        await expect(takeSharedPayload('abc')).resolves.toBeNull();
        expect(fake.cache.delete).toHaveBeenCalledWith(key);
    });

    it('sin id no consulta la caché', async () => {
        const fake = fakeCaches();
        (globalThis as any).caches = fake.caches;

        await expect(takeSharedPayload('')).resolves.toBeNull();
        expect(fake.caches.open).not.toHaveBeenCalled();
    });

    it('sin Cache Storage (SSR o navegador antiguo) devuelve null en vez de tirar', async () => {
        delete (globalThis as any).caches;

        await expect(takeSharedPayload('abc')).resolves.toBeNull();
    });

    it('si la caché falla al abrirse devuelve null', async () => {
        (globalThis as any).caches = {
            open: vi.fn(async () => {
                throw new Error('sin permiso');
            }),
        };

        await expect(takeSharedPayload('abc')).resolves.toBeNull();
    });
});

describe('validación del payload guardado', () => {
    it('acepta el payload completo', () => {
        expect(parseSharedPayload(JSON.parse(storedBody()))).toEqual({
            url: 'https://www.amazon.es/dp/B09B8X9RGM',
            title: 'Producto',
            text: '',
            createdAt: 1_760_000_000_000,
        });
    });

    it('acepta un compartir sin url: el título se conserva y la extracción no corre', () => {
        expect(parseSharedPayload(JSON.parse(storedBody({ url: null, text: 'Algo que vi' })))).toEqual({
            url: null,
            title: 'Producto',
            text: 'Algo que vi',
            createdAt: 1_760_000_000_000,
        });
    });

    it('rechaza lo que no tiene la forma esperada', () => {
        for (const raw of [
            null,
            'texto',
            [],
            {},
            { url: 42, title: 'x' },
            { url: 'https://a.example', title: 7 },
        ]) {
            expect(parseSharedPayload(raw as any)).toBeNull();
        }
    });
});
