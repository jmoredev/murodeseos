import { describe, expect, it } from 'vitest';
import { mergeFallbackDraft } from '../../supabase/functions/_shared/product-extraction/fallback/decision.ts';
import type { ProductDraft } from '../../supabase/functions/_shared/product-extraction/types.ts';

/**
 * S8 de `odd/tasks/respaldo-firecrawl.md`: **el respaldo nunca empeora el resultado**.
 *
 * El refutador de la revisión `review-9546ed1ed63e9f92` lo levantó como BLOCKER: el camino de
 * respaldo reemplazaba el borrador directo sin mirar qué traía, así que una página que el camino
 * propio leyó a medias —título, descripción y tienda, sin precio ni imagen— podía salir **peor** y
 * además quedaba cacheada. La fusión campo por campo es la regla que lo impide.
 */

const NOTA_PRECIO = 'No se encontró el precio en la página.';
const NOTA_IMAGEN = 'No se encontró la imagen en la página.';

function draft(overrides: Partial<ProductDraft> = {}): ProductDraft {
    return {
        url: 'https://shop.example/producto',
        title: null,
        price: null,
        imageUrl: null,
        siteName: null,
        description: null,
        notes: [],
        ...overrides,
    };
}

const CON_TITULO = draft({
    title: { value: 'Consola', source: 'json-ld' },
    siteName: { value: 'Tienda X', source: 'open-graph' },
    notes: [NOTA_PRECIO, NOTA_IMAGEN],
});

const CON_PRECIO = draft({
    title: { value: 'Consola PS5', source: 'json-ld' },
    price: { amount: 79.99, currency: 'EUR', ambiguous: false, raw: '79.99', source: 'json-ld' },
    imageUrl: { value: 'https://shop.example/foto.jpg', source: 'json-ld' },
});

describe('mergeFallbackDraft', () => {
    it('sin borrador directo, devuelve el del respaldo tal cual', () => {
        expect(mergeFallbackDraft(null, CON_PRECIO)).toEqual(CON_PRECIO);
    });

    it('toma del respaldo lo que trae y del directo lo que el respaldo no trae', () => {
        const fusionado = mergeFallbackDraft(CON_TITULO, CON_PRECIO);

        // El respaldo leyó la página renderizada: su título es el bueno.
        expect(fusionado.title?.value).toBe('Consola PS5');
        // La tienda la declaraba solo el camino propio, así que se conserva.
        expect(fusionado.siteName?.value).toBe('Tienda X');
        expect(fusionado.price?.amount).toBe(79.99);
        expect(fusionado.imageUrl?.value).toBe('https://shop.example/foto.jpg');
    });

    it('no deja pasar el título de una página de bloqueo si el respaldo trae el real', () => {
        // Es el caso medido en el e2e del 2026-10-21: sin esto, el deseo quedaba titulado
        // «Just a moment...» con el precio y la imagen correctos.
        const challenge = draft({
            title: { value: 'Just a moment...', source: 'heuristic' },
            notes: [NOTA_PRECIO, NOTA_IMAGEN],
        });

        const fusionado = mergeFallbackDraft(challenge, CON_PRECIO);

        expect(fusionado.title?.value).toBe('Consola PS5');
        expect(fusionado.title?.source).toBe('json-ld');
    });

    it('no deja notas que el respaldo ya resolvió', () => {
        const fusionado = mergeFallbackDraft(CON_TITULO, CON_PRECIO);

        expect(fusionado.notes).toEqual([]);
    });

    it('un respaldo peor no borra nada: es la regla que falló en la revisión', () => {
        const vacio = draft();
        const fusionado = mergeFallbackDraft(CON_TITULO, vacio);

        expect(fusionado.title?.value).toBe('Consola');
        expect(fusionado.siteName?.value).toBe('Tienda X');
        expect(fusionado.notes).toEqual([NOTA_PRECIO, NOTA_IMAGEN]);
    });

    it('conserva la nota que sigue siendo verdad', () => {
        const soloPrecio = draft({
            price: { amount: 79.99, currency: 'EUR', ambiguous: false, raw: '79.99', source: 'json-ld' },
        });
        const fusionado = mergeFallbackDraft(CON_TITULO, soloPrecio);

        expect(fusionado.notes).toEqual([NOTA_IMAGEN]);
    });
});
