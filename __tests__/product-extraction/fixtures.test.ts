import { describe, expect, it } from 'vitest';
import { extractProduct } from '../../supabase/functions/_shared/product-extraction/extract/index';
import {
    fixtureUrl,
    loadFixtureBytes,
    loadFixtureHtml,
    loadManifest,
    sha256,
    type FixtureManifestEntry,
} from './fixture-loader';

/**
 * Los fixtures son páginas reales congeladas (T1). Acá se prueba la cascada **contra el HTML
 * real**, sin red: los valores que se afirman se inspeccionaron en el propio fixture, no se
 * inventaron. Cuando un fixture trae menos de lo esperado, se afirma lo que de verdad trae.
 */

const manifiesto = loadManifest();

function entrada(id: string): FixtureManifestEntry {
    const encontrada = manifiesto.fixtures.find((fixture) => fixture.id === id);
    if (!encontrada) throw new Error(`Fixture no encontrado en el manifiesto: ${id}`);
    return encontrada;
}

function draftDe(id: string) {
    return extractProduct({ html: loadFixtureHtml(id), url: fixtureUrl(entrada(id)) });
}

describe('integridad de los fixtures', () => {
    it('cada fixture commiteado descomprime al sha256 y al tamaño que declara el manifiesto', () => {
        const conHash = manifiesto.fixtures.filter((fixture) => fixture.sha256 !== null);
        // No-vacuidad: si el manifiesto se queda sin hashes, este test no probaría nada.
        expect(conHash.length).toBeGreaterThanOrEqual(9);

        for (const fixture of conHash) {
            const bytes = loadFixtureBytes(fixture.id);
            expect(sha256(bytes), `sha256 de ${fixture.id}`).toBe(fixture.sha256);
            expect(bytes.length, `bytes de ${fixture.id}`).toBe(fixture.bytes);
        }
    });
});

describe('fixtures con datos estructurados reales', () => {
    it('El Corte Inglés declara el producto en JSON-LD Product con precio numérico', () => {
        expect(draftDe('elcorteingles-es')).toEqual({
            url: fixtureUrl(entrada('elcorteingles-es')),
            title: { value: 'Apple iPhone Duo chip A20 Pro - Negro 256 GB', source: 'json-ld' },
            price: { amount: 2339, currency: 'EUR', ambiguous: false, raw: '2339', source: 'json-ld' },
            imageUrl: {
                value: 'https://dam.elcorteingles.es/producto/www-001094612301245-00.jpg',
                source: 'json-ld',
            },
            // El Corte no publica `og:site_name`: la única marca que declara es el `brand` del
            // JSON-LD, que es lo que se usa como nombre de tienda de último recurso.
            siteName: { value: 'Apple', source: 'json-ld' },
            description: {
                value: 'Compra online Apple iPhone Duo chip A20 Pro - Negro 256 GB en El Corte Inglés. Consulta sus características, ofertas disponibles y opciones de envío o recogida.',
                source: 'json-ld',
            },
            notes: [],
        });
    });

    it('IKEA declara el precio como string y la imagen como ImageObject con contentUrl', () => {
        expect(draftDe('ikea-es')).toEqual({
            url: fixtureUrl(entrada('ikea-es')),
            title: { value: 'MALMKÖPING Sofá de 3 plazas - Tibbleby beige claro', source: 'json-ld' },
            // Medido: `"price":"799"` es texto, no número.
            price: { amount: 799, currency: 'EUR', ambiguous: false, raw: '799', source: 'json-ld' },
            // Medido: la imagen no viene como `{url}` sino como `{contentUrl}` (ImageObject).
            imageUrl: {
                value: 'https://www.ikea.com/es/es/images/products/malmkoping-sofa-3-plazas-tibbleby-beige-claro__1546403_pe1019941_s5.jpg',
                source: 'json-ld',
            },
            siteName: { value: 'IKEA', source: 'open-graph' },
            description: {
                value: 'MALMKÖPING Sofá de 3 plazas - Tibbleby beige claro. Un sofá amplio y versátil que se adapta a muchas actividades diferentes y a toda la familia. La silueta sencilla con líneas limpias y el equilibrio entre la suavidad y el apoyo de los cojines hacen que sea elegante y acogedor al mismo tiempo.',
                source: 'json-ld',
            },
            notes: [],
        });
    });

    it('MediaMarkt mete el producto en un BuyAction.object con @type ProductGroup', () => {
        expect(draftDe('mediamarkt-es')).toEqual({
            url: fixtureUrl(entrada('mediamarkt-es')),
            title: {
                value: 'Altavoz inteligente - Amazon Echo Dot (5. Gen 2022), Controlador de Hogar, Antracita',
                source: 'json-ld',
            },
            price: { amount: 89.99, currency: 'EUR', ambiguous: false, raw: '89.99', source: 'json-ld' },
            imageUrl: {
                value: 'https://assets.mmsrg.com/isr/166325/c1/-/ASSET_MMS_98657830/fee_786_587_png',
                source: 'json-ld',
            },
            siteName: { value: 'MediaMarkt', source: 'open-graph' },
            description: {
                value: 'Altavoz inteligente | Amazon Echo Dot (5. Gen 2022), Controlador de Hogar, Antracita Altavoces inteligentes al mejor precio solo en MediaMarkt',
                source: 'json-ld',
            },
            notes: [],
        });
    });

    it('AliExpress trae JSON-LD, pero es un WebSite sin producto: lo legible es lo de Open Graph', () => {
        // Debilidad real del fixture que el enunciado daba por «con datos estructurados»: su
        // único bloque JSON-LD es un `WebSite`, así que el título, la imagen y la descripción
        // salen de las metaetiquetas y el precio no se puede leer.
        expect(draftDe('aliexpress-es')).toEqual({
            url: fixtureUrl(entrada('aliexpress-es')),
            title: {
                value: 'AliExpress - Compra online de Electrónica, Moda, Casa y jardín, Deportes y ocio, Motor y seguridad, y más. - AliExpress',
                source: 'open-graph',
            },
            price: null,
            imageUrl: {
                value: 'https://ae-pic-a1.aliexpress-media.com/kf/Sa0202ec8a96a4085962acfc27e9ffd04F/1080x1080.jpg',
                source: 'open-graph',
            },
            siteName: { value: 'AliExpress', source: 'open-graph' },
            description: {
                value: 'Dar rienda suelta a lo que te apasiona no debería costarte una fortuna. En AliExpress puedes escoger entre más de 111 millones de ofertas de calidad en moda, complementos, electrónica, juguetes, herramientas, mejora del hogar, electrodomésticos, casa y jardín,accesorios para móviles, informática, infantil y más artículos ¡y mucho más!',
                source: 'open-graph',
            },
            notes: ['La página muestra varios precios; no se puede saber cuál es el del producto.'],
        });
    });
});

