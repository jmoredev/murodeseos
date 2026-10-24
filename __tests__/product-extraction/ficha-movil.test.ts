import { describe, expect, it } from 'vitest';
import {
    debeIntentarFichaMovil,
    leerAsin,
    urlDeFichaMovil,
} from '../../supabase/functions/_shared/product-extraction/mobile/decision.ts';
import { intentarFichaMovil } from '../../supabase/functions/_shared/product-extraction/mobile/attempt.ts';
import { mergeFallbackDraft } from '../../supabase/functions/_shared/product-extraction/fallback/decision.ts';
import type { SafeFetchResult } from '../../supabase/functions/_shared/product-extraction/net/safe-fetch.ts';
import { extractProduct } from '../../supabase/functions/_shared/product-extraction/extract/index.ts';
import { loadFixtureHtml } from './fixture-loader';

/**
 * El segundo intento directo contra la ficha **móvil** de Amazon.
 *
 * Medido el 2026-10-24: la ficha de escritorio de `www.amazon.com` contesta un interstitial
 * (`blocked-by-site`) y `https://www.amazon.<tld>/gp/aw/d/<ASIN>` devuelve la ficha de verdad.
 * En `amazon.es` la móvil trae los 89,99 € que el adaptador sabe leer (ancla
 * `#corePrice_feature_div .a-offscreen`), así que el intento extra tiene una razón medida.
 *
 * Lo que se fija acá es la **decisión** y su coste: como mucho una petición, solo a hosts que el
 * adaptador de Amazon reclama, solo con un ASIN legible en la ruta, y nunca cuando el camino
 * directo ya trajo un precio. Sin red: el HTML móvil es el fixture real de `amazon-es`.
 */

const FICHA_REAL = loadFixtureHtml('amazon-es');

/** Doble de `safeFetch` que anota a qué URL se pidió y devuelve lo que se le diga. */
function dobleDeRed(resultado: SafeFetchResult = { ok: false, reason: 'fetch-failed', finalUrl: null, status: null }) {
    const llamadas: string[] = [];
    const impl = async (url: string): Promise<SafeFetchResult> => {
        llamadas.push(url);
        return resultado;
    };
    return { llamadas, impl };
}

const EXITO_MOVIL: SafeFetchResult = {
    ok: true,
    status: 200,
    finalUrl: 'https://www.amazon.es/gp/aw/d/B09B8X9RGM',
    contentType: 'text/html;charset=UTF-8',
    body: FICHA_REAL,
    truncated: false,
};

describe('leerAsin', () => {
    it('lee el ASIN de las tres rutas de ficha que existen', () => {
        expect(leerAsin('https://www.amazon.es/dp/B09B8X9RGM')).toBe('B09B8X9RGM');
        expect(leerAsin('https://www.amazon.es/gp/product/B09B8X9RGM')).toBe('B09B8X9RGM');
        expect(leerAsin('https://www.amazon.es/gp/aw/d/B09B8X9RGM')).toBe('B09B8X9RGM');
    });

    it('tolera lo que la gente copia y pega: barra final, segmentos y query', () => {
        expect(leerAsin('https://www.amazon.es/dp/B09B8X9RGM/')).toBe('B09B8X9RGM');
        expect(leerAsin('https://www.amazon.es/dp/B09B8X9RGM/ref=sr_1_1?keywords=echo+dot')).toBe('B09B8X9RGM');
        expect(leerAsin('https://www.amazon.es/gp/aw/d/B09B8X9RGM?th=1&psc=1')).toBe('B09B8X9RGM');
    });

    it('normaliza el ASIN a mayúsculas, que es como lo escribe Amazon', () => {
        expect(leerAsin('https://www.amazon.es/dp/b09b8x9rgm')).toBe('B09B8X9RGM');
    });

    it('no inventa un ASIN donde no hay: ni listado, ni portada, ni un id de otra forma', () => {
        expect(leerAsin('https://www.amazon.es/s?k=echo+dot')).toBeNull();
        expect(leerAsin('https://www.amazon.es/')).toBeNull();
        expect(leerAsin('https://www.amazon.es/dp/B09B8X9RG')).toBeNull();
        expect(leerAsin('https://www.amazon.es/dp/B09B8X9RGMX')).toBeNull();
        expect(leerAsin('https://www.amazon.es/gp/aw/d/B09B8X9RG')).toBeNull();
    });

    it('solo acepta hosts que el adaptador de Amazon reclama', () => {
        // El adaptador no reclama `amazon.es.evil.com` (es de otro dueño), así que acá tampoco.
        expect(leerAsin('https://amazon.es.evil.com/dp/B09B8X9RGM')).toBeNull();
        expect(leerAsin('https://www.mediamarkt.es/dp/B09B8X9RGM')).toBeNull();
        expect(leerAsin('no es una url')).toBeNull();
        expect(leerAsin(null)).toBeNull();
        expect(leerAsin(404)).toBeNull();
    });
});

