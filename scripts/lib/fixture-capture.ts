/**
 * Piezas **puras** de la captura de fixtures: headers de navegador, decodificación de
 * charset y descubrimiento de la URL de producto en una página de listado.
 *
 * Vive aparte del runner (`scripts/capture-product-fixtures.ts`) para poder probarse sin
 * red: el runner hace E/S y no tiene tests, esto sí. Las dos piezas que sí tienen lógica
 * real son `decodeHtml` (una tienda en latin-1 produce mojibake silencioso si se ignora el
 * `charset`, y con él se rompen los títulos) y `resolveDiscoveredUrl` (las URLs de producto
 * rotan, así que la lista de semillas apunta a una página de listado y de ahí se saca la
 * primera coincidencia).
 *
 * Los headers no son cosmética: medido el 2026-10-18, El Corte Inglés responde **403** a un
 * `curl` con `User-Agent` suelto y **200** con el juego completo de un navegador.
 */

export type FixtureSeed = {
    /** Identificador estable del fixture: es el nombre del archivo y la clave del manifiesto. */
    id: string;
    shop: string;
    /** URL a pedir. Con `discover`, es la página de listado de la que se saca el producto. */
    url: string;
    /** Cuando la URL del producto no es estable: se busca en `from` con `pattern`. */
    discover?: {
        from: string;
        pattern: string;
    };
};

export type FixtureRecord = {
    id: string;
    shop: string;
    /** URL pedida (la semilla). */
    url: string;
    /** URL final tras redirecciones y descubrimiento; `null` si no se pudo pedir. */
    finalUrl: string | null;
    capturedAt: string;
    /** Estado HTTP, o `null` si la petición no llegó a responder. */
    status: number | null;
    ok: boolean;
    bytes: number;
    sha256: string | null;
    charset: string | null;
    /** Motivo legible cuando `ok` es falso (bloqueo, descubrimiento sin coincidencia, red). */
    failure: string | null;
};

export type FixtureManifest = {
    /** Formato del fixture: página completa comprimida con gzip. */
    format: 'html.gz';
    capturedAt: string;
    fixtures: FixtureRecord[];
};

/** Nombre del archivo de un fixture, compartido por el runner y los tests. */
export function fixtureFileName(id: string): string {
    return `${id}.html.gz`;
}

export function buildBrowserHeaders(): Record<string, string> {
    return {
        'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
        'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'cache-control': 'max-age=0',
    };
}

/**
 * Charsets que se mapean a otro: `iso-8859-1`/`latin1` se tratan como `windows-1252`, que es
 * lo que los navegadores hacen en la práctica (la diferencia está en los bytes 0x80–0x9F, y
 * ninguna tienda actual escribe texto con esos códigos de control). Todo lo que no se
 * reconozca cae a UTF-8: una página mal decodificada se nota, un `throw` deja la captura a
 * medias.
 */
const CHARSET_ALIASES: Record<string, string> = {
    'utf-8': 'utf-8',
    utf8: 'utf-8',
    'iso-8859-1': 'windows-1252',
    'iso8859-1': 'windows-1252',
    latin1: 'windows-1252',
    'latin-1': 'windows-1252',
    'windows-1252': 'windows-1252',
    cp1252: 'windows-1252',
};

export function charsetFromContentType(contentType: string | null): string | null {
    if (!contentType) return null;
    const match = /charset\s*=\s*"?([\w-]+)/i.exec(contentType);
    return match ? match[1].toLowerCase() : null;
}

export function decodeHtml(bytes: Uint8Array, contentType: string | null): string {
    const declared = charsetFromContentType(contentType);
    const charset = declared ? (CHARSET_ALIASES[declared] ?? 'utf-8') : 'utf-8';
    return new TextDecoder(charset).decode(bytes);
}

/**
 * Primera coincidencia de `pattern` en `html`, resuelta contra `baseUrl`.
 *
 * Devuelve el **primer grupo de captura** si el patrón lo tiene, y la coincidencia entera si
 * no. Solo se aceptan `http(s)`: un listado con `href="javascript:…"` o con un protocolo raro
 * no puede convertirse en la URL de un fixture.
 */