describe('testigos negativos: no tiran y no inventan un precio', () => {
    const SIN_PRECIO_NI_IMAGEN = [
        'No se encontró el precio en la página.',
        'No se encontró la imagen en la página.',
    ];

    it('Amazon no declara datos estructurados, pero el adaptador de dominio sí lee su ficha', () => {
        // Amazon sirve la página sin JSON-LD, sin Open Graph y sin microdata. T3 agregó un
        // adaptador por dominio que lee las anclas propias de Amazon (`#productTitle`,
        // `#landingImage[data-a-dynamic-image]` y el `.a-offscreen` del bloque de precio); con él
        // esta página pasa de «sin precio ni imagen» a un borrador completo, y la descripción
        // sigue saliendo de la metaetiqueta genérica.
        expect(draftDe('amazon-es')).toEqual({
            url: fixtureUrl(entrada('amazon-es')),
            title: {
                value: 'Echo Dot (Última generación) | Altavoz inteligente wifi y Bluetooth, con sonido más potente y de mayor amplitud | Antracita, con Acceso Anticipado a Alexa+',
                source: 'domain-adapter',
            },
            price: {
                amount: 89.99,
                currency: 'EUR',
                ambiguous: false,
                raw: '89,99€',
                source: 'domain-adapter',
            },
            imageUrl: {
                value: 'https://m.media-amazon.com/images/I/71G9l50-fGL._AC_SY879_.jpg',
                source: 'domain-adapter',
            },
            siteName: null,
            description: {
                value: 'Echo Dot (Última generación) | Altavoz inteligente wifi y Bluetooth, con sonido más potente y de mayor amplitud | Antracita, con Acceso Anticipado a Alexa+ : Amazon.es',
                source: 'open-graph',
            },
            notes: [],
        });
    });

    it('Zara es una cáscara de SPA: no hay ni título', () => {
        expect(draftDe('zara-es')).toEqual({
            url: fixtureUrl(entrada('zara-es')),
            title: null,
            price: null,
            imageUrl: null,
            siteName: null,
            description: null,
            notes: SIN_PRECIO_NI_IMAGEN,
        });
    });

    it('Decathlon responde con el challenge de Cloudflare: el extractor solo ve su título', () => {
        // Estos tres casos (Decathlon, Fnac, PcComponentes) documentan qué hay **dentro** de una
        // página de bloqueo, no lo que la app hace con ella: `detectBlock` rechaza estos cuerpos en
        // la capa de red y nunca llegan al parser (ver `block-detect.test.ts`). El extractor se
        // queda sin criterio a propósito; el criterio es del transporte.
        expect(draftDe('decathlon-es')).toEqual({
            url: fixtureUrl(entrada('decathlon-es')),
            title: { value: 'Just a moment...', source: 'heuristic' },
            price: null,
            imageUrl: null,
            siteName: null,
            description: null,
            notes: SIN_PRECIO_NI_IMAGEN,
        });
    });

    it('Fnac responde con el muro de DataDome: el extractor solo ve su título', () => {
        expect(draftDe('fnac-es')).toEqual({
            url: fixtureUrl(entrada('fnac-es')),
            title: { value: 'fnac.es', source: 'heuristic' },
            price: null,
            imageUrl: null,
            siteName: null,
            description: null,
            notes: SIN_PRECIO_NI_IMAGEN,
        });
    });

    it('PcComponentes responde 403 con el challenge de Cloudflare: el extractor solo ve «Just a moment...»', () => {
        expect(draftDe('pccomponentes-es')).toEqual({
            url: fixtureUrl(entrada('pccomponentes-es')),
            title: { value: 'Just a moment...', source: 'heuristic' },
            price: null,
            imageUrl: null,
            siteName: null,
            description: null,
            notes: SIN_PRECIO_NI_IMAGEN,
        });
    });
});
