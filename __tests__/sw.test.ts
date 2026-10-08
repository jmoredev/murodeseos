import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const SW_SOURCE = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8');

const SW_ORIGIN = 'https://user.github.io';
const VERSION = 'v5';
const CACHE_NAME = `murodeseos-${VERSION}`;

type Bucket = Map<string, Response>;

const SW_SCOPE = `${SW_ORIGIN}/murodeseos/`;

/**
 * `caches.match` acepta un `Request` **o una ruta relativa** (`'./'`).
 *
 * La forma relativa **ya no la usa el SW**: era su respaldo de navegación
 * (`caches.match('./')`) y desapareció en la v5, porque servir una cáscara
 * cacheada es lo que producía la pantalla negra. La rama se conserva **como
 * guardián**: si alguien reintroduce ese respaldo, el mock debe poder verlo —
 * antes sólo resolvía `request.url`, así que ese camino era **invisible** para
 * los tests y el defecto pasó desapercibido.
 */
function resolveCacheKey(request: Request | string) {
    return typeof request === 'string' ? new URL(request, SW_SCOPE).href : request.url;
}

function createCacheApi() {
    const store = new Map<string, Bucket>();
    /** Recursos que el SW pide cachear en la instalación, para poder aseverar qué NO cachea. */
    const addAllCalls: string[][] = [];

    const cacheApi = {
        store,
        addAllCalls,
        open: vi.fn(async (name: string) => {
            if (!store.has(name)) store.set(name, new Map());
            const bucket = store.get(name)!;
            return {
                put: vi.fn(async (request: Request, response: Response) => {
                    bucket.set(resolveCacheKey(request), response.clone());
                }),
                match: vi.fn(async (request: Request) => bucket.get(resolveCacheKey(request))),
                addAll: vi.fn(async (resources: string[]) => {
                    addAllCalls.push(resources);
                }),
            };
        }),
        match: vi.fn(async (request: Request | string) => {
            const key = resolveCacheKey(request);
            for (const bucket of store.values()) {
                const hit = bucket.get(key);
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

async function dispatchInstall(sandbox: ReturnType<typeof createSandbox>) {
    const event = { waitUntil: vi.fn() };
    for (const handler of sandbox.listeners.install ?? []) handler(event);
    for (const call of event.waitUntil.mock.calls) await call[0];
}

/** Una navegación se reconoce por `accept: text/html`; `mode: 'navigate'` no es construible fuera del navegador. */
function navigationRequest(url: string) {
    return new Request(url, { headers: { accept: 'text/html' } });
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

    // --- Pantalla negra permanente tras un despliegue (fix/pwa-pantalla-negra) ---
    //
    // Contexto medido, no supuesto: el bundle es un único `entry-<hash>.js` cuyo
    // nombre ES el hash, así que publicar **elimina** el anterior del servidor; y
    // `CORE_ASSETS` cachea la cáscara `'./'`, que puede sobrevivir a los chunks
    // que referencia. El resultado es una app que no monta nunca: negro, sin
    // texto y sin recuperación, porque el `<script>` recibe el HTML del 404.
    //
    // El disparador en el dispositivo necesita registros, así que estos tests
    // fijan el **contrato** que hace imposible el negro, no el síntoma.

    it('si la navegación falla NO sirve la cáscara guardada: entrega una página sin conexión propia', async () => {
        const sandbox = createSandbox();
        const shellUrl = `${SW_ORIGIN}/murodeseos/`;
        // La cáscara cacheada es de un despliegue anterior: referencia un chunk ya borrado.
        sandbox.cacheApi.store.set(
            CACHE_NAME,
            new Map([
                [
                    shellUrl,
                    new Response(
                        '<html><script src="/murodeseos/_expo/static/js/web/entry-VIEJO.js"></script></html>',
                        { status: 200 },
                    ),
                ],
            ]),
        );
        sandbox.fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

        const event = dispatchFetch(sandbox, navigationRequest(`${SW_ORIGIN}/murodeseos/groups/E2E001`));
        const response = await event.respondWith.mock.calls[0][0];
        const body = await response.text();

        // Lo que produce el negro: servir la cáscara obsoleta.
        expect(body).not.toContain('entry-VIEJO.js');
        // Lo que debe verse en su lugar: algo legible, y que no dependa de activos.
        expect(response.ok).toBe(true);
        expect(body).toMatch(/sin conexi/i);
    });

    it('una respuesta no-ok para un recurso no se entrega como si fuera el recurso', async () => {
        const sandbox = createSandbox();
        // GitHub Pages contesta con el HTML del 404 a un chunk que el despliegue borró.
        sandbox.fetchMock.mockResolvedValueOnce(new Response('<!DOCTYPE html><html>404</html>', { status: 404 }));

        const event = dispatchFetch(
            sandbox,
            new Request(`${SW_ORIGIN}/murodeseos/_expo/static/js/web/entry-VIEJO.js`),
        );
        const response = await event.respondWith.mock.calls[0][0];

        // `Response.error()`: el fallo se declara como fallo, no se disfraza de JS.
        expect(response.type).toBe('error');
    });

    it('una navegación con 404 NO se convierte en «Sin conexión»: ahí Pages sirve la cáscara actual', async () => {
        // Regresión que este test caza, y que se pagó: Pages contesta **404 en las
        // rutas dinámicas** (`/groups/<uuid>`, `/wishlist/<id>`) con el cuerpo del
        // `index.html` actual, así que la app arranca y enruta con normalidad.
        // Convertir ese 404 en la página de sin conexión rompía enlaces profundos y
        // recargas **estando en línea**, y el botón de reintentar pedía lo mismo y
        // volvía al mismo sitio: callejón sin salida.
        const sandbox = createSandbox();
        sandbox.fetchMock.mockResolvedValueOnce(
            new Response(
                '<html><script src="/murodeseos/_expo/static/js/web/entry-ACTUAL.js"></script></html>',
                { status: 404 },
            ),
        );

        const event = dispatchFetch(sandbox, navigationRequest(`${SW_ORIGIN}/murodeseos/groups/E2E001`));
        const response = await event.respondWith.mock.calls[0][0];
        const body = await response.text();

        expect(response.status).toBe(404);
        expect(body).toContain('entry-ACTUAL.js');
        expect(body).not.toMatch(/sin conexi/i);
    });

    it('un recurso no-ok con copia en caché se sirve desde la caché, no como error', async () => {
        // El camino `cached ?? Response.error()`: la red da un no-ok (el HTML del 404
        // de un chunk borrado) pero hay copia buena, y la copia gana.
        const sandbox = createSandbox();
        const cachedBody = 'console.log("bundle cacheado")';
        sandbox.cacheApi.store.set(
            CACHE_NAME,
            new Map([
                [`${SW_ORIGIN}/murodeseos/_expo/static/js/web/entry-viejo.js`, new Response(cachedBody)],
            ]),
        );
        sandbox.fetchMock.mockResolvedValueOnce(new Response('<!DOCTYPE html><html>404</html>', { status: 404 }));

        const event = dispatchFetch(
            sandbox,
            new Request(`${SW_ORIGIN}/murodeseos/_expo/static/js/web/entry-viejo.js`),
        );
        const response = await event.respondWith.mock.calls[0][0];

        expect(await response.text()).toBe(cachedBody);
    });

    it('la cáscara no acaba en la caché: no puede sobrevivir a los chunks que referencia', async () => {
        const sandbox = createSandbox();
        sandbox.cacheApi.store.set(CACHE_NAME, new Map());

        const event = dispatchFetch(sandbox, navigationRequest(`${SW_ORIGIN}/murodeseos/`));
        const response = await event.respondWith.mock.calls[0][0];
        expect(response.ok).toBe(true);

        expect(sandbox.cacheApi.store.get(CACHE_NAME)?.has(`${SW_ORIGIN}/murodeseos/`)).toBe(false);
    });

    it('la instalación no cachea la cáscara', async () => {
        const sandbox = createSandbox();

        await dispatchInstall(sandbox);

        expect(sandbox.cacheApi.addAllCalls.length).toBeGreaterThan(0);
        expect(sandbox.cacheApi.addAllCalls[0]).not.toContain('./');
    });
});
