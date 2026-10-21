import type { ProductDraft } from '../types.ts';

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
    | 'fallback-unsafe-url'
    | 'fallback-unauthorized'
    | 'fallback-credits-exhausted'
    | 'fallback-rate-limited'
    | 'fallback-unavailable'
    | 'fallback-empty';

export type FirecrawlResult =
    | {
          ok: true;
          html: string;
          /**
           * URL del documento que el proveedor realmente leyó (`metadata.url`), o `null` si no la
           * publica o no es http(s). Es la base para resolver las URLs relativas del HTML: con una
           * redirección de por medio, usar la URL pedida produce enlaces e imágenes rotos.
           */
          finalUrl: string | null;
      }
    | { ok: false; reason: FirecrawlFailure };

/**
 * Fallos que un scraper externo **sí** puede resolver: el sitio puso un muro. Los demás —un nombre
 * que no resuelve, un timeout, una redirección rota— no los arregla nadie pagando, y cada intento
 * cuesta un crédito.
 *
 * Esto faltaba: la primera versión gastaba ante **cualquier** fallo de transporte, así que un enlace
 * con el dominio mal escrito quemaba un crédito para nada. Lo levantó el refutador del linaje
 * `review-aaff4fb6c121fca1`.
 *
 * Se comparan como texto y no contra la unión `SafeFetchReason` a propósito: `blocked-by-site` y
 * `http-error` los introduce la rama `fix/muro-anti-bot`, que todavía no está fusionada, y este
 * módulo no puede cerrarse contra un tipo que aún no existe acá. Mientras esa rama no entre, un muro
 * llega igual por el otro disparador —una página sin precio ni imagen es `empty-draft`—, así que el
 * respaldo sigue saltando donde debe.
 */
const FALLOS_QUE_JUSTIFICAN_GASTO: readonly string[] = ['blocked-by-site', 'http-error'];

/** Lo que se sabe después del camino propio: cómo falló, o qué dejó cuando no falló. */
export type FallbackEvidence = {
    /** Motivo del fallo de transporte, o `null` si la página llegó. */
    failureReason: string | null;
    draft?: { price: unknown; imageUrl: unknown } | null;
};

/**
 * ¿Hay que gastar un crédito? Decisión del propietario (D1(b)): cuando el transporte topó con un
 * **muro**, o cuando la página llegó pero no dio **ni precio ni imagen**.
 *
 * Un solo campo ausente no alcanza: la descripción o el nombre de la tienda faltan en muchas
 * páginas que sí traen lo que el usuario vino a buscar, y cada intento cuesta.
 */
export function needsFallback(evidence: FallbackEvidence): FallbackTrigger | null {
    const { failureReason, draft = null } = evidence;

    if (failureReason !== null) {
        return FALLOS_QUE_JUSTIFICAN_GASTO.includes(failureReason) ? 'transport-failed' : null;
    }

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

    return { ok: true, html, finalUrl: urlDelDocumento(datos?.metadata) };
}

/**
 * La URL que el proveedor declara haber leído. `metadata.url` es la del documento final; si falta o
 * no es http(s) —un `ftp:`, un número, basura— se devuelve `null` y el llamador usa la suya.
 */
function urlDelDocumento(metadata: unknown): string | null {
    const registro = asRecord(metadata);
    const candidata = registro?.url ?? registro?.sourceURL;
    if (typeof candidata !== 'string') return null;

    try {
        const url = new URL(candidata.trim());
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
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

/**
 * Fusiona el borrador del camino propio con el del respaldo **campo por campo**, sin perder nada.
 *
 * La regla no es «gana el primero que trae algo»: **gana el respaldo donde declara un valor**, y el
 * directo cubre los huecos. El respaldo leyó la página renderizada, así que cuando los dos traen un
 * título el suyo es el bueno; cuando no trae nada de un campo, el valor del directo se conserva.
 *
 * Esa segunda mitad es la que exige el refutador de `review-9546ed1ed63e9f92`: reemplazar el
 * borrador directo **entero** dejaba al usuario con menos datos y cacheaba la pérdida. Acá nada se
 * pierde, porque cada campo vacío del respaldo se toma del directo.
 *
 * Las notas se recalculan con lo mismo: una nota que decía «no se encontró el precio» deja de ser
 * cierta si el respaldo lo trajo, y una nota vieja no se guarda como si fuera historia.
 */
export function mergeFallbackDraft(direct: ProductDraft | null, fallback: ProductDraft): ProductDraft {
    if (direct === null) return fallback;

    // **El respaldo gana donde trae algo**, no el directo: el respaldo leyó la página ya
    // renderizada, así que es el testigo mejor informado. Medido en el e2e del 2026-10-21: con el
    // orden inverso, una página de challenge dejaba su `<title>` («Just a moment...») en el deseo
    // final mientras el respaldo aportaba precio e imagen. El directo sigue cubriendo los huecos,
    // así que no se pierde nada.
    const fusionado: ProductDraft = {
        url: direct.url,
        title: fallback.title ?? direct.title,
        price: fallback.price ?? direct.price,
        imageUrl: fallback.imageUrl ?? direct.imageUrl,
        siteName: fallback.siteName ?? direct.siteName,
        description: fallback.description ?? direct.description,
        notes: direct.notes,
    };

    fusionado.notes = notasQueSiguenSiendoCiertas(direct.notes, fusionado);
    return fusionado;
}

/** Descarta las notas de un campo que ya tiene valor. El texto lo escribió `extract/index.ts`. */
function notasQueSiguenSiendoCiertas(notas: readonly string[], draft: ProductDraft): string[] {
    return notas.filter((nota) => {
        const texto = nota.toLowerCase();
        if (draft.price !== null && texto.includes('precio')) return false;
        if (draft.imageUrl !== null && texto.includes('imagen')) return false;
        return true;
    });
}
