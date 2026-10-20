import { attributeOf, parseHtml, selectOne, textOf, type HtmlDocument, type HtmlNode } from '../extract/html.ts';
import type { DomainAdapter, DomainAdapterFields } from './types.ts';

/**
 * Adaptador declarativo de Amazon.
 *
 * Amazon **no publica** JSON-LD, ni `og:image`, ni microdata en su ficha de producto (L6), así
 * que la cascada genérica se queda sin precio y sin imagen. Este adaptador lee las tres anclas
 * que la medición encontró en la página real:
 *
 * - `#productTitle` → el título del producto.
 * - `#landingImage[data-a-dynamic-image]` → un JSON de variantes `{url: [ancho, alto]}`; se elige
 *   la de **mayor área declarada**, que es evidencia y no una corazonada. Si falta el atributo o
 *   el JSON está roto, cae al `src`.
 * - `#corePrice_feature_div .a-offscreen` → el texto del precio accesible. Solo se devuelve el
 *   texto: lo interpreta `parsePriceText`/`detectCurrency` en la cascada, para no tener un
 *   segundo lector de precios.
 *
 * Si Amazon cambia el HTML y un ancla desaparece, ese campo sale en `null` y la cascada genérica
 * sigue. Nada de acá tira.
 */

/**
 * Un solo adaptador cubre todos los locales de Amazon con el mismo marcado.
 *
 * La forma se aprieta a propósito: dominios + **como mucho** un sufijo de dos o tres letras
 * (`amazon.es`, `amazon.com`, `amazon.com.mx`, `amazon.co.uk`). Con `/^amazon\.[a-z.]+$/`
 * —lo que había primero— también entraba `amazon.es.evil.com`, que es de otro dueño. Hoy el
 * adaptador es un lector puro y no concede confianza, pero un host mal reclamado es la clase de
 * cosa que alguien reusa después para decidir permisos o claves de caché.
 */
const HOSTS_AMAZON = /^amazon\.[a-z]{2,3}(\.[a-z]{2,3})?$/;

/** Variantes candidatas del precio, en orden: el bloque principal y, si falta, el «apex». */
const BLOQUES_DE_PRECIO = ['#corePrice_feature_div', '#apex_desktop'] as const;

export const amazonAdapter: DomainAdapter = {
    name: 'amazon',
    claimsHost: (host) => HOSTS_AMAZON.test(host),
    extract: extraerAmazon,
};

function extraerAmazon(html: string): DomainAdapterFields {
    const documento = parseHtml(html);

    return {
        title: textoONulo(selectOne(documento, '#productTitle')),
        price: leerPrecio(documento),
        currency: null,
        image: leerImagen(documento),
    };
}

function textoONulo(node: HtmlNode | null): string | null {
    const texto = textOf(node);
    return texto === '' ? null : texto;
}

function leerPrecio(documento: HtmlDocument): string | null {
    for (const selector of BLOQUES_DE_PRECIO) {
        const bloque = selectOne(documento, selector);
        if (!bloque) continue;
        const texto = textoONulo(selectOne(bloque, '.a-offscreen'));
        if (texto !== null) return texto;
    }
    return null;
}

function leerImagen(documento: HtmlDocument): string | null {
    const imagen = selectOne(documento, '#landingImage');
    if (!imagen) return null;

    const variante = varianteDeMayorArea(attributeOf(imagen, 'data-a-dynamic-image'));
    return variante ?? attributeOf(imagen, 'src');
}

/**
 * Mayor área declarada del JSON `data-a-dynamic-image`. Devuelve `null` si no hay ninguna
 * variante con dimensiones válidas, para que quien llama caiga al `src`.
 */
function varianteDeMayorArea(atributo: string | null): string | null {
    if (!atributo) return null;

    let variantes: unknown;
    try {
        variantes = JSON.parse(atributo);
    } catch {
        return null;
    }
    if (typeof variantes !== 'object' || variantes === null || Array.isArray(variantes)) return null;

    let mejorUrl: string | null = null;
    let mejorArea = 0;

    for (const [url, dimensiones] of Object.entries(variantes as Record<string, unknown>)) {
        if (!Array.isArray(dimensiones) || dimensiones.length < 2) continue;
        const [ancho, alto] = dimensiones;
        if (typeof ancho !== 'number' || typeof alto !== 'number') continue;
        if (!Number.isFinite(ancho) || !Number.isFinite(alto)) continue;

        const area = ancho * alto;
        if (area <= 0 || area <= mejorArea) continue;
        mejorUrl = url;
        mejorArea = area;
    }

    return mejorUrl;
}
