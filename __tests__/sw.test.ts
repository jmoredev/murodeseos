import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const SW_SOURCE = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8');

const SW_ORIGIN = 'https://user.github.io';
const VERSION = 'v4';
const CACHE_NAME = `murodeseos-${VERSION}`;

type Bucket = Map<string, Response>;

function createCacheApi() {
    const store = new Map<string, Bucket>();

    const cacheApi = {
        store,
        open: vi.fn(async (name: string) => {
            if (!store.has(name)) store.set(name, new Map());
            const bucket = store.get(name)!;
            return {
                put: vi.fn(async (request: Request, response: Response) => {
                    bucket.set(request.url, response.clone());
                }),
                match: vi.fn(async (request: Request) => bucket.get(request.url)),
                addAll: vi.fn(async () => {}),
            };
        }),
        match: vi.fn(async (request: Request) => {
            for (const bucket of store.values()) {
                const hit = bucket.get(request.url);
                if (hit) return hit;
            }
            return undefined;
        }),
        keys: vi.fn(async () => [...store.keys()]),
        delete: vi.fn(async (name: string) => store.delete(name)),
    };

    return cacheApi;
}

function createSandbox() {
    const listeners: Record<string, ((event: any) => void)[]> = {};
    const self = {
        location: { origin: SW_ORIGIN },
        skipWaiting: vi.fn(async () => {}),
        clients: { claim: vi.fn(async () => {}) },
        addEventListener: vi.fn((name: string, handler: (event: any) => void) => {
            (listeners[name] ??= []).push(handler);
        }),
    };
    const cacheApi = createCacheApi();
    const fetchMock = vi.fn(async () => new Response('fresh', { status: 200 }));

    const sandbox = vm.createContext({
        self,
        caches: cacheApi,
        fetch: fetchMock,
        Response,
        AbortController,
        setTimeout,
        clearTimeout,
        URL,
        console,
    });
    vm.runInContext(SW_SOURCE, sandbox);

    return { listeners, self, cacheApi, fetchMock };
}

function dispatchFetch(sandbox: ReturnType<typeof createSandbox>, request: Request) {
    const event = { request, respondWith: vi.fn(), waitUntil: vi.fn() };
    for (const handler of sandbox.listeners.fetch ?? []) handler(event);
    return event;
}

async function dispatchActivate(sandbox: ReturnType<typeof createSandbox>) {
    const event = { waitUntil: vi.fn() };
    for (const handler of sandbox.listeners.activate ?? []) handler(event);
    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    await event.waitUntil.mock.calls[0][0];
}

function seedCache(sandbox: ReturnType<typeof createSandbox>, names: string[]) {
    for (const name of names) sandbox.cacheApi.store.set(name, new Map());
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('service worker (public/sw.js)', () => {
    it('solo interviene en peticiones del mismo origen: respondWith se llama para una GET same-origin', async () => {
        const sandbox = createSandbox();
        const event = dispatchFetch(sandbox, new Request(`${SW_ORIGIN}/murodeseos/api/data`));

        expect(event.respondWith).toHaveBeenCalledTimes(1);

        const response = await event.respondWith.mock.calls[0][0];
        expect(response.ok).toBe(true);
        expect(sandbox.fetchMock).toHaveBeenCalledTimes(1);

        // Red primero: la respuesta fresca acaba en la cache del SW.
        await vi.waitFor(() => {
            expect(sandbox.cacheApi.store.get(CACHE_NAME)?.has(`${SW_ORIGIN}/murodeseos/api/data`)).toBe(true);
        });
    });

    it('ignora peticiones cross-origin (Supabase): respondWith no se llama', () => {
        const sandbox = createSandbox();
        const event = dispatchFetch(sandbox, new Request('https://abcdef.supabase.co/rest/v1/wishlist_items'));

        expect(event.respondWith).not.toHaveBeenCalled();
    });

    it('no intenta fetch a través del SW para peticiones cross-origin', () => {
        const sandbox = createSandbox();
        dispatchFetch(sandbox, new Request('https://abcdef.supabase.co/rest/v1/wishlist_items'));

        expect(sandbox.fetchMock).not.toHaveBeenCalled();
    });

    it('activate borra las caches antiguas (murodeseos-v2, murodeseos-v3) y conserva la actual y las ajenas', async () => {
        const sandbox = createSandbox();
        seedCache(sandbox, ['murodeseos-v2', 'murodeseos-v3', CACHE_NAME, 'other-project-v1']);

        await dispatchActivate(sandbox);

        expect(sandbox.cacheApi.store.has('murodeseos-v2')).toBe(false);
        expect(sandbox.cacheApi.store.has('murodeseos-v3')).toBe(false);
        expect(sandbox.cacheApi.store.has(CACHE_NAME)).toBe(true);
        expect(sandbox.cacheApi.store.has('other-project-v1')).toBe(true);
    });
});
