import { describe, expect, it } from 'vitest';
import { extractableLink } from '@/lib/link-extraction';

/**
 * La regla de "esto es un enlace de producto que vale la pena leer" vive aquí y no en el
 * componente: cada llamada gasta cuota del usuario y sale a la red, así que lo que se acepta
 * tiene que estar decidido —y probado— en un solo sitio.
 */
describe('reconocer un enlace de producto', () => {
    it('acepta un enlace completo http(s)', () => {
        expect(extractableLink('https://www.amazon.es/dp/B09B8X9RGM')).toBe(
            'https://www.amazon.es/dp/B09B8X9RGM',
        );
        expect(extractableLink('http://tienda.example/p/1')).toBe('http://tienda.example/p/1');
    });

    it('acepta lo que se pega sin esquema y le pone https, como hace el guardado', () => {
        expect(extractableLink('www.amazon.es/dp/B09B8X9RGM')).toBe(
            'https://www.amazon.es/dp/B09B8X9RGM',
        );
        expect(extractableLink('tienda.example/p/1')).toBe('https://tienda.example/p/1');
    });

    it('recorta los espacios de un pegado con dedos torpes', () => {
        expect(extractableLink('   https://tienda.example/p/1   ')).toBe('https://tienda.example/p/1');
    });

    it('rechaza lo que no es una URL', () => {
        for (const value of ['', '   ', 'lámpara', 'https://', 'a b c', '//']) {
            expect(extractableLink(value)).toBeNull();
        }
    });

    it('rechaza otros esquemas en vez de convertirlos en un host con https delante', () => {
        // `mailto:a@b.c` con `https://` delante se parsea como usuario `mailto:a` y host `b.c`:
        // una URL válida que nadie quiso pegar y que gastaría cuota saliendo a la red.
        for (const value of ['mailto:a@b.c', 'ftp://x.com/a', 'javascript:alert(1)', 'data:text/html,x']) {
            expect(extractableLink(value)).toBeNull();
        }
    });

    it('rechaza un host de una sola etiqueta', () => {
        // No es un nombre de producto en internet: es un host interno o un error de tecleo, y
        // la guarda SSRF del servidor lo bloquearía igual. Mejor no gastar la llamada.
        expect(extractableLink('https://tienda')).toBeNull();
        expect(extractableLink('tienda:8080/x')).toBeNull();
    });

    it('deja pasar una IP: quién la bloquea es la guarda del servidor, no el cliente', () => {
        // Duplicar en el cliente la lista de rangos prohibidos sería una segunda verdad que se
        // separa de la del servidor. La IP llega al endpoint y él contesta `blocked-ip-loopback`.
        expect(extractableLink('http://127.0.0.1/producto')).toBe('http://127.0.0.1/producto');
    });
});
