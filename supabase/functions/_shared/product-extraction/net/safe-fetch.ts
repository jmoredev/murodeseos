/**
 * Capa de red de la extracción: pide una URL de producto con los headers de navegador,
 * topes de tamaño y de tiempo, y una guarda SSRF que se re-ejecuta en **cada salto**.
 *
 * Garantías duras:
 *
 * - **Nunca tira.** Con cualquier entrada (basura, sin red, cuerpo colgado) devuelve un
 *   resultado discriminado. Un deseo sin datos es mejor que un fallo al compartir.
 * - **No sigue redirecciones solo.** Se pide con `redirect: 'manual'` y cada `Location` se
 *   vuelve a pasar por `guardUrl` antes de pedirla: una redirección a `169.254.169.254` no se
 *   llega a pedir nunca.
 * - **Un solo presupuesto de tiempo** para toda la cadena, no uno por salto. El mismo
 *   `AbortSignal` corta la petición y la lectura del cuerpo.
 * - **Un tope de bytes** que trunca en vez de fallar: una página de 5 MB sigue sirviendo para
 *   leer el precio, y el truncado se declara en `truncated`.
 * - **Solo los headers canónicos** de `headers.ts`; el llamador no puede inyectar cabeceras.
 *
 * Lo que **no** cubre, y es deliberado: el SSRF basado en **DNS**. Sin un `resolveHost`, un
 * nombre público que resuelve a una dirección privada no se detecta, porque resolver es E/S
 * asíncrona que este módulo no hace. En T5 el runtime inyecta `resolveHost` (con
 * `Deno.resolveDns`) y entonces **cada** dirección resuelta se contrasta contra
 * `blockedIpReason`. Sin ese resolvedor, esta guarda es incompleta frente a DNS rebinding.
 */

import { buildBrowserHeaders } from './headers.ts';
import { blockedIpReason, guardUrl, isIpLiteral, type GuardReason } from './url-guard.ts';

/** Motivos de fallo de `safeFetch`. Incluye los de `guardUrl` y los propios de la red. */
export type SafeFetchReason =
    | GuardReason
    | 'dns-failed'
    | 'redirect-without-location'
    | 'redirect-invalid-location'
    | 'too-many-redirects'
    | 'body-read-failed'
    | 'timeout'
    | 'fetch-failed';

/** Lector mínimo compatible con `ReadableStreamDefaultReader`. */
export type BodyReader = {
    read(): Promise<{ done: boolean; value?: Uint8Array }>;
    cancel(reason?: unknown): Promise<void> | void;
};

export type ResponseBodyLike = { getReader(): BodyReader };

/**
 * Lo mínimo que `safeFetch` necesita de una respuesta. Es estructural a propósito: un
 * `Response` real lo satisface, y un doble de test se escribe como un objeto plano.
 */
export type FetchResponseLike = {
    status: number;
    headers: { get(name: string): string | null };
    body: ResponseBodyLike | null;
};

export type FetchInitLike = {
    redirect: 'manual';
    headers: Record<string, string>;
    signal: AbortSignal;
};

/** Firma inyectable de `fetch`; el `fetch` global la satisface. */
export type FetchLike = (url: string, init: FetchInitLike) => Promise<FetchResponseLike>;

/** Resolvedor de DNS inyectable. Cada dirección devuelta se contrasta contra la guarda. */
export type ResolveHost = (host: string) => Promise<string[]>;

export type SafeFetchOptions = {
    /** Implementación de `fetch`. Por defecto, la global. */
    fetchImpl?: FetchLike;
    /**
     * Resolvedor inyectable. En T5 será `Deno.resolveDns`. **Sin él no se cubre el SSRF por
     * DNS**: un nombre público que resuelve a una dirección privada pasa la guarda de texto.
     */
    resolveHost?: ResolveHost;
    /** Saltos permitidos. Por defecto `DEFAULT_MAX_REDIRECTS`. */
    maxRedirects?: number;
    /** Tope de bytes del cuerpo. Se trunca, no se falla. Por defecto `DEFAULT_MAX_BYTES`. */
    maxBytes?: number;
    /** Presupuesto total de tiempo en milisegundos, para toda la cadena. */
    timeoutMs?: number;
};

export type SafeFetchSuccess = {
    ok: true;
    status: number;
    /** URL del último salto, ya normalizada. */
    finalUrl: string;
    contentType: string | null;
    body: string;
    /** `true` cuando el cuerpo superó el tope y se cortó. El cuerpo sigue siendo utilizable. */
    truncated: boolean;
};

export type SafeFetchFailure = {
    ok: false;
    reason: SafeFetchReason;
    /** Última URL intentada, o `null` si ni siquiera se pudo parsear. */
    finalUrl: string | null;
    /** Estado HTTP del salto que falló, o `null` si no hubo respuesta. */
    status: number | null;
};

export type SafeFetchResult = SafeFetchSuccess | SafeFetchFailure;

/** Cinco saltos cubren cualquier acortador o redirección de tienda real. */
export const DEFAULT_MAX_REDIRECTS = 5;

/**
 * 8 MB: por encima de la página de producto más grande medida (El Corte Inglés, 5,2 MB en
 * vivo) para no truncar una página real, y acotado para que la memoria no dependa del
 * servidor remoto. El truncado se declara, así que bajar el tope no rompe la extracción.
 */
export const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

