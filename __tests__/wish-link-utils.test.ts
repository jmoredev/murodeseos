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

        it('recorta el dominio largo por el medio, para que sobrevivan el nombre y el destino', () => {
            // Las dos puntas dicen cosas distintas y las dos hacen falta: el principio, **de quién**
            // es la tienda; el final, **a dónde va** (el dominio registrable con su TLD). Recortar
            // un extremo pierde una de las dos: recortando el final, `tienda-legitima.es` y
            // `tienda-legitima.evil` se veían igual; recortando el principio, se perdía el nombre.
            const largo = wishLinkHost('https://tienda-online-muy-larga.example.es/producto');
            expect(largo).toBe('tienda-online…example.es');
            expect(largo.length).toBeLessThanOrEqual(24);
        });

        it('con un sufijo público de varias partes conserva el dominio registrable', () => {
            // El refutador encontró esto como CRITICAL: la regla de «las dos últimas etiquetas»
            // conservaba solo `co.uk` y perdía `example.co.uk`, que es el destino. Un sufijo
            // público de dos partes no es el sitio, y la etiqueta tiene que poder leerlo.
            const largo = wishLinkHost('https://tienda-online-muy-larga.example.co.uk/producto');
            expect(largo).toContain('example.co.uk');
            expect(largo).toBe('tienda-onl…example.co.uk');
            expect(largo.length).toBeLessThanOrEqual(24);
        });

        it('un dominio que cabe no se recorta, por largo que sea el enlace', () => {
            // El caso normal, y el que planteó el propietario: lo largo de un enlace de tienda es
            // su **ruta**, y la ruta no entra en la etiqueta del chip. Aquí solo se pinta el
            // dominio, que cabe entero.
            expect(wishLinkHost('https://www.amazon.es/dp/B0EXAMPLEXLONG/ref=sr_1_1?keywords=x')).toBe(
                'amazon.es'
            );
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
