import { describe, expect, it } from 'vitest';
import { extractProduct } from '../../supabase/functions/_shared/product-extraction/extract/index';

/**
 * Casos sintéticos: HTML pequeño escrito a mano para cubrir lo que los fixtures reales **no**
 * cubren (JSON-LD en `@graph`, `AggregateOffer.lowPrice`, bloques rotos, microdata, metaetiquetas
 * con `name=`, precios en rango…). Todo se prueba a través de la API pública, `extractProduct`.
 */

const URL_BASE = 'https://tienda.example/producto/1';

function draftDe(html: string, url = URL_BASE) {
    return extractProduct({ html, url });
}

describe('extractProduct: JSON-LD', () => {
    it('lee el Product dentro de un @graph y el lowPrice de un AggregateOffer', () => {
        const html = `
            <script type="application/ld+json">
            {"@context":"https://schema.org","@graph":[
                {"@type":"WebPage","name":"Página"},
                {"@type":"Product","name":"Zapatilla runner","image":"https://tienda.example/zapatilla.jpg",
                 "offers":{"@type":"AggregateOffer","lowPrice":"19.99","priceCurrency":"EUR"}}
            ]}
            </script>`;

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: { value: 'Zapatilla runner', source: 'json-ld' },
            price: { amount: 19.99, currency: 'EUR', ambiguous: false, raw: '19.99', source: 'json-ld' },
            imageUrl: { value: 'https://tienda.example/zapatilla.jpg', source: 'json-ld' },
            siteName: null,
            description: null,
            notes: [],
        });
    });

    it('lee el Product dentro de un array, con offers en array, price como texto e imagen relativa', () => {
        const html = `
            <script type="application/ld+json">
            [{"@type":"Product","name":"Teclado mecánico","image":{"url":"/img/teclado.jpg"},
              "offers":[{"@type":"Offer","price":"79.99","priceCurrency":"EUR"}]}]
            </script>`;

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: { value: 'Teclado mecánico', source: 'json-ld' },
            price: { amount: 79.99, currency: 'EUR', ambiguous: false, raw: '79.99', source: 'json-ld' },
            imageUrl: { value: 'https://tienda.example/img/teclado.jpg', source: 'json-ld' },
            siteName: null,
            description: null,
            notes: [],
        });
    });

    it('ignora un bloque JSON-LD roto y sigue con el válido', () => {
        const html = `
            <script type="application/ld+json">{ roto, esto no es json }</script>
            <script type="application/ld+json">{"@type":"Product","name":"Producto válido"}</script>`;

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: { value: 'Producto válido', source: 'json-ld' },
            price: null,
            imageUrl: null,
            siteName: null,
            description: null,
            notes: ['No se encontró el precio en la página.', 'No se encontró la imagen en la página.'],
        });
    });

    it('descarta una imagen con esquema que no sea http(s) y no deja imagen', () => {
        const html = `
            <script type="application/ld+json">{"@type":"Product","name":"Producto","image":"data:image/png;base64,AAAA"}</script>
            <img src="/img/real.jpg" width="600" height="400" alt="" />`;

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: { value: 'Producto', source: 'json-ld' },
            price: null,
            imageUrl: null,
            siteName: null,
            description: null,
            notes: ['No se encontró el precio en la página.', 'No se encontró la imagen en la página.'],
        });
    });
});

describe('extractProduct: microdata', () => {
    it('lee itemprop de name, price, priceCurrency e image cuando no hay nada declarado', () => {
        const html = `
            <div itemscope itemtype="https://schema.org/Product">
                <span itemprop="name">Cafetera italiana</span>
                <meta itemprop="price" content="49,90">
                <meta itemprop="priceCurrency" content="EUR">
                <img itemprop="image" src="/img/cafetera.jpg" alt="">
            </div>`;

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: { value: 'Cafetera italiana', source: 'microdata' },
            price: { amount: 49.9, currency: 'EUR', ambiguous: false, raw: '49,90', source: 'microdata' },
            imageUrl: { value: 'https://tienda.example/img/cafetera.jpg', source: 'microdata' },
            siteName: null,
            description: null,
            notes: [],
        });
    });
});

describe('extractProduct: Open Graph', () => {
    it('lee metaetiquetas con name=, en cualquier orden y con comillas simples, y resuelve una og:image relativa', () => {
        const html = `
            <meta name="og:title" content="Auriculares Bluetooth" />
            <meta name='og:image' content='/img/auriculares.jpg' />
            <meta content='129,95' name="product:price:amount" />
            <meta name="product:price:currency" content="EUR" />
            <meta content="SonidoTotal" property="og:site_name" />`;

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: { value: 'Auriculares Bluetooth', source: 'open-graph' },
            price: { amount: 129.95, currency: 'EUR', ambiguous: false, raw: '129,95', source: 'open-graph' },
            imageUrl: { value: 'https://tienda.example/img/auriculares.jpg', source: 'open-graph' },
            siteName: { value: 'SonidoTotal', source: 'open-graph' },
            description: null,
            notes: [],
        });
    });

    it('recorta un sufijo del título solo cuando el og:site_name coincide de verdad', () => {
        const html = `
            <meta property="og:site_name" content="Tienda X" />
            <meta property="og:title" content="Producto Z | Tienda X" />`;

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: { value: 'Producto Z', source: 'open-graph' },
            price: null,
            imageUrl: null,
            siteName: { value: 'Tienda X', source: 'open-graph' },
            description: null,
            notes: ['No se encontró el precio en la página.', 'No se encontró la imagen en la página.'],
        });
    });
});