describe('urlDeFichaMovil', () => {
    it('arma la URL móvil en el mismo host, sin query ni barra final', () => {
        expect(urlDeFichaMovil('https://www.amazon.es/dp/B09B8X9RGM/ref=sr_1_1?keywords=echo+dot')).toBe(
            'https://www.amazon.es/gp/aw/d/B09B8X9RGM'
        );
        expect(urlDeFichaMovil('https://www.amazon.com/dp/B0D1XD1ZV3')).toBe(
            'https://www.amazon.com/gp/aw/d/B0D1XD1ZV3'
        );
        expect(urlDeFichaMovil('https://www.amazon.de/gp/product/B0HJ258W1G')).toBe(
            'https://www.amazon.de/gp/aw/d/B0HJ258W1G'
        );
    });

    it('no cambia el host que el usuario pidió', () => {
        expect(urlDeFichaMovil('https://amazon.es/dp/B09B8X9RGM')).toBe('https://amazon.es/gp/aw/d/B09B8X9RGM');
    });

    it('devuelve null cuando no hay ASIN, para no pedir una URL inventada', () => {
        expect(urlDeFichaMovil('https://www.amazon.es/s?k=echo+dot')).toBeNull();
        expect(urlDeFichaMovil('https://www.amazon.es/gp/aw/d/')).toBeNull();
        expect(urlDeFichaMovil('https://www.zara.com/es/')).toBeNull();
    });
});

describe('debeIntentarFichaMovil', () => {
    const BLOQUEADA = {
        url: 'https://www.amazon.es/dp/B09B8X9RGM',
        failureReason: 'blocked-by-site' as string | null,
        draft: null,
    };

    it('intenta la móvil cuando el escritorio fue un muro, aunque no haya borrador', () => {
        expect(debeIntentarFichaMovil(BLOQUEADA)).toBe(true);
    });

    it('intenta la móvil cuando la página llegó pero no dio ni precio ni imagen', () => {
        expect(
            debeIntentarFichaMovil({ url: BLOQUEADA.url, failureReason: null, draft: { price: null, imageUrl: null } })
        ).toBe(true);
    });

    it('no gasta la petición si el camino directo ya trajo precio', () => {
        expect(
            debeIntentarFichaMovil({
                url: BLOQUEADA.url,
                failureReason: null,
                draft: { price: { amount: 89.99 }, imageUrl: null },
            })
        ).toBe(false);
    });

    it('no gasta la petición con una sola señal: una imagen sin precio no es una página vacía', () => {
        // Es la misma regla que `needsFallback`: dos señales caras, no una.
        expect(
            debeIntentarFichaMovil({
                url: BLOQUEADA.url,
                failureReason: null,
                draft: { price: null, imageUrl: { value: 'https://m.media-amazon.com/x.jpg' } },
            })
        ).toBe(false);
    });

    it('no intenta la móvil por un fallo que no es un muro: un timeout o un 404 no se arreglan con otra URL', () => {
        for (const failureReason of ['timeout', 'fetch-failed', 'http-error', 'dns-failed', 'blocked-ip-private']) {
            expect(debeIntentarFichaMovil({ url: BLOQUEADA.url, failureReason, draft: null }), failureReason).toBe(false);
        }
    });

    it('no intenta la móvil en una tienda que no es Amazon', () => {
        expect(debeIntentarFichaMovil({ url: 'https://www.mediamarkt.es/es/product/_x.html', failureReason: 'blocked-by-site', draft: null })).toBe(false);
    });

    it('no intenta la móvil si la URL no lleva un ASIN legible', () => {
        expect(debeIntentarFichaMovil({ url: 'https://www.amazon.es/s?k=echo+dot', failureReason: 'blocked-by-site', draft: null })).toBe(false);
    });
});

