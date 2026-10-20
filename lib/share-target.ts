import { getGithubPagesBasePath } from './site-url';

/**
 * El lado de la app del **share target** de Android (T6 de `odd/tasks/compartir-producto.md`).
 *
 * La hoja de «Compartir» del sistema entrega un `POST multipart/form-data` al `action` del
 * manifest, y una página estática no puede contestarlo: lo recibe el service worker
 * (`public/sw.js`), lo guarda en Cache Storage y responde `303` a `/compartir?share=<id>`.
 *
 * Este módulo es el **otro extremo del mismo contrato**: la clave con la que se busca el
 * compartir, la lectura que lo consume y la validación de lo que se encontró. Los dos literales
 * que tienen que coincidir con el service worker están aquí y un test los contrasta contra la
 * fuente de `sw.js`, porque `sw.js` corre en otro contexto y no se puede importar.
 *
 * Por qué Cache Storage y no `sessionStorage`: el `303` sale del service worker, que **no tiene
 * acceso** al almacenamiento de la página. La caché es el único sitio que ambos lados comparten.
 */

/** La caché donde el service worker deja los compartires pendientes. */
export const SHARE_CACHE_NAME = 'murodeseos-share';

/** Prefijo de la clave dentro de esa caché (`share-payload/<id>`). */
export const SHARE_KEY_PREFIX = 'share-payload/';

/** El parámetro con el que el `303` señala el compartir: `/compartir?share=<id>`. */
export const SHARE_QUERY_PARAM = 'share';

/**
 * Lo que la hoja de compartir entregó, ya validado.
 *
 * `url` es `null` cuando ni el campo `url` ni el texto traían un enlace: el deseo se puede crear
 * igual, pero sin extracción (S2: un campo que no se puede leer no impide crear el deseo).
 */
export type SharedPayload = {
    url: string | null;
    title: string;
    text: string;
    createdAt: number;
};

/**
 * Clave absoluta del compartir dentro de la caché.
 *
 * `origin` y `basePath` se reciben como parámetros —con el valor real del despliegue por
 * defecto— para poder probar las dos formas: la raíz del host y `/<repo>/` de GitHub Pages. La
 * base **no** se puede deducir de la ruta actual (`/compartir` no dice cuál es la base), así que
 * sale de `getGithubPagesBasePath`, que es donde el repo ya la declara.
 */
export function shareCacheKeyUrl(
    id: string,
    basePath: string = getGithubPagesBasePath(),
    origin: string = typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
): string {
    return new URL(`${SHARE_KEY_PREFIX}${id}`, `${origin}${basePath}/`).href;
}

/**
 * Valida un payload guardado.
 *
 * Es deliberadamente estricto con los **tipos** y no convierte nada: una entrada corrupta tiene
 * que rechazarse, no completarse con valores inventados. Y un payload sin `url`, `title` ni
 * `text` también se rechaza: abriría un formulario en blanco sin que el usuario sepa por qué.
 */
export function parseSharedPayload(raw: unknown): SharedPayload | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    const candidate = raw as Record<string, unknown>;
    const { url, title, text, createdAt } = candidate;

    if (url !== undefined && url !== null && typeof url !== 'string') return null;
    if (title !== undefined && typeof title !== 'string') return null;
    if (text !== undefined && typeof text !== 'string') return null;
    if (createdAt !== undefined && typeof createdAt !== 'number') return null;

    const payload: SharedPayload = {
        url: typeof url === 'string' && url.trim() ? url.trim() : null,
        title: typeof title === 'string' ? title.trim() : '',
        text: typeof text === 'string' ? text.trim() : '',
        createdAt: typeof createdAt === 'number' ? createdAt : 0,
    };

    if (!payload.url && !payload.title && !payload.text) return null;

    return payload;
}

/**
 * Lee el compartir pendiente y lo **borra**: se consume una sola vez.
 *
 * Se borra también cuando el cuerpo no se puede leer: una entrada corrupta no se arregla
 * reintentando, y dejarla ahí haría que el mismo error reaparezca en cada apertura de la app.
 * Ningún fallo de esta función puede impedir que la app arranque; por eso todo termina en `null`.
 */
export async function takeSharedPayload(id: string): Promise<SharedPayload | null> {
    if (!id) return null;
    if (typeof caches === 'undefined') return null;

    const key = shareCacheKeyUrl(id);

    let response: Response | undefined;
    let cache: Cache;
    try {
        cache = await caches.open(SHARE_CACHE_NAME);
        response = await cache.match(key);
    } catch {
        return null;
    }
    if (!response) return null;

    const payload = await response
        .json()
        .then(parseSharedPayload)
        .catch(() => null);

    try {
        await cache.delete(key);
    } catch {
        /* Una caché que no deja borrar no invalida el compartir que ya se leyó. */
    }

    return payload;
}
