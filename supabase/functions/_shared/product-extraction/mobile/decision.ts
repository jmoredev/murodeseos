/**
 * ¿Merece la pena pedir la **ficha móvil** de Amazon? Decisión pura, sin red y sin `Deno`, para
 * poder probarla sin tocar el sitio.
 *
 * El problema que resuelve, medido el 2026-10-24: `https://www.amazon.com/dp/B0D1XD1ZV3` contesta
 * un interstitial que ahora `detect-block.ts` nombra como `blocked-by-site`, y entonces el usuario
 * se queda sin precio, sin imagen y con una nota que habla de «varios precios». La ficha móvil
 * (`https://www.amazon.<tld>/gp/aw/d/<ASIN>`) sí es una página: en `amazon.es` trae los 89,99 € que
 * el adaptador lee en `#corePrice_feature_div .a-offscreen`, y en la móvil de `.com` al menos trae
 * el título y la imagen del producto.
 *
 * Dos cosas se cuidan acá, porque las dos cuestan:
 *
 * - **Como mucho una petición extra**, y solo si el camino directo no sirvió: un muro, o una
 *   página que llegó vacía. Con un precio ya leído no se pide nada.
 * - **Solo a hosts que el adaptador de Amazon reclama** y **solo si la ruta lleva un ASIN**: sin
 *   ASIN no hay ficha móvil que pedir, y una URL inventada es una petición regalada al sitio.
 *
 * Queda fuera, a propósito, `amazon.eu`: **no es una tienda** (responde `302` a
 * `https://www.aboutamazon.eu/`). Cuando el propietario dice «amazon.eu» se refiere a las tiendas
 * europeas —`amazon.es`, `.de`, `.fr`, `.it`—, que sí entran por el adaptador.
 */

import { amazonAdapter } from '../adapters/amazon.ts';
import { findAdapter } from '../adapters/index.ts';

/**
 * Las tres formas de la ruta de una ficha de producto que llevan el ASIN en el camino. Se piden
 * diez caracteres alfanuméricos —es la forma del ASIN— y que la ruta termine ahí o siga con `/` o
 * `?`, para no leer `B09B8X9RGMX` como si fuera `B09B8X9RGM`.
 */
const RUTAS_CON_ASIN: readonly RegExp[] = [
    /^\/dp\/([a-z0-9]{10})(?:[/?]|$)/i,
    /^\/gp\/product\/([a-z0-9]{10})(?:[/?]|$)/i,
    /^\/gp\/aw\/d\/([a-z0-9]{10})(?:[/?]|$)/i,
];

/** Lo que se sabe del camino directo. Mismo vocabulario que `needsFallback`. */
export type EvidenciaFichaMovil = {
    /** URL que pidió el usuario. */
    url: unknown;
    /** Motivo del fallo de transporte, o `null` si la página llegó. */
    failureReason: string | null;
    /** Lo que dejó el camino directo, o `null` si no hubo cuerpo. */
    draft?: { price: unknown; imageUrl: unknown } | null;
};

/**
 * ASIN de la ruta, en mayúsculas, o `null` si la URL no es de una ficha de Amazon. **Nunca tira**:
 * una URL que no parsea, un número o `null` devuelven `null`.
 */
export function leerAsin(url: unknown): string | null {
    if (typeof url !== 'string') return null;

    let parseada: URL;
    try {
        parseada = new URL(url);
    } catch {
        return null;
    }
    if (parseada.protocol !== 'http:' && parseada.protocol !== 'https:') return null;
    // Se pregunta al registro de adaptadores en vez de a `claimsHost` a mano: `findAdapter`
    // normaliza el host (sin `www.`) en un solo sitio, y dos normalizaciones distintas acabarían
    // discrepando sobre qué es una ficha de Amazon.
    if (findAdapter(url) !== amazonAdapter) return null;

    for (const ruta of RUTAS_CON_ASIN) {
        const coincidencia = ruta.exec(parseada.pathname);
        if (coincidencia) return coincidencia[1].toUpperCase();
    }
    return null;
}

/**
 * URL de la ficha móvil en el **mismo host** que pidió el usuario, o `null` si no hay ASIN. Se
 * descartan query y hash: `?th=1&psc=1` apunta a una variante concreta, y la móvil sirve la ficha
 * del ASIN a secas —que es la que trae el bloque de precio—.
 */
export function urlDeFichaMovil(url: unknown): string | null {
    const asin = leerAsin(url);
    if (asin === null) return null;

    try {
        const base = new URL(url as string);
        const destino = new URL(base.origin);
        destino.pathname = `/gp/aw/d/${asin}`;
        return destino.href;
    } catch {
        return null;
    }
}

/**
 * ¿Se pide la ficha móvil? Solo cuando el camino directo **no alcanzó** y la URL es una ficha de
 * Amazon con ASIN legible.
 *
 * El criterio de «no alcanzó» es el mismo que el del respaldo, para no tener dos baremos:
 *
 * - hubo **muro** (`blocked-by-site`) → sí, el cuerpo era una página de rechazo, no la ficha;
 * - la página llegó pero **no dio ni precio ni imagen** → sí, es la misma página vacía que
 *   justificaría un crédito de Firecrawl;
 * - cualquier otro fallo —un timeout, un `404`, un nombre que no resuelve— **no**: no se arregla
 *   pidiendo otra URL, y sería una petición regalada.
 */
export function debeIntentarFichaMovil(evidencia: EvidenciaFichaMovil): boolean {
    if (urlDeFichaMovil(evidencia.url) === null) return false;

    const { failureReason, draft = null } = evidencia;

    if (failureReason !== null) return failureReason === 'blocked-by-site';

    if (draft === null) return true;
    return draft.price == null && draft.imageUrl == null;
}