describe('intentarFichaMovil', () => {
    it('hace **una** petición a la URL móvil y devuelve el borrador del mismo extractor', async () => {
        const red = dobleDeRed(EXITO_MOVIL);

        const intento = await intentarFichaMovil({
            url: 'https://www.amazon.es/dp/B09B8X9RGM',
            failureReason: 'blocked-by-site',
            draft: null,
            safeFetchImpl: red.impl,
        });

        expect(red.llamadas).toEqual(['https://www.amazon.es/gp/aw/d/B09B8X9RGM']);
        expect(intento?.draft.price?.amount).toBe(89.99);
        expect(intento?.draft.price?.currency).toBe('EUR');
        expect(intento?.draft.imageUrl).not.toBeNull();
        expect(intento?.finalUrl).toBe('https://www.amazon.es/gp/aw/d/B09B8X9RGM');
    });

    it('no pide nada cuando la decisión dice que no, y devuelve null', async () => {
        const red = dobleDeRed(EXITO_MOVIL);

        const intento = await intentarFichaMovil({
            url: 'https://www.amazon.es/dp/B09B8X9RGM',
            failureReason: null,
            draft: { price: { amount: 89.99 }, imageUrl: null },
            safeFetchImpl: red.impl,
        });

        expect(red.llamadas).toEqual([]);
        expect(intento).toBeNull();
    });

    it('devuelve null si la ficha móvil tampoco se puede leer, sin tirar', async () => {
        const red = dobleDeRed({ ok: false, reason: 'blocked-by-site', finalUrl: null, status: 200 });

        const intento = await intentarFichaMovil({
            url: 'https://www.amazon.es/dp/B09B8X9RGM',
            failureReason: 'blocked-by-site',
            draft: null,
            safeFetchImpl: red.impl,
        });

        expect(intento).toBeNull();
    });

    it('lo que devuelve es un borrador normal del extractor, no un lector paralelo', async () => {
        const red = dobleDeRed(EXITO_MOVIL);

        const intento = await intentarFichaMovil({
            url: 'https://www.amazon.es/dp/B09B8X9RGM',
            failureReason: 'blocked-by-site',
            draft: null,
            safeFetchImpl: red.impl,
        });

        // Se compara con `extractProduct` sobre el mismo HTML: el adaptador de Amazon es el que
        // lee el precio (ancla `#corePrice_feature_div .a-offscreen`) en los dos caminos.
        expect(intento?.draft).toEqual(
            extractProduct({ html: FICHA_REAL, url: 'https://www.amazon.es/gp/aw/d/B09B8X9RGM' })
        );
        // El texto tal cual lo sirve la ficha: el adaptador no lo reescribe, lo interpreta la cascada.
        expect(intento?.draft.price?.raw).toBe('89,99€');
    });

    it('fusionado con el directo, el móvil gana donde trae algo y el directo cubre los huecos', async () => {
        const red = dobleDeRed(EXITO_MOVIL);
        const directo = {
            url: 'https://www.amazon.es/dp/B09B8X9RGM',
            title: null,
            price: null,
            imageUrl: null,
            siteName: { value: 'Amazon.es', source: 'open-graph' as const },
            description: null,
            notes: ['No se encontró el precio en la página.'],
        };

        const intento = await intentarFichaMovil({
            url: directo.url,
            failureReason: null,
            draft: directo,
            safeFetchImpl: red.impl,
        });
        // El orden importa y es el que usa el endpoint: el borrador móvil va como respaldo, así que
        // aporta precio, título e imagen, y la descripción del directo se conserva.
        const fusionado = mergeFallbackDraft(directo, intento!.draft);

        expect(fusionado.price?.amount).toBe(89.99);
        expect(fusionado.title).not.toBeNull();
        expect(fusionado.imageUrl).not.toBeNull();
        // La nota que decía «no se encontró el precio» deja de ser cierta y no se guarda.
        expect(fusionado.notes).toEqual([]);
    });
});
