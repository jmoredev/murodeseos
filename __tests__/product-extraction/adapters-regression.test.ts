import { describe, expect, it } from 'vitest';
import { extractProduct } from '../../supabase/functions/_shared/product-extraction/extract/index';
import { attributeOf, parseHtml, selectOne } from '../../supabase/functions/_shared/product-extraction/extract/html';
import { fixtureUrl, loadFixtureHtml, loadManifest } from './fixture-loader';

/**
 * Regresiones de la verificación independiente de T3. No repiten lo que ya cubren
 * `adapters.test.ts` y `fixtures.test.ts`: acá se recalcula desde el fixture la decisión que el
 * adaptador toma (la variante de mayor área), se fijan las **fronteras** de la regla de host y se
 * fija que un dato declarado y roto degrada a `src` en vez de tirar.
 */

const entradaAmazon = () => {
    const entrada = loadManifest().fixtures.find((fixture) => fixture.id === 'amazon-es');
    if (!entrada) throw new Error('Falta el fixture amazon-es');
    return entrada;
};

describe('T3: la imagen elegida es la variante de mayor área declarada', () => {
    it('recalcula las áreas del fixture y coincide con lo que devuelve el adaptador', () => {
        const html = loadFixtureHtml('amazon-es');
        const imagen = selectOne(parseHtml(html), '#landingImage');
        const dinamico = attributeOf(imagen, 'data-a-dynamic-image');
        expect(dinamico).not.toBeNull();

        const variantes = JSON.parse(dinamico as string) as Record<string, [number, number]>;
        const area = ([ancho, alto]: [number, number]) => ancho * alto;
        const ganadora = Object.entries(variantes).sort((a, b) => area(b[1]) - area(a[1]))[0][0];

        for (const medidas of Object.values(variantes)) {
            expect(area(variantes[ganadora])).toBeGreaterThanOrEqual(area(medidas));
        }

        expect(extractProduct({ html, url: fixtureUrl(entradaAmazon()) }).imageUrl).toEqual({
            value: ganadora,
            source: 'domain-adapter',
        });
    });

    it('cae al `src` cuando el mapa de variantes está roto o no trae números', () => {
        for (const dinamico of ['{not json', '{"https://a.example/x.jpg":["879","549"]}']) {
            const html = `<span id="productTitle">T</span><img id="landingImage" src="https://a.example/s.jpg" data-a-dynamic-image='${dinamico}'/><div id="corePrice_feature_div"><span class="a-offscreen">1,00 €</span></div>`;

            expect(extractProduct({ html, url: 'https://www.amazon.es/dp/1' }).imageUrl).toEqual({
                value: 'https://a.example/s.jpg',
                source: 'domain-adapter',
            });
        }
    });

    it('no tira y deja el campo en null cuando falta el anclaje o la URL no se puede resolver', () => {
        const sinUrl = extractProduct({ html: '<span id="productTitle">T</span>', url: 'not a url' });
        expect(sinUrl.title).toBeNull();
        expect(sinUrl.url).toBe('not a url');

        const sinImagen = extractProduct({
            html: '<span id="productTitle">T</span><img id="landingImage"/>',
            url: 'https://amazon.es/dp/1',
        });
        expect(sinImagen.imageUrl).toBeNull();
    });

    it('aplica el adaptador solo en los hosts que reclama, y no en los parecidos', () => {
        const html =
            '<span id="productTitle">T</span><div id="corePrice_feature_div"><span class="a-offscreen">2,00 €</span></div>';

        for (const host of ['amazon.es', 'www.amazon.es', 'amazon.com.mx', 'amazon.co.uk']) {
            expect(extractProduct({ html, url: `https://${host}/dp/1` }).title?.source).toBe('domain-adapter');
        }

        // `amazon.es.evil.com` es el caso que importa: la regla no puede quedarse con cualquier
        // host que **empiece** por `amazon.` y termine en cualquier cosa.
        for (const host of ['amazon', 'notamazon.es', 'myamazon.es', 'amazon.es.evil.com', 'mediamarkt.es']) {
            expect(extractProduct({ html, url: `https://${host}/dp/1` }).title?.source).not.toBe('domain-adapter');
        }
    });
});
