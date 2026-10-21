/**
 * La llamada HTTP al proveedor, **fuera** de la Edge Function.
 *
 * La red vive acá y no en `index.ts` por la misma razón que la cuota y la caché: la función usa
 * `Deno` y queda fuera del `tsc` y del runner. Con la petición acá, el cuerpo que se manda, el
 * `Bearer` y la traducción de la respuesta se prueban con un `fetch` de mentira.
 *
 * **No usa `pinnedFetch`.** Ese cliente existe para las URLs que llegan del usuario y por eso fija
 * la IP validada y escribe HTTP/1.1 a mano; acá el destino es un host fijo y confiable, y hace falta
 * un `POST` con JSON que `pinnedFetch` no implementa. La guarda SSRF se aplica antes, del lado de la
 * URL del usuario (S7 de la ficha).
 */
import { guardUrl } from '../net/url-guard.ts';
import {
    FALLBACK_TIMEOUT_MS,
    buildFirecrawlPayload,
    readFirecrawlResult,
    type FirecrawlResult,
} from './decision.ts';

/** URL del scrape. Se deja como constante para que la prueba pueda afirmarla tal cual. */
export const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';

/** Lo mínimo que se usa de la respuesta, para poder doblarla en las pruebas. */
export type ScrapeResponseLike = {
    status: number;
    json(): Promise<unknown>;
};

export type ScrapeFetch = (
    url: string,
    init: {
        method: string;
        headers: Record<string, string>;
        body: string;
        signal?: AbortSignal;
    }
) => Promise<ScrapeResponseLike>;

function senalDeTimeout(timeoutMs: number): AbortSignal | undefined {
    return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined;
}

/**
 * Pide la página al proveedor y devuelve su HTML renderizado, o un motivo nombrado.
 *
 * **Nunca tira**: un cuerpo que no es JSON, un timeout o una caída de red son `fallback-unavailable`,
 * porque el handler tiene que poder devolver el borrador parcial que ya tenía (S8).
 */
export async function scrapeWithFirecrawl({
    url,
    apiKey,
    fetchImpl = fetch as unknown as ScrapeFetch,
    timeoutMs = FALLBACK_TIMEOUT_MS,
}: {
    url: string;
    apiKey: string;
    fetchImpl?: ScrapeFetch;
    timeoutMs?: number;
}): Promise<FirecrawlResult> {
    if (!apiKey) return { ok: false, reason: 'fallback-unauthorized' };

    // La guarda SSRF se aplica acá **también**, no solo en el endpoint: este módulo no delega su
    // propia seguridad en el llamador, así que una URL privada no sale nunca hacia un tercero.
    const guarda = guardUrl(url);
    if (!guarda.ok) return { ok: false, reason: 'fallback-unsafe-url' };

    let respuesta: ScrapeResponseLike;
    try {
        respuesta = await fetchImpl(FIRECRAWL_SCRAPE_URL, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${apiKey}`,
                'content-type': 'application/json',
                accept: 'application/json',
            },
            body: JSON.stringify(buildFirecrawlPayload(guarda.url, timeoutMs)),
            signal: senalDeTimeout(timeoutMs),
        });
    } catch {
        return { ok: false, reason: 'fallback-unavailable' };
    }

    const cuerpo = await leerJson(respuesta);
    return readFirecrawlResult(respuesta.status, cuerpo);
}

async function leerJson(respuesta: ScrapeResponseLike): Promise<unknown> {
    try {
        return await respuesta.json();
    } catch {
        return null;
    }
}
