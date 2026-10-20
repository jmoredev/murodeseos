/**
 * Decisión de cuota por usuario, **pura** y sin estado.
 *
 * La ventana es fija y alineada al reloj de época (`floor(now / ventana)`), no una ventana
 * deslizante: así dos peticiones simultáneas calculan **el mismo** `window_start`, que es lo que
 * permite que el upsert del SQL sea atómico sobre una única fila.
 *
 * La parte atómica —insertar o incrementar solo si no se alcanzó el límite, y devolver el conteo
 * resultante— la hace `public.consume_product_extraction_quota` (ver la migración). Esta función
 * es la mitad que se puede probar sin base de datos: fija la aritmética de la ventana y del
 * `retryAfterSeconds` que la Edge Function pone en el `429`.
 */

export type QuotaDecision = {
    allowed: boolean;
    /** Segundos hasta el próximo intento cuando `allowed` es `false`; `0` cuando se permite. */
    retryAfterSeconds: number;
};

/** Ventana fija alineada a época: `[startMs, endMs)`. */
export function computeQuotaWindow(
    nowMs: number,
    windowSeconds: number
): { startMs: number; endMs: number } {
    const ventanaMs = windowSeconds * 1000;
    const startMs = Math.floor(nowMs / ventanaMs) * ventanaMs;
    return { startMs, endMs: startMs + ventanaMs };
}

/**
 * Decide a partir del conteo ya gastado en la ventana. `count < limit` permite; si no, el reintento
 * es el resto de la ventana redondeado hacia arriba, con un mínimo de 1 segundo para que un valor
 * de ventana ya vencido no produzca un `retryAfterSeconds: 0` que invite a reintentar en bucle.
 */
export function decideQuota(params: {
    count: number;
    limit: number;
    nowMs: number;
    windowEndMs: number;
}): QuotaDecision {
    const { count, limit, nowMs, windowEndMs } = params;
    if (count < limit) return { allowed: true, retryAfterSeconds: 0 };

    const faltanMs = windowEndMs - nowMs;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(faltanMs / 1000)) };
}
