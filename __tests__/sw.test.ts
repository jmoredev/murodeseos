import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const SW_SOURCE = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8');

const SW_ORIGIN = 'https://user.github.io';
/**
 * La versión se **lee** del propio `sw.js` en vez de repetirla acá: el nombre de la caché activa
 * se deriva de ella, y una versión nueva en el SW no debería romper estos tests ni pasar
 * desapercibida. Lo que sí se afirma con literales es lo viejo que `activate` tiene que barrer.
 */
const SW_VERSION = /const VERSION = '([^']+)'/.exec(SW_SOURCE)?.[1];
const CACHE_NAME = `murodeseos-${SW_VERSION}`;

type Bucket = Map<string, Response>;

const SW_SCOPE = `${SW_ORIGIN}/murodeseos/`;

/**
 * Contrato de cable del share target, declarado acá a propósito.
 *
 * Estos dos literales son lo que el service worker y la página se tienen que decir: la caché
 * donde el SW deja el compartir y la forma de la clave con la que la app lo encuentra. La app
 * los declara por su lado (`lib/share-target.ts`) y un test de ese módulo comprueba que el
 * `sw.js` sigue usando los mismos, que es lo que evita que los dos lados se separen.
 */
const SHARE_CACHE_NAME = 'murodeseos-share';
const SHARE_KEY_PREFIX = 'share-payload/';

/** La clave exacta que arma el SW para un compartir: `«ámbito»/share-payload/<id>`. */
function shareCacheKey(id: string) {
    return `${SW_SCOPE}${SHARE_KEY_PREFIX}${id}`;
}

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
        location: { origin: SW_ORIGIN, href: `${SW_SCOPE}sw.js` },
        // El ámbito real del SW es lo que permite distinguir el destino de compartir sin
        // escribir `/murodeseos` en el código: el mismo `sw.js` sirve en cualquier base.
        registration: { scope: SW_SCOPE },
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
        // El SW parsea el `multipart/form-data` de la hoja de compartir y devuelve respuestas:
        // ambos constructores tienen que existir dentro del contexto aislado.
        Request,
        Response,
        Headers,
        FormData,
        Blob,
        File,
        AbortController,
        setTimeout,
        clearTimeout,
        URL,
        Date,
        Math,
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

/**
 * Share Target (T6 de `odd/tasks/compartir-producto.md`).
 *
 * Android entrega el compartir como un **POST** `multipart/form-data` al `action` del manifest.
 * Una página estática no sabe responder a un POST, así que el service worker es el único que
 * puede recibirlo: guarda el payload y contesta un `303` a la ruta del formulario, que ya es un
 * GET normal. Si esto no existe, elegir «Muro de Deseos» en la hoja de compartir no hace nada.
 */
