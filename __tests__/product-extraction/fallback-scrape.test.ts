import { describe, expect, it } from 'vitest';
import {
    FIRECRAWL_SCRAPE_URL,
    scrapeWithFirecrawl,
    type ScrapeFetch,
} from '../../supabase/functions/_shared/product-extraction/fallback/scrape.ts';

/**
 * La llamada al proveedor, con `fetch` de mentira: no sale ni un paquete ni se gasta un crédito.
 *
 * Lo que se fija acá es lo que cuesta dinero y lo que no puede tumbar la extracción: el cuerpo que
 * se pide (un solo crédito, DOM renderizado), el `Bearer`, y que **cualquier** desenlace raro sea un
 * motivo nombrado en vez de una excepción.
 */

function respuesta(status: number, cuerpo: unknown): { status: number; json(): Promise<unknown> } {
    return { status, json: async () => cuerpo };
}

describe('scrapeWithFirecrawl', () => {
    it('pide rawHtml por la v2 con el Bearer y devuelve el HTML', async () => {
        let capturado: { url: string; init: { method: string; headers: Record<string, string>; body: string } } | null =
            null;
        const fetchFalso: ScrapeFetch = async (url, init) => {
            capturado = { url, init };
            return respuesta(200, { success: true, data: { rawHtml: '<html>renderizado</html>' } });
        };

        const resultado = await scrapeWithFirecrawl({
            url: 'https://www.pccomponentes.com/x',
            apiKey: 'clave-de-prueba',
            fetchImpl: fetchFalso,
        });

        expect(resultado).toEqual({ ok: true, html: '<html>renderizado</html>' });
        // Mismo motivo que en las pruebas del presupuesto: la asignación vive en un callback.
        const pedido = capturado as unknown as {
            url: string;
            init: { method: string; headers: Record<string, string>; body: string };
        };
        expect(pedido.url).toBe(FIRECRAWL_SCRAPE_URL);
        expect(pedido.init.method).toBe('POST');
        expect(pedido.init.headers.authorization).toBe('Bearer clave-de-prueba');
        expect(JSON.parse(pedido.init.body)).toMatchObject({
            url: 'https://www.pccomponentes.com/x',
            formats: ['rawHtml'],
            onlyMainContent: false,
            maxAge: 0,
        });
    });

    it('no manda al proveedor una URL que la guarda rechaza, aunque el llamador se olvide', async () => {
        // El endpoint guarda primero, pero el módulo no delega su propia seguridad: una URL privada
        // nunca sale hacia un tercero. Lo levantó el refutador del linaje `review-aaff4fb6c121fca1`.
        let llamado = false;
        const fetchFalso: ScrapeFetch = async () => {
            llamado = true;
            return respuesta(200, { success: true, data: { rawHtml: '<html>x</html>' } });
        };

        for (const url of [
            'http://127.0.0.1/x',
            'http://169.254.169.254/latest/meta-data/',
            'file:///etc/passwd',
        ]) {
            const resultado = await scrapeWithFirecrawl({ url, apiKey: 'k', fetchImpl: fetchFalso });
            expect(resultado, url).toEqual({ ok: false, reason: 'fallback-unsafe-url' });
        }
        expect(llamado).toBe(false);
    });

    it('no llama al proveedor sin clave: es un fallo nombrado, no un viaje inútil', async () => {
        let llamado = false;
        const fetchFalso: ScrapeFetch = async () => {
            llamado = true;
            return respuesta(200, {});
        };

        const resultado = await scrapeWithFirecrawl({
            url: 'https://shop.example/x',
            apiKey: '',
            fetchImpl: fetchFalso,
        });

        expect(resultado).toEqual({ ok: false, reason: 'fallback-unauthorized' });
        expect(llamado).toBe(false);
    });

    it('traduce el status del proveedor sin interpretarlo de más', async () => {
        const conStatus = (status: number): ScrapeFetch => async () => respuesta(status, {});

        expect(await scrapeWithFirecrawl({
            url: 'https://shop.example/x',
            apiKey: 'k',
            fetchImpl: conStatus(402),
        })).toEqual({ ok: false, reason: 'fallback-credits-exhausted' });

        expect(await scrapeWithFirecrawl({
            url: 'https://shop.example/x',
            apiKey: 'k',
            fetchImpl: conStatus(429),
        })).toEqual({ ok: false, reason: 'fallback-rate-limited' });
    });

    it('una caída de red es fallback-unavailable, no una excepción', async () => {
        const revienta: ScrapeFetch = async () => {
            throw new Error('ECONNRESET');
        };

        await expect(
            scrapeWithFirecrawl({ url: 'https://shop.example/x', apiKey: 'k', fetchImpl: revienta })
        ).resolves.toEqual({ ok: false, reason: 'fallback-unavailable' });
    });

    it('un cuerpo que no es JSON no rompe la lectura', async () => {
        const cuerpoRoto: ScrapeFetch = async () => ({
            status: 200,
            json: async () => {
                throw new SyntaxError('no es json');
            },
        });

        await expect(
            scrapeWithFirecrawl({ url: 'https://shop.example/x', apiKey: 'k', fetchImpl: cuerpoRoto })
        ).resolves.toEqual({ ok: false, reason: 'fallback-empty' });
    });
});