/** Diez segundos para toda la cadena: una página de producto grande entra de sobra. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Pide una URL de producto de forma segura. **Nunca tira**: cualquier fallo se devuelve como
 * `{ ok: false, reason }`. Ver el comentario de cabecera para lo que cubre y lo que no.
 */
export async function safeFetch(rawUrl: unknown, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
    let finalUrl: string | null = null;
    let timedOut = false;

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const temporizador = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    try {
        const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
        if (!fetchImpl) return fallo('fetch-failed', finalUrl, null);

        const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
        const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
        let actual: unknown = rawUrl;

        for (let salto = 0; salto <= maxRedirects; salto += 1) {
            const guarda = guardUrl(actual);
            if (!guarda.ok) return fallo(guarda.reason, finalUrl, null);
            finalUrl = guarda.url;

            if (options.resolveHost) {
                const host = new URL(guarda.url).hostname;
                // Un literal IP ya pasó la guarda de texto; resolverlo no aporta y algunos
                // resolvedores rechazan direcciones IP como entrada.
                if (!isIpLiteral(host)) {
                    let direcciones: string[];
                    try {
                        direcciones = await conAborto(options.resolveHost(host), controller.signal);
                    } catch {
                        return fallo(timedOut ? 'timeout' : 'dns-failed', finalUrl, null);
                    }
                    for (const direccion of direcciones) {
                        const bloqueo = blockedIpReason(direccion);
                        if (bloqueo) return fallo(bloqueo, finalUrl, null);
                    }
                }
            }

            let response: FetchResponseLike;
            try {
                response = await fetchImpl(guarda.url, {
                    redirect: 'manual',
                    headers: buildBrowserHeaders(),
                    signal: controller.signal,
                });
            } catch {
                return fallo(timedOut ? 'timeout' : 'fetch-failed', finalUrl, null);
            }

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                const status = response.status;
                await descartarCuerpo(response);
                if (!location) return fallo('redirect-without-location', finalUrl, status);
                if (salto === maxRedirects) return fallo('too-many-redirects', finalUrl, status);

                try {
                    actual = new URL(location, guarda.url).href;
                } catch {
                    return fallo('redirect-invalid-location', finalUrl, status);
                }
                continue;
            }

            const contentType = response.headers.get('content-type');
            let leido: { text: string; truncated: boolean };
            try {
                leido = await leerConTope(response, maxBytes);
            } catch {
                return fallo(timedOut ? 'timeout' : 'body-read-failed', finalUrl, response.status);
            }

            return {
                ok: true,
                status: response.status,
                finalUrl,
                contentType,
                body: leido.text,
                truncated: leido.truncated,
            };
        }

        // Inalcanzable: el bucle devuelve en `salto === maxRedirects`. Por si acaso.
        return fallo('too-many-redirects', finalUrl, null);
    } catch {
        return fallo(timedOut ? 'timeout' : 'fetch-failed', finalUrl, null);
    } finally {
        clearTimeout(temporizador);
    }
}

function fallo(reason: SafeFetchReason, finalUrl: string | null, status: number | null): SafeFetchFailure {
    return { ok: false, reason, finalUrl, status };
}

/** Lee el cuerpo entero hasta el tope; al pasarlo, corta y marca `truncated`. */
async function leerConTope(
    response: FetchResponseLike,
    maxBytes: number
): Promise<{ text: string; truncated: boolean }> {
    if (!response.body) return { text: '', truncated: false };

    const reader = response.body.getReader();
    const trozos: Uint8Array[] = [];
    let total = 0;
    let truncated = false;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;

        if (total + value.length > maxBytes) {
            const restante = maxBytes - total;
            if (restante > 0) trozos.push(value.subarray(0, restante));
            truncated = true;
            await cancelar(reader);
            break;
        }

        trozos.push(value);
        total += value.length;
    }

    return { text: unirYDecodificar(trozos), truncated };
}

function unirYDecodificar(trozos: Uint8Array[]): string {
    let total = 0;
    for (const trozo of trozos) total += trozo.length;

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const trozo of trozos) {
        bytes.set(trozo, offset);
        offset += trozo.length;
    }

    // Se decodifica como UTF-8: el `charset` del Content-Type no se reinterpreta acá. En la
    // práctica las tiendas de los fixtures publican UTF-8; una página latin-1 saldría con
    // mojibake en los acentos, no rota.
    return new TextDecoder().decode(bytes);
}

async function descartarCuerpo(response: FetchResponseLike): Promise<void> {
    if (!response.body) return;
    await cancelar(response.body.getReader());
}

async function cancelar(reader: BodyReader): Promise<void> {
    try {
        await reader.cancel();
    } catch {
        // El cuerpo ya no importa: cancelar es cortesía con la conexión, no un requisito.
    }
}

/** Carrera entre una promesa cualquiera y el aborto, para que el resolvedor respete el tope. */
function conAborto<T>(promesa: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));

    return new Promise<T>((resolve, reject) => {
        const alAbortar = () => reject(new DOMException('Aborted', 'AbortError'));
        signal.addEventListener('abort', alAbortar, { once: true });
        promesa.then(
            (valor) => {
                signal.removeEventListener('abort', alAbortar);
                resolve(valor);
            },
            (error: unknown) => {
                signal.removeEventListener('abort', alAbortar);
                reject(error);
            }
        );
    });
}
