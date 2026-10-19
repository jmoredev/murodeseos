import { describe, expect, it, vi } from 'vitest';
import { guardarEnCache, leerDeCache } from '../../supabase/functions/_shared/product-extraction/cache/postgrest';

/**
 * La caché es **opcional** y `guardar` es *best-effort*, pero su transporte no puede colgar la
 * extracción: sin timeout, un PostgREST que no responde deja la petición esperando para siempre.
 * Estas pruebas existen porque el código vivía en `extract-product/index.ts`, que está fuera del
 * `tsc` y del runner — y por eso nadie podía probar ni el timeout ni el contrato.
 */

const URL_BASE = 'https://proyecto.supabase.co';
const CLAVE = 'service-role-key';
const URL_CACHE = `${URL_BASE}/rest/v1/product_extraction_cache`;

const fila = {
    draft: { url: 'https://tienda.example/p/1', title: null, notes: [] },
    created_at: '2026-10-19T10:00:00.000Z',
};

/** Una respuesta JSON como la de PostgREST. */
function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

/**
 * Un `fetch` que **nunca responde** pero honra la señal, como el de verdad: solo se destraba
 * cuando el `signal` que le pasan aborta. Es lo que distingue un timeout real de un mock que
 * devuelve una promesa ya resuelta.
 */
function fetchQueNoResponde() {
    return vi.fn(
        (_url: string, init: { signal?: AbortSignal }) =>
            new Promise<Response>((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            }),
    );
}

describe('leer de la caché', () => {
    it('devuelve el borrador y la fecha de la fila vigente', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse([fila]));

        const acierto = await leerDeCache({
            supabaseUrl: URL_BASE,
            serviceRoleKey: CLAVE,
            cacheKey: 'https://tienda.example/p/1',
            ahoraMs: Date.parse('2026-10-19T11:00:00.000Z'),
            fetchImpl: fetchImpl as any,
        });

        expect(acierto).toEqual({ draft: fila.draft, cachedAt: fila.created_at });

        // El contrato con PostgREST: filtra por clave y por vigencia, y pide lo justo.
        const [url, init] = fetchImpl.mock.calls[0] as any;
        const pedida = new URL(url);
        expect(pedida.pathname).toBe('/rest/v1/product_extraction_cache');
        expect(pedida.searchParams.get('cache_key')).toBe('eq.https://tienda.example/p/1');
        expect(pedida.searchParams.get('expires_at')).toBe('gt.2026-10-19T11:00:00.000Z');
        expect(pedida.searchParams.get('select')).toBe('draft,created_at');
        expect(pedida.searchParams.get('limit')).toBe('1');
        expect(init.headers.apikey).toBe(CLAVE);
        expect(init.headers.authorization).toBe(`Bearer ${CLAVE}`);
        // Y la señal que hace cancelable un `fetch` de verdad.
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('un respuesta no-ok es un miss', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({ message: 'boom' }, 500));

        await expect(
            leerDeCache({ supabaseUrl: URL_BASE, serviceRoleKey: CLAVE, cacheKey: 'k', ahoraMs: 1, fetchImpl: fetchImpl as any }),
        ).resolves.toBeNull();
    });

    it('una respuesta que no es una lista con filas es un miss', async () => {
        for (const cuerpo of [{}, [], [null], [{ sin: 'draft' }]]) {
            const fetchImpl = vi.fn(async () => jsonResponse(cuerpo));
            await expect(
                leerDeCache({ supabaseUrl: URL_BASE, serviceRoleKey: CLAVE, cacheKey: 'k', ahoraMs: 1, fetchImpl: fetchImpl as any }),
            ).resolves.toBeNull();
        }
    });

    it('un fallo de red es un miss, no una excepción', async () => {
        const fetchImpl = vi.fn(async () => {
            throw new TypeError('Failed to fetch');
        });

        await expect(
            leerDeCache({ supabaseUrl: URL_BASE, serviceRoleKey: CLAVE, cacheKey: 'k', ahoraMs: 1, fetchImpl: fetchImpl as any }),
        ).resolves.toBeNull();
    });

    it('un PostgREST que no responde no cuelga la extracción: corta por timeout y da miss', async () => {
        const fetchImpl = fetchQueNoResponde();

        await expect(
            leerDeCache({
                supabaseUrl: URL_BASE,
                serviceRoleKey: CLAVE,
                cacheKey: 'k',
                ahoraMs: 1,
                fetchImpl: fetchImpl as any,
                timeoutMs: 25,
            }),
        ).resolves.toBeNull();
    });
});

describe('guardar en la caché', () => {
    it('manda la fila con su vencimiento', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(null, 201));
        const ahoraMs = Date.parse('2026-10-19T10:00:00.000Z');

        await guardarEnCache({
            supabaseUrl: URL_BASE,
            serviceRoleKey: CLAVE,
            cacheKey: 'https://tienda.example/p/1',
            draft: fila.draft,
            finalUrl: 'https://tienda.example/p/1?ref=share',
            ttlSegundos: 3600,
            ahoraMs,
            fetchImpl: fetchImpl as any,
        });

        const [url, init] = fetchImpl.mock.calls[0] as any;
        expect(url).toBe(URL_CACHE);
        expect(init.method).toBe('POST');
        expect(init.headers.prefer).toContain('resolution=merge-duplicates');
        expect(init.signal).toBeInstanceOf(AbortSignal);

        const [enviada] = JSON.parse(init.body);
        expect(enviada).toEqual({
            cache_key: 'https://tienda.example/p/1',
            draft: fila.draft,
            final_url: 'https://tienda.example/p/1?ref=share',
            created_at: '2026-10-19T10:00:00.000Z',
            expires_at: '2026-10-19T11:00:00.000Z',
        });
    });

    it('un fallo al guardar no rompe la respuesta (es best-effort)', async () => {
        const fetchImpl = vi.fn(async () => {
            throw new TypeError('Failed to fetch');
        });

        await expect(
            guardarEnCache({
                supabaseUrl: URL_BASE,
                serviceRoleKey: CLAVE,
                cacheKey: 'k',
                draft: {},
                finalUrl: 'https://tienda.example/p/1',
                ttlSegundos: 60,
                ahoraMs: 1,
                fetchImpl: fetchImpl as any,
            }),
        ).resolves.toBeUndefined();
    });

    it('un guardado que no responde tampoco cuelga: corta por timeout en silencio', async () => {
        const fetchImpl = fetchQueNoResponde();

        await expect(
            guardarEnCache({
                supabaseUrl: URL_BASE,
                serviceRoleKey: CLAVE,
                cacheKey: 'k',
                draft: {},
                finalUrl: 'https://tienda.example/p/1',
                ttlSegundos: 60,
                ahoraMs: 1,
                fetchImpl: fetchImpl as any,
                timeoutMs: 25,
            }),
        ).resolves.toBeUndefined();
    });
});
