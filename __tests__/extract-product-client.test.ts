import { describe, expect, it, vi } from 'vitest';
import { requestProductDraft, type ExtractionResult } from '@/lib/extract-product-client';

/**
 * Respuesta **real** del runtime, medida el 2026-10-18 contra Amazon (T5a de
 * `odd/tasks/compartir-producto.md`): el contrato que el cliente tiene que entender.
 */
const RESPUESTA_OK = {
    ok: true,
    draft: {
        url: 'https://www.amazon.es/dp/B09B8X9RGM',
        title: { value: 'Producto de prueba', source: 'domain-adapter' },
        price: {
            amount: 89.99,
            currency: 'EUR',
            ambiguous: false,
            raw: '89,99 €',
            source: 'domain-adapter',
        },
        imageUrl: { value: 'https://m.media-amazon.com/images/I/71x.jpg', source: 'domain-adapter' },
        siteName: { value: 'Amazon.es', source: 'open-graph' },
        description: { value: 'Una descripción del producto', source: 'open-graph' },
        notes: [],
    },
};

const URL_PRODUCTO = 'https://www.amazon.es/dp/B09B8X9RGM';

describe('cliente de extracción', () => {
    it('traduce el borrador del servidor a los campos del formulario', async () => {
        const invoke = vi.fn(async () => RESPUESTA_OK);

        const result = await requestProductDraft(URL_PRODUCTO, invoke);

        expect(invoke).toHaveBeenCalledWith(URL_PRODUCTO);
        expect(result).toEqual<ExtractionResult>({
            status: 'ok',
            draft: {
                title: 'Producto de prueba',
                // El precio llega como número y se pinta con la convención del repo, que es la
                // misma que usa la tarjeta: una sola lectura de precio en toda la app.
                priceText: '89,99',
                imageUrl: 'https://m.media-amazon.com/images/I/71x.jpg',
                notes: 'Una descripción del producto',
            },
        });
    });

    it('un borrador al que le falta todo sigue siendo un borrador usable', async () => {
        // S5: las tiendas que bloquean se degradan a completar a mano, y el enlace nunca se pierde.
        const invoke = vi.fn(async () => ({
            ok: true,
            draft: {
                url: URL_PRODUCTO,
                title: null,
                price: null,
                imageUrl: null,
                siteName: null,
                description: null,
                notes: ['dns-failed'],
            },
        }));

        const result = await requestProductDraft(URL_PRODUCTO, invoke);

        expect(result).toEqual({
            status: 'ok',
            draft: { title: null, priceText: null, imageUrl: null, notes: null },
        });
    });

    it('el motivo de un fallo de transporte se conserva para poder contarlo', async () => {
        const invoke = vi.fn(async () => ({ ok: false, reason: 'blocked-ip-loopback' }));

        await expect(requestProductDraft(URL_PRODUCTO, invoke)).resolves.toEqual({
            status: 'unavailable',
            reason: 'blocked-ip-loopback',
        });
    });

    it('una cuota agotada llega con su motivo, no como un borrador vacío', async () => {
        const invoke = vi.fn(async () => ({ ok: false, reason: 'quota-exceeded', retryAfterSeconds: 900 }));

        await expect(requestProductDraft(URL_PRODUCTO, invoke)).resolves.toEqual({
            status: 'unavailable',
            reason: 'quota-exceeded',
        });
    });

    it('un error de red no tira: devuelve el fallo', async () => {
        const invoke = vi.fn(async () => {
            throw new Error('Failed to fetch');
        });

        await expect(requestProductDraft(URL_PRODUCTO, invoke)).resolves.toEqual({
            status: 'unavailable',
            reason: 'request-failed',
        });
    });

    it('una respuesta que no tiene la forma esperada se trata como fallo', async () => {
        for (const respuesta of [null, undefined, {}, { ok: true }, 'texto', { ok: 'sí' }]) {
            const invoke = vi.fn(async () => respuesta);
            const result = await requestProductDraft(URL_PRODUCTO, invoke);
            expect(result.status).toBe('unavailable');
        }
    });

    it('sin url no se llama a la red', async () => {
        const invoke = vi.fn(async () => RESPUESTA_OK);

        await expect(requestProductDraft('', invoke)).resolves.toEqual({
            status: 'unavailable',
            reason: 'no-url',
        });
        expect(invoke).not.toHaveBeenCalled();
    });
});
