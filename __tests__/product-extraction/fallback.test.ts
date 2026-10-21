import { describe, expect, it } from 'vitest';
import {
    FALLBACK_TIMEOUT_MS,
    FALLBACK_WINDOW_SECONDS,
    buildFirecrawlPayload,
    needsFallback,
    readFirecrawlResult,
} from '../../supabase/functions/_shared/product-extraction/fallback/decision.ts';
import { readExtractionConfig } from '../../supabase/functions/_shared/product-extraction/config/env.ts';

/**
 * El respaldo con Firecrawl (`odd/tasks/respaldo-firecrawl.md`).
 *
 * Dos reglas caras viven acá y por eso se prueban sin red: **cuándo** se gasta un crédito (D1(b)) y
 * **qué** se hace con lo que vuelve. El error que importa no es fallar, es gastar: 1.000 créditos
 * al mes y 12 usuarios, así que un predicado generoso se come el presupuesto en días.
 */

const CON_PRECIO = { price: { amount: 79.99 }, imageUrl: null };
const CON_IMAGEN = { price: null, imageUrl: { value: 'https://shop.example/foto.jpg' } };
const VACIO = { price: null, imageUrl: null };

describe('needsFallback · cuándo salta', () => {
    it('salta cuando el transporte falló, con o sin borrador', () => {
        expect(needsFallback({ transportOk: false })).toBe('transport-failed');
        expect(needsFallback({ transportOk: false, draft: CON_PRECIO })).toBe('transport-failed');
    });

    it('salta cuando la página llegó pero no dio ni precio ni imagen', () => {
        // Cáscara SPA (Zara): 200 con 2 KB y nada que leer. Es el caso que D1(b) agrega.
        expect(needsFallback({ transportOk: true, draft: VACIO })).toBe('empty-draft');
        expect(needsFallback({ transportOk: true, draft: null })).toBe('empty-draft');
    });

    it('no salta si hay precio, aunque falte la imagen', () => {
        expect(needsFallback({ transportOk: true, draft: CON_PRECIO })).toBeNull();
    });

    it('no salta si hay imagen, aunque falte el precio', () => {
        expect(needsFallback({ transportOk: true, draft: CON_IMAGEN })).toBeNull();
    });

    it('no gasta un crédito por un campo suelto ausente', () => {
        // Descripción o tienda ausentes no justifican el respaldo: por eso la regla pide las dos
        // señales caras (precio e imagen) a la vez.
        const conPrecioSinNada = { price: { amount: 1 }, imageUrl: null };
        expect(needsFallback({ transportOk: true, draft: conPrecioSinNada })).toBeNull();
    });
});

describe('buildFirecrawlPayload', () => {
    it('pide el DOM renderizado, sin recortar el documento y sin caché del proveedor', () => {
        const payload = buildFirecrawlPayload('https://www.pccomponentes.com/x');

        expect(payload).toEqual({
            url: 'https://www.pccomponentes.com/x',
            formats: ['rawHtml'],
            // `onlyMainContent: true` recortaría el `<head>`, y el JSON-LD del producto vive ahí:
            // con el recorte, la capa que mejor lee precios se queda sin nada.
            onlyMainContent: false,
            // El precio no puede venir de una caché de días.
            maxAge: 0,
            timeout: FALLBACK_TIMEOUT_MS,
        });
    });

    it('acepta un tope propio', () => {
        expect(buildFirecrawlPayload('https://shop.example/x', 1500).timeout).toBe(1500);
    });
});

describe('readFirecrawlResult · qué se hace con la respuesta', () => {
    it('devuelve el HTML cuando la respuesta es buena, venga en rawHtml o en html', () => {
        expect(readFirecrawlResult(200, { success: true, data: { rawHtml: '<html>ok</html>' } })).toEqual({
            ok: true,
            html: '<html>ok</html>',
        });
        expect(readFirecrawlResult(200, { success: true, data: { html: '<html>ok</html>' } })).toEqual({
            ok: true,
            html: '<html>ok</html>',
        });
    });

    it('nombra cada negativa del proveedor por separado', () => {
        expect(readFirecrawlResult(401, {})).toEqual({ ok: false, reason: 'fallback-unauthorized' });
        expect(readFirecrawlResult(403, {})).toEqual({ ok: false, reason: 'fallback-unauthorized' });
        expect(readFirecrawlResult(402, {})).toEqual({ ok: false, reason: 'fallback-credits-exhausted' });
        expect(readFirecrawlResult(429, {})).toEqual({ ok: false, reason: 'fallback-rate-limited' });
        expect(readFirecrawlResult(500, {})).toEqual({ ok: false, reason: 'fallback-unavailable' });
        expect(readFirecrawlResult(503, {})).toEqual({ ok: false, reason: 'fallback-unavailable' });
    });

    it('trata como vacío un 200 sin HTML utilizable', () => {
        expect(readFirecrawlResult(200, { success: true, data: {} })).toEqual({
            ok: false,
            reason: 'fallback-empty',
        });
        expect(readFirecrawlResult(200, { success: true, data: { rawHtml: '   ' } })).toEqual({
            ok: false,
            reason: 'fallback-empty',
        });
        expect(readFirecrawlResult(200, { success: false, data: null })).toEqual({
            ok: false,
            reason: 'fallback-empty',
        });
    });

    it('nunca tira con un cuerpo que no es un objeto', () => {
        for (const cuerpo of [null, undefined, 'texto', 42, [], true]) {
            expect(() => readFirecrawlResult(200, cuerpo), String(cuerpo)).not.toThrow();
            expect(readFirecrawlResult(200, cuerpo)).toEqual({ ok: false, reason: 'fallback-empty' });
        }
    });
});

describe('presupuesto del respaldo', () => {
    it('la ventana es de 30 días, no de una hora', () => {
        expect(FALLBACK_WINDOW_SECONDS).toBe(2_592_000);
    });

    it('PRODUCT_FALLBACK_LIMIT vale 20 por defecto y un 0 explícito lo apaga', () => {
        expect(readExtractionConfig(() => undefined).fallbackLimite).toBe(20);
        expect(readExtractionConfig(() => '0').fallbackLimite).toBe(0);
        expect(readExtractionConfig(() => '5').fallbackLimite).toBe(5);
        // Un negativo no es un número con significado: se lee como apagado, nunca como el defecto.
        expect(readExtractionConfig(() => '-3').fallbackLimite).toBe(0);
        expect(readExtractionConfig(() => 'no-es-un-numero').fallbackLimite).toBe(20);
    });
});
