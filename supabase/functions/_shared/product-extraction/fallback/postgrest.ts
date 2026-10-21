/**
 * El consumo del presupuesto de respaldo por PostgREST, **fuera** de la Edge Function.
 *
 * Misma razón que la cuota de extracción: la función usa APIs de `Deno` y está fuera del `tsc` y del
 * runner, así que lo que se quede allí no se puede probar. Y esto tiene algo que probar: el tope de
 * tiempo y la traducción de cada respuesta.
 *
 * La diferencia con la cuota de extracción es el **significado del fallo**. Sin respuesta del RPC de
 * cuota la extracción se rechaza (`503`), porque la cuota es obligatoria. Acá no: si el presupuesto
 * no se puede consultar, **se deja de gastar** y se devuelve el borrador parcial que el usuario ya
 * tenía. `null` significa «no se pudo saber», y con créditos finitos la lectura segura de eso es
 * «no gastes».
 */
import { CACHE_HTTP_TIMEOUT_MS } from '../cache/postgrest.ts';
import { computeQuotaWindow } from '../quota/decision.ts';
import type { QuotaFetch } from '../quota/postgrest.ts';

/** Resultado del RPC, tal como lo consume el handler. */
export type ConsumoRespaldo = { allowed: boolean; used: number; windowEndMs: number };

function cabecerasDeServicio(clave: string): Record<string, string> {
    return { apikey: clave, authorization: `Bearer ${clave}` };
}

function senalDeTimeout(timeoutMs: number): AbortSignal | undefined {
    return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined;
}

/**
 * Consume un rescate de forma atómica en el SQL (upsert con incremento y `returning`).
 *
 * Devuelve `null` si el RPC no está disponible —respuesta no-ok, cuerpo raro, red o timeout—: el
 * handler lo lee como «no gastes» y devuelve el borrador parcial. **Nunca tira.**
 */
export async function consumirRespaldo({
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
}): Promise<ConsumoRespaldo | null> {
    try {
        const respuestaHttp = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/consume_product_fallback`, {
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
        });
        if (!respuestaHttp.ok) return null;

        const datos: unknown = await respuestaHttp.json();
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
