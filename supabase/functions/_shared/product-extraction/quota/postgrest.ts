/**
 * El consumo de cuota por PostgREST, **fuera** de la Edge Function.
 *
 * Vive acá por el mismo motivo que la caché: la función usa APIs de `Deno` y está fuera del
 * `tsc` y del runner, así que lo que se queda allí no se puede probar. Y esto tiene algo que
 * probar: el **timeout**.
 *
 * La cuota no es opcional —se consume **antes** de pedir la página—, así que un `fetch` sin tope
 * convierte a PostgREST en un cuelgue de la extracción entera: acepta la conexión, deja de
 * contestar y el usuario no recibe ni el borrador ni el error. El tope no salta la cuota: la
 * traduce a `null`, que el handler ya convierte en el `503 quota-unavailable` que documenta. Sin
 * respuesta del RPC no se puede afirmar que la cuota se haya consumido, y adivinar hacia
 * cualquiera de los dos lados sería peor que decir «no disponible».
 */
import { CACHE_HTTP_TIMEOUT_MS } from '../cache/postgrest.ts';
import { computeQuotaWindow } from './decision.ts';

/** El `fetch` inyectable: en producción el de Deno, en las pruebas uno de mentira. */
export type QuotaFetch = (
    url: string,
    init: {
        method?: string;
        headers: Record<string, string>;
        body?: string;
        signal?: AbortSignal;
    },
) => Promise<Response>;

/** Resultado del RPC, tal como lo consume el handler. */
export type ConsumoCuota = { allowed: boolean; used: number; windowEndMs: number };

/** Cabeceras de servicio: el RPC solo es ejecutable con la `service_role`. */
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
 * Consume cuota de forma atómica en el SQL (upsert con incremento y `returning`).
 *
 * Devuelve `null` si el RPC no está disponible —respuesta no-ok, cuerpo raro, red o timeout—: el
 * handler lo traduce a `503` y **no** se salta la cuota. Nunca tira.
 *
 * `ahoraMs` es el reloj que ya leyó el handler: sirve para calcular la ventana de respaldo cuando
 * el RPC no devuelve una fecha usable, y así el resultado no depende de un segundo `Date.now()`.
 */
export async function consumirCuota({
    supabaseUrl,
    serviceRoleKey,
    userId,
    limite,
    ventanaSegundos,
    ahoraMs,
    fetchImpl = fetch as unknown as QuotaFetch,
    timeoutMs = CACHE_HTTP_TIMEOUT_MS,
}: {
    supabaseUrl: string;
    serviceRoleKey: string;
    userId: string;
    limite: number;
    ventanaSegundos: number;
    ahoraMs: number;
    fetchImpl?: QuotaFetch;
    timeoutMs?: number;
}): Promise<ConsumoCuota | null> {
    try {
        const respuestaHttp = await fetchImpl(
            `${supabaseUrl}/rest/v1/rpc/consume_product_extraction_quota`,
            {
                method: 'POST',
                headers: {
                    ...cabecerasDeServicio(serviceRoleKey),
                    'content-type': 'application/json',
                    accept: 'application/json',
                },
                body: JSON.stringify({
                    p_user_id: userId,
                    p_limit: limite,
                    p_window_seconds: ventanaSegundos,
                }),
                signal: senalDeTimeout(timeoutMs),
            }
        );
        if (!respuestaHttp.ok) return null;

        const datos: unknown = await respuestaHttp.json();
        // `returns table` llega como lista de una fila; la fila suelta también se acepta porque
        // era parte del contrato anterior.
        const fila = (Array.isArray(datos) ? datos[0] : datos) as
            | { allowed?: unknown; used?: unknown; window_end?: unknown }
            | null;
        if (fila === null || typeof fila !== 'object' || typeof fila.allowed !== 'boolean') {
            return null;
        }

        const ventanaFin = Date.parse(String(fila.window_end));
        const finRespaldo = computeQuotaWindow(ahoraMs, ventanaSegundos).endMs;

        return {
            allowed: fila.allowed,
            used: typeof fila.used === 'number' ? fila.used : 0,
            windowEndMs: Number.isFinite(ventanaFin) ? ventanaFin : finRespaldo,
        };
    } catch {
        return null;
    }
}