describe('service worker: share target', () => {
    const SHARE_URL = `${SW_SCOPE}compartir`;

    function shareRequest(fields: Record<string, string>) {
        const form = new FormData();
        for (const [name, value] of Object.entries(fields)) form.append(name, value);
        return new Request(SHARE_URL, { method: 'POST', body: form });
    }

    it('guarda el compartir y responde 303 a la ruta del formulario, sin ir a la red', async () => {
        const sandbox = createSandbox();
        const event = dispatchFetch(
            sandbox,
            shareRequest({
                title: 'Producto de prueba',
                text: 'Mira esto https://www.amazon.es/dp/B09B8X9RGM',
                url: 'https://www.amazon.es/dp/B09B8X9RGM',
            }),
        );

        expect(event.respondWith).toHaveBeenCalledTimes(1);
        const response = await event.respondWith.mock.calls[0][0];

        expect(response.status).toBe(303);
        const location = new URL(response.headers.get('location')!);
        expect(location.pathname).toBe('/murodeseos/compartir');
        const id = location.searchParams.get('share');
        expect(id).toBeTruthy();

        const stored = sandbox.cacheApi.store.get(SHARE_CACHE_NAME)?.get(shareCacheKey(id!));
        expect(stored).toBeDefined();
        expect(await stored!.json()).toMatchObject({
            url: 'https://www.amazon.es/dp/B09B8X9RGM',
            title: 'Producto de prueba',
        });

        // El POST no se reenvía: no hay servidor que lo entienda.
        expect(sandbox.fetchMock).not.toHaveBeenCalled();
    });

    it('si la hoja no manda `url`, la saca del texto compartido', async () => {
        const sandbox = createSandbox();
        const event = dispatchFetch(
            sandbox,
            shareRequest({ text: 'Increíble: https://tienda.example/producto/42?ref=share' }),
        );
        const response = await event.respondWith.mock.calls[0][0];
        const id = new URL(response.headers.get('location')!).searchParams.get('share')!;
        const payload = await sandbox.cacheApi.store.get(SHARE_CACHE_NAME)!.get(shareCacheKey(id))!.json();

        expect(payload.url).toBe('https://tienda.example/producto/42?ref=share');
    });

    it('un compartir sin nada legible redirige igual, sin inventar un id', async () => {
        // Dos formas de «no hay nada que guardar»: un cuerpo que no es un formulario y un
        // formulario con los tres campos vacíos. En ninguna de las dos se guarda un payload
        // vacío que después abriría un deseo en blanco sin explicación.
        const sandbox = createSandbox();

        const ilegible = dispatchFetch(
            sandbox,
            new Request(SHARE_URL, {
                method: 'POST',
                body: 'no soy multipart',
                headers: { 'content-type': 'text/plain' },
            }),
        );
        const vacio = dispatchFetch(
            sandbox,
            shareRequest({ title: '   ', text: '', url: '' }),
        );

        for (const event of [ilegible, vacio]) {
            const response = await event.respondWith.mock.calls[0][0];
            expect(response.status).toBe(303);
            expect(new URL(response.headers.get('location')!).searchParams.get('share')).toBeNull();
        }

        expect(sandbox.cacheApi.store.get(SHARE_CACHE_NAME)?.size ?? 0).toBe(0);
    });

    it('un POST a otra ruta del sitio sigue sin interceptarse', () => {
        const sandbox = createSandbox();
        const event = dispatchFetch(
            sandbox,
            new Request(`${SW_SCOPE}api/otra-cosa`, { method: 'POST', body: 'x' }),
        );

        expect(event.respondWith).not.toHaveBeenCalled();
    });

    it('un POST a otro origen no se toca', () => {
        const sandbox = createSandbox();
        const form = new FormData();
        form.append('url', 'https://example.com');
        const event = dispatchFetch(
            sandbox,
            new Request('https://otro.example/murodeseos/compartir', { method: 'POST', body: form }),
        );

        expect(event.respondWith).not.toHaveBeenCalled();
    });

    it('el GET de la ruta del formulario sigue navegando: el share no se la come', async () => {
        const sandbox = createSandbox();
        const event = dispatchFetch(sandbox, navigationRequest(`${SHARE_URL}?share=abc`));

        const response = await event.respondWith.mock.calls[0][0];

        expect(sandbox.fetchMock).toHaveBeenCalledTimes(1);
        expect(await response.text()).toBe('fresh');
    });

    it('activate no borra un compartir pendiente de abrir', async () => {
        // El prefijo de la caché del SW es `murodeseos-`, así que el barrido de caches
        // antiguas del `activate` se llevaría por delante el compartir pendiente si no se
        // excluyera a mano.
        const sandbox = createSandbox();
        seedCache(sandbox, [CACHE_NAME, SHARE_CACHE_NAME, 'murodeseos-v2']);

        await dispatchActivate(sandbox);

        expect(sandbox.cacheApi.store.has(SHARE_CACHE_NAME)).toBe(true);
        expect(sandbox.cacheApi.store.has('murodeseos-v2')).toBe(false);
    });
});
