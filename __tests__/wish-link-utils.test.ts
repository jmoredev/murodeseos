import { describe, it, expect } from 'vitest';
import { normalizeWishLink, normalizeWishLinks, truncateWishLink, wishLinkHost } from '@/lib/wish-link-utils';

describe('wish-link-utils', () => {
    it('adds https when missing', () => {
        expect(normalizeWishLink('tienda.com/item')).toBe('https://tienda.com/item');
    });

    it('keeps existing scheme', () => {
        expect(normalizeWishLink('https://example.com/a')).toBe('https://example.com/a');
    });

    it('deduplicates normalized links', () => {
        expect(normalizeWishLinks(['https://a.com', 'a.com', ''])).toEqual(['https://a.com']);
    });

    it('truncates long URLs for display', () => {
        const short = truncateWishLink('https://www.amazon.es/dp/very-long-product-path', 20);
        expect(short.length).toBeLessThanOrEqual(20);
        expect(short).toContain('…');
    });

    describe('wishLinkHost', () => {
        it('devuelve solo el dominio, sin esquema ni www', () => {
            // Es lo que se pinta en la tarjeta: 8-15 caracteres caben donde la ruta
            // completa (hasta 36) se recortaba.
            expect(wishLinkHost('https://www.amazon.es/dp/B0EXAMPLE')).toBe('amazon.es');
            expect(wishLinkHost('https://example.com/producto-e2e')).toBe('example.com');
        });

        it('recorta el dominio largo por delante, para que sobreviva el destino', () => {
            // El chip del enlace lleva `numberOfLines={1}`, así que si el recorte lo hiciera el
            // CSS no se podría probar. Se hace en el helper, y **por delante**: lo que hay que
            // poder leer es **a dónde va** el enlace (el dominio registrable y su TLD), que está
            // al final. Recortando el final, `tienda-legitima.es` y `tienda-legitima.evil` se
            // veían igual.
            const largo = wishLinkHost('https://tienda-online-muy-larga.example.es/producto');
            expect(largo.startsWith('…')).toBe(true);
            expect(largo.endsWith('.example.es')).toBe(true);
            expect(largo).not.toContain('tienda-online');
            expect(largo.length).toBeLessThanOrEqual(24);
        });

        it('un esquema en mayúsculas no se duplica', () => {
            // `url.startsWith('http')` es sensible a mayúsculas y convertía `HTTP://x` en
            // `https://HTTP://x`; `normalizeWishLink` usa una expresión insensible.
            expect(wishLinkHost('HTTP://www.example.com/x')).toBe('example.com');
        });

        it('funciona sin esquema, que es como se pega muchas veces', () => {
            expect(wishLinkHost('tienda.com/item')).toBe('tienda.com');
        });

        it('si no se puede leer, devuelve la entrada tal cual en vez de inventarse nada', () => {
            expect(wishLinkHost('no es una url')).toBe('no es una url');
            expect(wishLinkHost('')).toBe('');
        });
    });
});