export function resolveDiscoveredUrl(html: string, baseUrl: string, pattern: string): string | null {
    let regex: RegExp;
    try {
        regex = new RegExp(pattern, 'i');
    } catch {
        return null;
    }

    const match = regex.exec(html);
    if (!match) return null;

    try {
        const base = new URL(baseUrl);
        if (base.protocol !== 'http:' && base.protocol !== 'https:') return null;

        const resolved = new URL(match[1] ?? match[0], base);
        if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
        return resolved.href;
    } catch {
        return null;
    }
}

/**
 * Semillas del juego de fixtures.
 *
 * Criterio de la lista: tiendas españolas y latinoamericanas donde alguien compra de verdad,
 * más **casos duros conocidos** que se quieren congelados como testigo negativo (Amazon sin
 * datos estructurados, Zara con cáscara de SPA, Decathlon y Fnac detrás de Cloudflare). No es
 * una lista de «tiendas populares»: es la lista de plataformas cuyo HTML cambia de forma
 * entre sí (VTEX, Shopify, PrestaShop, magento, SPA propia), que es lo que pone a prueba la
 * cascada.
 */
export const FIXTURE_SEEDS: readonly FixtureSeed[] = [
    {
        id: 'mediamarkt-es',
        shop: 'MediaMarkt España',
        url: 'https://www.mediamarkt.es/es/product/_altavoz-inteligente-amazon-echo-dot-5-gen-2022-controlador-de-hogar-antracita-1542796.html',
    },
    {
        id: 'pccomponentes-es',
        shop: 'PcComponentes',
        url: 'https://www.pccomponentes.com/grand-theft-auto-vi-standard-ed-gta-vi-ciab-ps5',
    },
    {
        id: 'amazon-es',
        shop: 'Amazon España',
        url: 'https://www.amazon.es/s?k=echo+dot',
        discover: { from: 'https://www.amazon.es/s?k=echo+dot', pattern: '/dp/[A-Z0-9]{10}' },
    },
    {
        id: 'elcorteingles-es',
        shop: 'El Corte Inglés',
        url: 'https://www.elcorteingles.es/electronica/',
        discover: { from: 'https://www.elcorteingles.es/electronica/', pattern: '(?:href=")(/[a-z-]+/A[0-9]{7,}[^"]*)' },
    },
    {
        id: 'mercadolibre-ar',
        shop: 'Mercado Libre Argentina',
        url: 'https://www.mercadolibre.com.ar/ofertas',
        discover: {
            from: 'https://www.mercadolibre.com.ar/ofertas',
            pattern: '(https://[a-z.]*mercadolibre\\.com\\.ar/(?:[^"?#]*/p/|articulo\\.mercadolibre\\.com\\.ar/)MLA[0-9]+)',
        },
    },
    {
        id: 'ikea-es',
        shop: 'IKEA España',
        url: 'https://www.ikea.com/es/es/',
        discover: { from: 'https://www.ikea.com/es/es/', pattern: '(https://www\\.ikea\\.com/es/es/p/[a-z0-9-]+)' },
    },
    {
        id: 'tiendanimal-es',
        shop: 'TiendAnimal',
        url: 'https://www.tiendanimal.es/',
        discover: { from: 'https://www.tiendanimal.es/', pattern: '(?:href=")(/[a-z0-9-]{15,}\\.html)' },
    },
    {
        id: 'nutritienda-es',
        shop: 'Nutritienda',
        url: 'https://www.nutritienda.com/es/',
        discover: { from: 'https://www.nutritienda.com/es/', pattern: '(https://www\\.nutritienda\\.com/es/[a-z0-9-]+/[a-z0-9-]+)' },
    },
    { id: 'zara-es', shop: 'Zara (cáscara de SPA, testigo negativo)', url: 'https://www.zara.com/es/' },
    { id: 'decathlon-es', shop: 'Decathlon (Cloudflare, testigo negativo)', url: 'https://www.decathlon.es/es/' },
    { id: 'fnac-es', shop: 'Fnac (403, testigo negativo)', url: 'https://www.fnac.es/' },
    { id: 'aliexpress-es', shop: 'AliExpress (bloqueo, testigo negativo)', url: 'https://es.aliexpress.com/' },
];
