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
 *
 * **DNS rebinding: cerrado por el transporte, no por la guarda.** Validar el nombre no alcanza
 * mientras la conexión la haga un `fetch` que vuelve a resolver: un nombre controlado por el
 * atacante puede responder público al resolvedor y privado al socket. Por eso el transporte por
 * defecto es `pinnedFetch` (`pinned-http.ts`), que conecta a la **dirección ya validada** y usa el
 * nombre real solo como SNI. La segunda resolución de cada salto se queda igual como defensa en
 * profundidad: si el nombre cambió de opinión entre la validación y la conexión, se corta sin
 * pedir, y eso sigue nombrando el fallo con un motivo propio.
 */

import { buildBrowserHeaders } from './headers.ts';
import { pinnedFetch } from './pinned-http.ts';
import { blockedIpReason, guardUrl, isIpLiteral, type GuardReason } from './url-guard.ts';

/** Motivos de fallo de `safeFetch`. Incluye los de `guardUrl` y los propios de la red. */
export type SafeFetchReason =
    | GuardReason
    | 'dns-failed'
    | 'dns-changed'
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
    /**
     * Dirección ya validada de este salto. El transporte por defecto conecta ahí en vez de volver a
     * resolver el nombre; un `fetch` de verdad la ignora, y los dobles de test también.
     */
    address?: string;
};

/** Firma inyectable de `fetch`; `pinnedFetch` (y el `fetch` global) la satisfacen. */
export type FetchLike = (url: string, init: FetchInitLike) => Promise<FetchResponseLike>;

/** Resolvedor de DNS inyectable. Cada dirección devuelta se contrasta contra la guarda. */
export type ResolveHost = (host: string) => Promise<string[]>;

