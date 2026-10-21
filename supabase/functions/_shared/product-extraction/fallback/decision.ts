/**
 * El respaldo con Firecrawl: **cuándo** se gasta un crédito, **qué** se le pide y **qué** se hace
 * con lo que vuelve. Puro, sin red y sin `Deno`, para que las dos decisiones caras se puedan probar.
 *
 * Contexto y mediciones en `odd/tasks/respaldo-firecrawl.md`. Lo que importa acá:
 *
 * - **Se gasta de a un crédito** (formato `rawHtml`, sin modo JSON, que cuesta +4). Con 1.000
 *   créditos al mes y 12 usuarios, el presupuesto se agota por un predicado generoso mucho antes
 *   que por el volumen real, así que `needsFallback` pide las **dos** señales caras a la vez.
 * - **Se pide el DOM renderizado, no un recorte.** `onlyMainContent: true` (el defecto del
 *   proveedor) elimina el `<head>`, y ahí viven el JSON-LD y el `og:image`: justo las capas que
 *   mejor leen precio e imagen. Con el recorte, el rescate traería una página sin datos.
 * - **Nunca tira.** Un cuerpo raro es `fallback-empty`, no una excepción que tumbe el borrador que
 *   el usuario ya tenía.
 */

/** Tope de la petición al proveedor. Un rescate tarda segundos: 30 s cubre render + red. */
export const FALLBACK_TIMEOUT_MS = 30_000;

/**
 * Ventana del presupuesto: **30 días fijos**, no un mes de calendario.
 *
 * Es la misma convención que la cuota de extracción —ventana fija alineada a época— porque es lo
 * que permite que el `insert ... on conflict` del SQL sea atómico sobre una sola fila. Un mes de
 * calendario exigiría aritmética de fechas en el cliente y en el SQL.
 */
export const FALLBACK_WINDOW_SECONDS = 2_592_000;

/** Por qué se recurre al respaldo. Un `null` significa «no se gasta nada». */
export type FallbackTrigger = 'transport-failed' | 'empty-draft';

/** Motivos de fallo del respaldo. Se suman a los de `safeFetch` en la respuesta del endpoint. */
export type FirecrawlFailure =
    | 'fallback-unauthorized'
    | 'fallback-credits-exhausted'
    | 'fallback-rate-limited'
    | 'fallback-unavailable'
    | 'fallback-empty';

export type FirecrawlResult = { ok: true; html: string } | { ok: false; reason: FirecrawlFailure };

/**
 * ¿Hay que gastar un crédito? Decisión del propietario (D1(b)): cuando el transporte falló, o
 * cuando la página llegó pero no dio **ni precio ni imagen**.
 *
 * Un solo campo ausente no alcanza: la descripción o el nombre de la tienda faltan en muchas
 * páginas que sí traen lo que el usuario vino a buscar, y cada intento cuesta.
 */
export function needsFallback(input: {
    transportOk: boolean;
    draft?: { price: unknown; imageUrl: unknown } | null;
}): FallbackTrigger | null {
    if (!input.transportOk) return 'transport-failed';

    const draft = input.draft ?? null;
    if (draft === null) return 'empty-draft';
    if (draft.price == null && draft.imageUrl == null) return 'empty-draft';

    return null;
}

/** Cuerpo de la petición a `POST /v2/scrape`. */
export function buildFirecrawlPayload(
    url: string,
    timeoutMs: number = FALLBACK_TIMEOUT_MS
): { url: string; formats: string[]; onlyMainContent: boolean; maxAge: number; timeout: number } {
    return {
        url,
        formats: ['rawHtml'],
        // El `<head>` tiene que llegar: ver el comentario de cabecera.
        onlyMainContent: false,
        // El precio no puede venir de una caché del proveedor. Se mantiene en 0 a propósito.
        maxAge: 0,
        timeout: timeoutMs,
    };
}

/**
 * Traduce la respuesta del proveedor a un resultado discriminado. **Nunca tira**: todo lo que no
 * sea un HTML con algo dentro es un motivo nombrado.
 *
 * El orden importa: primero el status (un 402 con cuerpo raro sigue siendo «sin créditos»), después
 * la forma del cuerpo.
 */
export function readFirecrawlResult(status: number, body: unknown): FirecrawlResult {
    if (status === 401 || status === 403) return { ok: false, reason: 'fallback-unauthorized' };
    if (status === 402) return { ok: false, reason: 'fallback-credits-exhausted' };
    if (status === 429) return { ok: false, reason: 'fallback-rate-limited' };
    if (status >= 500) return { ok: false, reason: 'fallback-unavailable' };
    if (status !== 200) return { ok: false, reason: 'fallback-unavailable' };

    const datos = asRecord(asRecord(body)?.data);
    const html = datos?.rawHtml ?? datos?.html;

    if (typeof html !== 'string' || html.trim() === '') {
        return { ok: false, reason: 'fallback-empty' };
    }

    return { ok: true, html };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

/**
 * Nota que se agrega al borrador cuando el respaldo se intentó y no sirvió (S8). Va al usuario tal
 * cual, así que nombra el motivo técnico en vez de esconderlo.
 */
export function fallbackNote(reason: FirecrawlFailure): string {
    return `El respaldo automático tampoco pudo leer la página (${reason}).`;
}
