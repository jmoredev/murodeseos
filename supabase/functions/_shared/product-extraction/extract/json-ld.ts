import { collapseWhitespace, decodeHtmlEntities } from './text.ts';

/**
 * Lectura de datos estructurados `schema.org/Product` en JSON-LD.
 *
 * Tres cosas que la medición del corpus obliga a aguantar y que no son evidentes leyendo la
 * especificación de schema.org:
 *
 * 1. **El `Product` no siempre está en la raíz.** Puede venir en un array, dentro de `@graph`
 *    o **colgado de otra entidad** (MediaMarkt lo mete en `BuyAction.object` con
 *    `@type: ProductGroup`). Por eso se recorre el árbol entero y se recogen los nodos de tipo
 *    `Product`/`ProductGroup`, en orden de aparición.
 * 2. **El precio puede venir como número o como string** (`"799"`, `"79.99"`). Acá no se
 *    interpreta: se devuelve crudo y lo normaliza `normalize/price.ts`, que es la única unidad
 *    que decide qué es un precio.
 * 3. **`offers` puede ser objeto, array o `AggregateOffer`.** En el `AggregateOffer` el precio
 *    está en `lowPrice`, no en `price`.
 *
 * Un bloque que no parsea **se salta**, nunca se tira: las tiendas meten comentarios y comas
 * colgando dentro del JSON-LD con una frecuencia notable.
 */

export type JsonLdProduct = {
    title: string | null;
    image: string | null;
    /** Número o texto, tal como lo declaró la página. */
    price: string | number | null;
    currency: string | null;
    brand: string | null;
    description: string | null;
};

type Json = string | number | boolean | null | Json[] | { [clave: string]: Json };

export function extractJsonLd(html: string): JsonLdProduct | null {
    const productos: Record<string, Json>[] = [];
    const patronScript = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let coincidencia: RegExpExecArray | null;

    while ((coincidencia = patronScript.exec(html)) !== null) {
        // El `type` puede estar en cualquier orden o con comillas simples, así que se comprueba
        // sobre los atributos y no con una regex que dependa de la posición.
        if (!/\bapplication\/ld\+json\b/i.test(coincidencia[1])) continue;

        const parseado = parsearJsonLd(coincidencia[2]);
        if (parseado === undefined) continue;

        recogerProductos(parseado, productos);
    }

    if (productos.length === 0) return null;
    return leerProducto(productos);
}

function parsearJsonLd(texto: string): Json | undefined {
    try {
        return JSON.parse(texto) as Json;
    } catch {
        // Un bloque roto no invalida el resto de la página: se salta y se sigue.
        return undefined;
    }
}

function esProducto(tipo: Json | undefined): boolean {
    const tipos = Array.isArray(tipo) ? tipo : [tipo];
    return tipos.some((valor) => typeof valor === 'string' && (valor === 'Product' || valor === 'ProductGroup'));
}

/** Recorre el árbol entero y guarda los nodos `Product`/`ProductGroup` en orden de aparición. */
function recogerProductos(nodo: Json, salida: Record<string, Json>[]): void {
    if (Array.isArray(nodo)) {
        for (const hijo of nodo) recogerProductos(hijo, salida);
        return;
    }
    if (nodo === null || typeof nodo !== 'object') return;

    const objeto = nodo as Record<string, Json>;
    if (esProducto(objeto['@type'])) salida.push(objeto);

    for (const valor of Object.values(objeto)) recogerProductos(valor, salida);
}

/** Mezcla los nodos encontrados campo por campo: el primero que declare algo, gana. */
function leerProducto(productos: Record<string, Json>[]): JsonLdProduct {
    const resultado: JsonLdProduct = {
        title: null,
        image: null,
        price: null,
        currency: null,
        brand: null,
        description: null
    };

    for (const producto of productos) {
        if (resultado.title === null) resultado.title = leerTexto(producto.name);
        if (resultado.image === null) resultado.image = leerImagen(producto.image);
        if (resultado.brand === null) resultado.brand = leerMarca(producto.brand);
        if (resultado.description === null) resultado.description = leerTexto(producto.description);

        if (resultado.price === null) {
            const oferta = leerOferta(producto.offers);
            resultado.price = oferta.price;
            if (resultado.currency === null) resultado.currency = oferta.currency;
        }
    }

    return resultado;
}

function leerTexto(valor: Json | undefined): string | null {
    if (typeof valor !== 'string') return null;
    const texto = collapseWhitespace(decodeHtmlEntities(valor));
    return texto === '' ? null : texto;
}

/**
 * Imagen: string, array de strings u objetos. Además de `url` se acepta `contentUrl`, que es lo
 * que declara IKEA (`ImageObject`), medido en el fixture `ikea-es`.
 */
function leerImagen(valor: Json | undefined): string | null {
    if (typeof valor === 'string') {
        const url = valor.trim();
        return url === '' ? null : url;
    }
    if (Array.isArray(valor)) {
        for (const elemento of valor) {
            const url = leerImagen(elemento);
            if (url !== null) return url;
        }
        return null;
    }
    if (valor !== null && typeof valor === 'object') {
        return leerImagen(valor.url) ?? leerImagen(valor.contentUrl);
    }
    return null;
}

function leerMarca(valor: Json | undefined): string | null {
    if (Array.isArray(valor)) {
        for (const elemento of valor) {
            const marca = leerMarca(elemento);
            if (marca !== null) return marca;
        }
        return null;
    }
    if (valor !== null && typeof valor === 'object') return leerTexto(valor.name);
    return leerTexto(valor);
}

function leerOferta(valor: Json | undefined): { price: string | number | null; currency: string | null } {
    if (Array.isArray(valor)) {
        let moneda: string | null = null;
        for (const elemento of valor) {
            const oferta = leerOferta(elemento);
            if (oferta.price !== null) return oferta;
            if (moneda === null) moneda = oferta.currency;
        }
        return { price: null, currency: moneda };
    }
    if (valor === null || typeof valor !== 'object') return { price: null, currency: null };

    const moneda = leerTexto(valor.priceCurrency) ?? leerTexto(valor.currency);
    // `AggregateOffer` no trae `price` sino `lowPrice` (el «desde»).
    const precio = valor.price !== undefined ? leerPrecio(valor.price) : leerPrecio(valor.lowPrice);
    return { price: precio, currency: moneda };
}

function leerPrecio(valor: Json | undefined): string | number | null {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
    if (typeof valor === 'string') {
        const texto = valor.trim();
        return texto === '' ? null : texto;
    }
    return null;
}