export type SafeFetchOptions = {
    /** Implementación de `fetch`. Por defecto, `pinnedFetch` sobre la dirección validada. */
    fetchImpl?: FetchLike;
    /**
     * Resolvedor inyectable. En T5 será `Deno.resolveDns`. **Sin él no se cubre el SSRF por
     * DNS**: un nombre público que resuelve a una dirección privada pasa la guarda de texto.
     *
     * Con él se resuelve **dos veces por salto**: la primera para validar cada dirección y para
     * tener la IP a la que se conecta (el transporte la fija, así que el nombre no se vuelve a
     * resolver), la segunda justo antes de pedir, para negarse si el nombre cambió de opinión.
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
        // Por defecto, el cliente propio: conecta a la IP validada y no vuelve a resolver el
        // nombre, que es lo que cierra el DNS rebinding. Los tests inyectan su doble de siempre.
        const fetchImpl = options.fetchImpl ?? pinnedFetch;

        const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
        const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
        let actual: unknown = rawUrl;

        for (let salto = 0; salto <= maxRedirects; salto += 1) {
            const guarda = guardUrl(actual);
            if (!guarda.ok) return fallo(guarda.reason, finalUrl, null);
            finalUrl = guarda.url;

            // Direcciones a las que el transporte puede conectar en este salto, en orden. Se
            // resuelven por salto: la que valida un salto no sirve para el siguiente.
            let destinos: (string | undefined)[] = [undefined];

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
                    // Una lista vacía no es una aprobación: sin direcciones el bucle de abajo no
                    // itera y el `fetch` seguiría hacia una dirección que nadie contrastó (pasa
                    // con un resolvedor que solo consulta una familia, o con una respuesta vacía
                    // transitoria). No hay nada que validar, así que se falla cerrado con el
                    // motivo que ya existe para «el nombre no resolvió a nada usable».
                    if (direcciones.length === 0) return fallo('dns-failed', finalUrl, null);
                    for (const candidata of direcciones) {
                        const bloqueo = blockedIpReason(candidata);
                        if (bloqueo) return fallo(bloqueo, finalUrl, null);
                    }

                    // Defensa en profundidad: se resuelve de nuevo, una sola vez, y se compara con
                    // el conjunto ya validado. El transporte ya conecta a la IP, así que este
                    // control es redundante para el rebinding; se queda porque un nombre que
                    // cambia de opinión merece su propio motivo (`dns-changed`) y porque cerrar
                    // cerrado ante un DNS inestable no cuesta nada.
                    let reconfirmadas: string[];
                    try {
                        reconfirmadas = await conAborto(options.resolveHost(host), controller.signal);
                    } catch {
                        // Sin segunda respuesta no hay nada que comparar: se falla cerrado, porque
                        // un resolvedor que revienta no es permiso para pedir.
                        return fallo(timedOut ? 'timeout' : 'dns-failed', finalUrl, null);
                    }

                    // La reconfirmación vacía tampoco se puede comparar: sin direcciones no hay
                    // conjunto, y un nombre que dejó de resolver no es permiso para pedir.
                    if (reconfirmadas.length === 0) return fallo('dns-failed', finalUrl, null);

                    // Si la nueva respuesta trae una dirección prohibida, el motivo que ya existe
                    // para ese rango es el que nombra lo que pasó.
                    for (const candidata of reconfirmadas) {
                        const bloqueo = blockedIpReason(candidata);
                        if (bloqueo) return fallo(bloqueo, finalUrl, null);
                    }
                    // Cambiar a **otra dirección pública** tampoco se pide: ninguna regla
                    // `blocked-ip-*` lo nombra, así que el motivo es el cambio en sí.
                    if (!mismoConjuntoDeDirecciones(direcciones, reconfirmadas)) {
                        return fallo('dns-changed', finalUrl, null);
                    }

                    // La IP fijada del salto: todas las direcciones de arriba pasaron la guarda, así
                    // que todas sirven como destino y se prueban en orden hasta que una conteste.
                    destinos = direcciones;
                }
            }

            // Cada dirección recibe una porción del presupuesto que queda: una IP en negro no puede
            // comerse el tiempo de las demás, o el bucle no sirve para nada. El reloj global sigue
            // siendo el tope duro, y su aborto corta todo.
            const inicioSalto = Date.now();
            const restante = () => Math.max(1, timeoutMs - (Date.now() - inicioSalto));
            let response: FetchResponseLike | null = null;

            for (let indice = 0; indice < destinos.length; indice += 1) {
                const destino = destinos[indice];
                const porcion = Math.max(25, Math.floor(restante() / (destinos.length - indice)));
                const turno = new AbortController();
                const alAbortarGlobal = () => turno.abort();
                controller.signal.addEventListener('abort', alAbortarGlobal, { once: true });
                const relojDelTurno = setTimeout(() => turno.abort(), porcion);

                try {
                    response = await fetchImpl(guarda.url, {
                        redirect: 'manual',
                        headers: buildBrowserHeaders(),
                        signal: turno.signal,
                        address: destino,
                    });
                    // El cuerpo sigue vivo después del intento: el turno deja de correr, pero el
                    // aborto global se queda enganchado para poder cortar la lectura.
                    clearTimeout(relojDelTurno);
                    break;
                } catch {
                    clearTimeout(relojDelTurno);
                    controller.signal.removeEventListener('abort', alAbortarGlobal);
                    // Una dirección que no contesta dentro de su turno no condena la página: se pasa
                    // a la siguiente. Es el tope global el que corta todo.
                    if (timedOut) break;
                }
            }

            if (response === null) return fallo(timedOut ? 'timeout' : 'fetch-failed', finalUrl, null);

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

/**
 * Compara dos respuestas del resolvedor como **conjuntos**: el orden y las repeticiones no
 * significan nada, lo que importa es el conjunto de direcciones que el nombre contestó. La
 * comparación es textual a propósito: dos formas distintas de escribir la misma IPv6 se cuentan
 * como cambio, y ese falso positivo empuja a rechazar (fallar cerrado), nunca a pedir.
 */
function mismoConjuntoDeDirecciones(una: readonly string[], otra: readonly string[]): boolean {
    const normalizar = (direcciones: readonly string[]): string[] =>
        [...new Set(direcciones.map((direccion) => direccion.trim().toLowerCase()))].sort();

    const a = normalizar(una);
    const b = normalizar(otra);
    return a.length === b.length && a.every((direccion, indice) => direccion === b[indice]);
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
