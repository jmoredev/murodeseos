/**
 * Las dos llamadas HTTP de la caché (PostgREST), **fuera** de la Edge Function.
 *
 * Viven acá por el mismo motivo que la lectura del entorno: la función usa APIs de `Deno` y está
 * fuera del `tsc` y del runner, así que lo que se queda allí no se puede probar. Y esto tiene algo
 * que probar: el **timeout**.
 *
 * La caché es **opcional** y `guardarEnCache` es *best-effort*, pero un `fetch` sin timeout la
 * convierte en un punto único de cuelgue: `leerDeCache` se espera antes de consumir cuota y
 * `guardarEnCache` antes de responder, así que un PostgREST que no contesta dejaría al usuario sin
 * extracción —y sin respuesta— por un componente que no hace falta para nada.
 */

/** El `fetch` inyectable: en producción el de Deno, en las pruebas uno de mentira. */
export type CacheFetch = (
    url: string,
    init: {
        method?: string;
        headers: Record<string, string>;
        body?: string;
        signal?: AbortSignal;
    },
) => Promise<Response>;

/**
 * Tope de espera de la caché. Corto a propósito: la caché no puede dominar la latencia de una
 * extracción que, sin ella, tarda segundos pero termina.
 */
export const CACHE_HTTP_TIMEOUT_MS = 2000;

export type CacheHit = { draft: unknown; cachedAt: string };

/** Cabeceras de servicio: la caché solo es accesible con la `service_role`, por RLS sin políticas. */
function cabecerasDeServicio(clave: string): Record<string, string> {
    return { apikey: clave, authorization: `Bearer ${clave}` };
}

/**
 * La señal que corta el `fetch` cuando pasa el tope.
 *
 * `AbortSignal.timeout` existe en Deno y en los Node modernos; si no estuviera, se devuelve
 * `undefined` y el `fetch` sigue sin tope (el comportamiento anterior) en vez de romper.
 */
function senalDeTimeout(timeoutMs: number): AbortSignal | undefined {
    return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined;
}

/**
 * Busca una fila vigente para la clave.
 *
 * Cualquier cosa que salga mal —tabla ausente, red, timeout, JSON raro— es un **miss**: la
 * extracción no depende de que la caché exista, y nunca puede tirar.
 */
export async function leerDeCache({
    supabaseUrl,
    serviceRoleKey,
    cacheKey,
    ahoraMs,
    fetchImpl = fetch as unknown as CacheFetch,
    timeoutMs = CACHE_HTTP_TIMEOUT_MS,
}: {
    supabaseUrl: string;
    serviceRoleKey: string;
    cacheKey: string;
    ahoraMs: number;
    fetchImpl?: CacheFetch;
    timeoutMs?: number;
}): Promise<CacheHit | null> {
    try {
        const url = new URL(`${supabaseUrl}/rest/v1/product_extraction_cache`);
        url.searchParams.set('cache_key', `eq.${cacheKey}`);
        url.searchParams.set('expires_at', `gt.${new Date(ahoraMs).toISOString()}`);
        url.searchParams.set('select', 'draft,created_at');
        url.searchParams.set('limit', '1');

        const respuestaHttp = await fetchImpl(url.toString(), {
            headers: { ...cabecerasDeServicio(serviceRoleKey), accept: 'application/json' },
            signal: senalDeTimeout(timeoutMs),
        });
        if (!respuestaHttp.ok) return null;

        const filas: unknown = await respuestaHttp.json();
        if (!Array.isArray(filas) || filas.length === 0) return null;

        const fila = filas[0] as { draft?: unknown; created_at?: unknown };
        if (fila === null || typeof fila !== 'object' || !('draft' in fila)) return null;

        return {
            draft: fila.draft,
            cachedAt: typeof fila.created_at === 'string' ? fila.created_at : '',
        };
    } catch {
        return null;
    }
}

/**
 * Guarda el borrador. Es **best-effort**: si falla o se pasa del tope, la respuesta al usuario no
 * cambia, porque ya tiene su borrador. Se guardan solo los aciertos de la extracción.
 */
export async function guardarEnCache({
    supabaseUrl,
    serviceRoleKey,
    cacheKey,
    draft,
    finalUrl,
    ttlSegundos,
    ahoraMs,
    fetchImpl = fetch as unknown as CacheFetch,
    timeoutMs = CACHE_HTTP_TIMEOUT_MS,
}: {
    supabaseUrl: string;
    serviceRoleKey: string;
    cacheKey: string;
    draft: unknown;
    finalUrl: string;
    ttlSegundos: number;
    ahoraMs: number;
    fetchImpl?: CacheFetch;
    timeoutMs?: number;
}): Promise<void> {
    try {
        await fetchImpl(`${supabaseUrl}/rest/v1/product_extraction_cache`, {
            method: 'POST',
            headers: {
                ...cabecerasDeServicio(serviceRoleKey),
                'content-type': 'application/json',
                prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify([
                {
                    cache_key: cacheKey,
                    draft,
                    final_url: finalUrl,
                    created_at: new Date(ahoraMs).toISOString(),
                    expires_at: new Date(ahoraMs + ttlSegundos * 1000).toISOString(),
                },
            ]),
            signal: senalDeTimeout(timeoutMs),
        });
    } catch {
        // La caché no es un requisito: se ignora el fallo.
    }
}
