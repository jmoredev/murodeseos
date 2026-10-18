import { describe, expect, it } from 'vitest';
import { extractProduct } from '../../supabase/functions/_shared/product-extraction/extract/index';
import { fixtureUrl, loadFixtureHtml, loadManifest, type FixtureManifestEntry } from './fixture-loader';

/**
 * Adaptadores por dominio (T3). Un adaptador es una capa más de la cascada, la de **mayor
 * precedencia**: donde habla gana, porque está calibrado contra esa tienda. Cuando una ancla
 * desaparece (Amazon cambia su HTML), el adaptador devuelve `null` en ese campo y la cascada
 * genérica sigue exactamente como antes.
 *
 * Todo se prueba a través de la API pública, `extractProduct`, sin red y con los valores reales
 * inspeccionados en el propio fixture.
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

describe('adaptador de Amazon: valores reales del fixture', () => {
    it('lee el título, el precio y la imagen que la cascada genérica no puede leer', () => {
        // Amazon no publica JSON-LD, Open Graph ni microdata (L6): sin adaptador, esta página no
        // da ni precio ni imagen. Los valores de abajo están copiados del fixture, no inventados.
        expect(draftDe('amazon-es')).toEqual({
            url: fixtureUrl(entrada('amazon-es')),
            // `#productTitle`, sin el sufijo « : Amazon.es» que sí arrastra el `<title>`.
            title: {
                value: 'Echo Dot (Última generación) | Altavoz inteligente wifi y Bluetooth, con sonido más potente y de mayor amplitud | Antracita, con Acceso Anticipado a Alexa+',
                source: 'domain-adapter',
            },
            // El texto accesible del bloque de precio; lo lee `parsePriceText`/`detectCurrency`.
            price: { amount: 89.99, currency: 'EUR', ambiguous: false, raw: '89,99€', source: 'domain-adapter' },
            // La variante de mayor área declarada en `data-a-dynamic-image`: 879×549 = 482.571,
            // por encima de 741×463, 679×424… y de la 300×300 del `src`.
            imageUrl: {
                value: 'https://m.media-amazon.com/images/I/71G9l50-fGL._AC_SY879_.jpg',
                source: 'domain-adapter',
            },
            // El adaptador no toca estas dos: siguen viniendo de la cascada genérica.
            siteName: null,
            description: {
                value: 'Echo Dot (Última generación) | Altavoz inteligente wifi y Bluetooth, con sonido más potente y de mayor amplitud | Antracita, con Acceso Anticipado a Alexa+ : Amazon.es',
                source: 'open-graph',
            },
            // Con precio e imagen resueltos, no queda ninguna nota de faltante.
            notes: [],
        });
    });
});

describe('adaptador de Amazon: reglas propias', () => {
    it('elige la variante de mayor área declarada, no la más ancha ni la última', () => {
        const html = `
            <span id="productTitle">Producto sintético</span>
            <img id="landingImage" src="https://amazon.example/src.jpg"
                 data-a-dynamic-image='{"https://amazon.example/ancha.jpg":[500,300],"https://amazon.example/mejor.jpg":[400,450],"https://amazon.example/alta.jpg":[100,1000]}' />
            <div id="corePrice_feature_div"><span class="a-offscreen">12,34 €</span></div>`;

        const draft = extractProduct({ html, url: 'https://www.amazon.de/dp/X' });

        // Áreas: ancha 150.000, mejor 180.000, alta 100.000. Gana `mejor` aunque no sea la más
        // ancha (500), ni la más alta (1000), ni la última del JSON.
        expect(draft.imageUrl).toEqual({ value: 'https://amazon.example/mejor.jpg', source: 'domain-adapter' });
        expect(draft.title).toEqual({ value: 'Producto sintético', source: 'domain-adapter' });
        expect(draft.price).toEqual({
            amount: 12.34,
            currency: 'EUR',
            ambiguous: false,
            raw: '12,34 €',
            source: 'domain-adapter',
        });
        expect(draft.notes).toEqual([]);
    });

    it('sin anclas devuelve nulls y la cascada sigue: título heurístico y ningún precio inventado', () => {
        const html =
            '<html><head><title>Página de Amazon sin anclas</title></head><body><h1>Cabecera</h1></body></html>';

        expect(extractProduct({ html, url: 'https://www.amazon.es/dp/Z' })).toEqual({
            url: 'https://www.amazon.es/dp/Z',
            title: { value: 'Página de Amazon sin anclas', source: 'heuristic' },
            price: null,
            imageUrl: null,
            siteName: null,
            description: null,
            notes: ['No se encontró el precio en la página.', 'No se encontró la imagen en la página.'],
        });
    });

    it('con HTML basura en un host Amazon no tira y devuelve un borrador vacío', () => {
        const draft = extractProduct({ html: '<<<&&&%%% "no" es > html', url: 'https://www.amazon.es/dp/X' });

        expect(draft.title).toBeNull();
        expect(draft.price).toBeNull();
        expect(draft.imageUrl).toBeNull();
        expect(draft.url).toBe('https://www.amazon.es/dp/X');
    });
});

describe('registro de adaptadores: cobertura por host', () => {
    it('un solo adaptador cubre los locales de Amazon con el mismo marcado', () => {
        const html =
            '<span id="productTitle">Auriculares</span>' +
            '<div id="corePrice_feature_div"><span class="a-offscreen">19,99 €</span></div>';

        for (const host of ['amazon.es', 'www.amazon.com', 'amazon.de', 'www.amazon.com.mx', 'amazon.co.uk']) {
            const draft = extractProduct({ html, url: `https://${host}/dp/B0X` });
            expect(draft.title, host).toEqual({ value: 'Auriculares', source: 'domain-adapter' });
            expect(draft.price?.source, host).toBe('domain-adapter');
        }
    });

    it('un host que ningún adaptador reclama no aplica el adaptador aunque tenga sus anclas', () => {
        const html = `
            <html><head><title>Audio | Otra tienda</title></head><body>
                <span id="productTitle">Producto de otra tienda</span>
                <img id="landingImage" src="https://otra.example/src.jpg"
                     data-a-dynamic-image='{"https://otra.example/grande.jpg":[900,600],"https://otra.example/chica.jpg":[100,100]}' />
                <div id="corePrice_feature_div"><span class="a-offscreen">79,99 €</span></div>
            </body></html>`;

        // Mismo marcado que reclama Amazon, pero bajo MediaMarkt: el adaptador no se aplica y la
        // cascada genérica hace lo suyo (título y precio heurísticos; ninguna capa lee la imagen).
        expect(extractProduct({ html, url: 'https://www.mediamarkt.es/es/product/audio-1542796.html' })).toEqual({
            url: 'https://www.mediamarkt.es/es/product/audio-1542796.html',
            title: { value: 'Audio | Otra tienda', source: 'heuristic' },
            // El `raw` de un precio heurístico es el **token** del precio, no el nodo de texto
            // entero: el nodo podía traer otros números por delante y de ahí salían precios
            // inventados (`Pack 2 unidades · 39,99 €` daba 239,99).
            price: { amount: 79.99, currency: 'EUR', ambiguous: false, raw: '79,99', source: 'heuristic' },
            imageUrl: null,
            siteName: null,
            description: null,
            notes: ['No se encontró la imagen en la página.'],
        });
    });
});
