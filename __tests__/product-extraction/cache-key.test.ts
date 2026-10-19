import { describe, expect, it } from 'vitest';
import { normalizeCacheKey } from '../../supabase/functions/_shared/product-extraction/cache/normalize-url.ts';

/**
 * La clave de caché es una **clave**, no una identidad: el mismo texto de URL se canoniza lo
 * justo para que dos peticiones equivalentes compartan fila, y nada más. No se adivinan
 * redirecciones ni canónicas — eso obligaría a pedir la página, que es justo lo que la caché
 * evita. Todo lo que no se decida acá queda decidido en `normalize-url.ts`; estos tests fijan el
 * contrato observable (la clave exacta o `null`).
 */

describe('normalizeCacheKey', () => {
    it('quita el fragmento', () => {
        expect(normalizeCacheKey('https://shop.example/producto#opiniones')).toBe(
            'https://shop.example/producto'
        );
    });

    it('baja a minúsculas el esquema y el host, y conserva el camino', () => {
        expect(normalizeCacheKey('HTTPS://Shop.Example/Producto')).toBe(
            'https://shop.example/Producto'
        );
    });

    it('descarta el puerto por defecto de cada esquema', () => {
        expect(normalizeCacheKey('https://shop.example:443/producto')).toBe(
            'https://shop.example/producto'
        );
        expect(normalizeCacheKey('http://shop.example:80/producto')).toBe(
            'http://shop.example/producto'
        );
    });

    it('conserva un puerto no por defecto', () => {
        expect(normalizeCacheKey('https://shop.example:8443/producto')).toBe(
            'https://shop.example:8443/producto'
        );
    });

    it('ordena los parámetros de la query', () => {
        expect(normalizeCacheKey('https://shop.example/producto?b=2&a=1')).toBe(
            'https://shop.example/producto?a=1&b=2'
        );
    });

    it('ordena por clave y **conserva el orden de los parámetros repetidos**', () => {
        // Ordenar los repetidos por valor los colapsaría: `?a=2&a=1` y `?a=1&a=2` son la misma URL
        // solo si el servidor ignora cuál es el último, y muchos no lo ignoran (`last-wins`). Dos
        // variantes distintas compartiendo fila de caché es servir el borrador de una para la otra.
        expect(normalizeCacheKey('https://shop.example/producto?b=2&a=2&a=1')).toBe(
            'https://shop.example/producto?a=2&a=1&b=2'
        );
        expect(normalizeCacheKey('https://shop.example/producto?a=1&a=2')).toBe(
            'https://shop.example/producto?a=1&a=2'
        );
    });

    it('conserva los parámetros vacíos en vez de descartarlos', () => {
        // Descartar `?a=` sería adivinar que el servidor lo ignora; si no lo ignora, dos URLs
        // distintas colisionarían en la misma fila de caché.
        expect(normalizeCacheKey('https://shop.example/producto?b=1&a=')).toBe(
            'https://shop.example/producto?a=&b=1'
        );
    });

    it('no inventa una canónica: el camino distingue mayúsculas y barra final', () => {
        expect(normalizeCacheKey('https://shop.example/Producto')).not.toBe(
            normalizeCacheKey('https://shop.example/producto')
        );
        expect(normalizeCacheKey('https://shop.example/producto')).not.toBe(
            normalizeCacheKey('https://shop.example/producto/')
        );
    });

    it('devuelve null para una URL que no se puede parsear', () => {
        expect(normalizeCacheKey('esto no es una url')).toBeNull();
        expect(normalizeCacheKey('')).toBeNull();
        expect(normalizeCacheKey(null)).toBeNull();
        expect(normalizeCacheKey(42)).toBeNull();
    });

    it('devuelve null para un esquema que la capa de red no pide', () => {
        expect(normalizeCacheKey('mailto:alguien@shop.example')).toBeNull();
        expect(normalizeCacheKey('ftp://shop.example/producto')).toBeNull();
    });
});
