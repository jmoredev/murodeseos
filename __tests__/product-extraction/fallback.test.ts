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
    it('salta cuando el transporte topó con un muro', () => {
        for (const failureReason of ['blocked-by-site', 'http-error'] as const) {
            expect(needsFallback({ failureReason })).toBe('transport-failed');
        }
    });

    it('NO gasta un crédito cuando el fallo no es un muro', () => {
        // Un dominio que no resuelve o un timeout no los arregla ningún proveedor: mandarlos
        // costaba un crédito por nada. Lo levantó el refutador del linaje `review-aaff4fb6c121fca1`.
        const noGastables = [
            'dns-failed',
            'fetch-failed',
            'timeout',
            'too-many-redirects',
            'body-read-failed',
            'redirect-without-location',
        ] as const;

        for (const failureReason of noGastables) {
            expect(needsFallback({ failureReason }), failureReason).toBeNull();
        }
    });

    it('no gasta cuando la guarda SSRF rechazó la URL', () => {
        const rechazos = [
            'invalid-url',
            'blocked-ip-loopback',
            'blocked-ip-private',
            'scheme-not-allowed',
            'credentials-not-allowed',
        ] as const;

        for (const failureReason of rechazos) {
            expect(needsFallback({ failureReason }), failureReason).toBeNull();
        }
    });

    it('salta cuando la página llegó pero no dio ni precio ni imagen', () => {
        expect(needsFallback({ failureReason: null, draft: VACIO })).toBe('empty-draft');
        expect(needsFallback({ failureReason: null, draft: null })).toBe('empty-draft');
    });

    it('no salta si hay precio o imagen: no se gasta por un campo suelto ausente', () => {
        expect(needsFallback({ failureReason: null, draft: CON_PRECIO })).toBeNull();
        expect(needsFallback({ failureReason: null, draft: CON_IMAGEN })).toBeNull();
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
            finalUrl: null,
        });
        expect(readFirecrawlResult(200, { success: true, data: { html: '<html>ok</html>' } })).toEqual({
            ok: true,
            html: '<html>ok</html>',
            finalUrl: null,
        });
    });

    it('devuelve la URL que el proveedor realmente leyó, para resolver las relativas', () => {
        // Sin esto, una página que redirige resolvía `img/x.jpg` contra la URL vieja y la imagen
        // salía rota y cacheada. Lo levantó el refutador del linaje `review-bc53b8330438d198`.
        const conUrl = readFirecrawlResult(200, {
            success: true,
            data: {
                rawHtml: '<html>ok</html>',
                metadata: { url: 'https://shop.example/es/p/123', sourceURL: 'https://shop.example/p/123' },
            },
        });

        expect(conUrl).toEqual({ ok: true, html: '<html>ok</html>', finalUrl: 'https://shop.example/es/p/123' });
    });

    it('descarta una URL del proveedor que no sirve como base', () => {
        for (const metadata of [{}, { url: 'no-es-una-url' }, { url: 'ftp://shop.example/x' }, { url: 42 }]) {
            const resultado = readFirecrawlResult(200, {
                success: true,
                data: { rawHtml: '<html>ok</html>', metadata },
            });
            expect(resultado, JSON.stringify(metadata)).toEqual({
                ok: true,
                html: '<html>ok</html>',
                finalUrl: null,
            });
        }
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