describe('extractProduct: cascada campo por campo', () => {
    it('no deja que una sola capa gane todo el borrador', () => {
        const html = `
            <meta property="og:title" content="Título de Open Graph" />
            <meta property="og:image" content="/img/og.jpg" />
            <meta property="product:price:amount" content="10" />
            <meta property="product:price:currency" content="EUR" />
            <script type="application/ld+json">
            {"@type":"Product","description":"Descripción declarada","brand":{"name":"Marca"}}
            </script>`;

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: { value: 'Título de Open Graph', source: 'open-graph' },
            price: { amount: 10, currency: 'EUR', ambiguous: false, raw: '10', source: 'open-graph' },
            imageUrl: { value: 'https://tienda.example/img/og.jpg', source: 'open-graph' },
            siteName: { value: 'Marca', source: 'json-ld' },
            description: { value: 'Descripción declarada', source: 'json-ld' },
            notes: [],
        });
    });
});

describe('extractProduct: heurística de precio', () => {
    it('deja el precio en null con una nota cuando lo que hay es un rango', () => {
        const html = '<html><body><div class="precio">12,99 - 19,99 €</div></body></html>';

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: null,
            price: null,
            imageUrl: null,
            siteName: null,
            description: null,
            notes: [
                'El precio no se pudo interpretar: «12,99 - 19,99 €».',
                'No se encontró la imagen en la página.',
            ],
        });
    });

    it('lee un precio acompañado de un código ISO 4217', () => {
        const html = '<html><body><div class="precio">29.95 USD</div></body></html>';

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: null,
            price: { amount: 29.95, currency: 'USD', ambiguous: false, raw: '29.95 USD', source: 'heuristic' },
            imageUrl: null,
            siteName: null,
            description: null,
            notes: ['No se encontró la imagen en la página.'],
        });
    });

    it('descarta un número pelado sin ninguna marca de moneda', () => {
        const html = '<html><body><div class="precio">1234</div></body></html>';

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: null,
            price: null,
            imageUrl: null,
            siteName: null,
            description: null,
            notes: ['No se encontró el precio en la página.', 'No se encontró la imagen en la página.'],
        });
    });

    it('no elige a cara o cruz cuando la página muestra varios precios', () => {
        const html =
            '<html><body><span class="p1">10,00 €</span><span class="p2">20,00 €</span></body></html>';

        expect(draftDe(html)).toEqual({
            url: URL_BASE,
            title: null,
            price: null,
            imageUrl: null,
            siteName: null,
            description: null,
            notes: [
                'La página muestra varios precios; no se puede saber cuál es el del producto.',
                'No se encontró la imagen en la página.',
            ],
        });
    });
});

describe('extractProduct: heurística de título', () => {
    it('usa el <title> y, si no lo hay, el primer <h1>', () => {
        expect(draftDe('<html><head><title>Página de tienda</title></head><body><h1>Otro</h1></body></html>').title).toEqual({
            value: 'Página de tienda',
            source: 'heuristic',
        });
        expect(draftDe('<html><body><h1>  Silla   de oficina </h1></body></html>').title).toEqual({
            value: 'Silla de oficina',
            source: 'heuristic',
        });
    });
});

describe('extractProduct: no hay capa heurística de imagen (decisión medida)', () => {
    it('no devuelve nada cuando la página no declara la foto, por grande que sea la que haya', () => {
        // Las tres primeras son la **misma** página real (fixture `amazon-es`), medida: sin
        // declaración, la imagen más grande del HTML es cromo, y devolverla sería peor que no
        // devolver nada porque el usuario no notaría que la foto del deseo es la equivocada.
        const paginas = [
            {
                motivo: 'miniatura de reseña de 154×154 (Amazon)',
                html: '<img src="https://m.media-amazon.com/images/I/71JYq63IQgL._AC_UC154,154_CACC,154,154_QL85_.jpg" width="154" height="154" alt="" />',
            },
            {
                motivo: 'sprite de navegación (Amazon)',
                html: '<img src="https://m.media-amazon.com/images/G/30/gno/sprites/nav-sprite-global-1x-reorg-privacy._CB546381700_.png" width="512" height="512" alt="" />',
            },
            {
                motivo: 'URL armada con texto de un <script> (Amazon)',
                html: '<img src="\' + t.image + \'" width="1600" height="1600" alt="" />',
            },
            { motivo: 'la única imagen de una página simple', html: '<img src="/foto-producto.jpg" alt="" />' },
        ];

        for (const { motivo, html } of paginas) {
            const draft = draftDe(`<title>Producto</title>${html}`);
            expect(draft.imageUrl, motivo).toBeNull();
            expect(draft.notes, motivo).toContain('No se encontró la imagen en la página.');
        }
    });
});

describe('extractProduct: nunca tira y siempre devuelve la url', () => {
    it('devuelve un borrador vacío con HTML vacío', () => {
        expect(draftDe('')).toEqual({
            url: URL_BASE,
            title: null,
            price: null,
            imageUrl: null,
            siteName: null,
            description: null,
            notes: ['No se encontró el precio en la página.', 'No se encontró la imagen en la página.'],
        });
    });

    it('aguanta HTML basura y una url que no se puede resolver', () => {
        expect(() => extractProduct({ html: '<<<&&&%%% "no" es > html', url: 'no-es-una-url' })).not.toThrow();
        expect(extractProduct({ html: '<<<&&&%%% "no" es > html', url: 'no-es-una-url' }).url).toBe('no-es-una-url');
        // Con imagen relativa y base inválida, `new URL` falla: se descarta la imagen, no la llamada.
        expect(extractProduct({ html: '<img src="/x.jpg">', url: 'no-es-una-url' }).imageUrl).toBeNull();
    });
});
