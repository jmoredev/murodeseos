import { describe, expect, it } from 'vitest';
import { guardUrl, blockedIpReason } from '../../supabase/functions/_shared/product-extraction/net/url-guard.ts';
import { safeFetch, type FetchLike, type FetchResponseLike } from '../../supabase/functions/_shared/product-extraction/net/safe-fetch.ts';

/**
 * Regresiones del hueco que encontró el **verificador independiente** de T4: una guarda que solo
 * mira `::ffff:a.b.c.d` deja pasar las direcciones IPv6 de **transición**, que son el bypass
 * clásico de SSRF. `http://[64:ff9b::a9fe:a9fe]/latest/meta-data/` llega a 169.254.169.254 sin
 * parecerse a ninguna dirección prohibida.
 *
 * La regla que se prueba no es «bloquear estas formas» sino **clasificar la IPv4 embebida**: la
 * misma forma con una IPv4 pública tiene que seguir pasando, porque un bloqueo a lo bruto
 * escondería tiendas reales.
 */

describe('guarda SSRF: IPv4 embebida en direcciones IPv6 de transición', () => {
    it.each([
        ['NAT64 a la dirección de metadatos', 'http://[64:ff9b::a9fe:a9fe]/latest/meta-data/'],
        ['NAT64 al loopback', 'http://[64:ff9b::7f00:1]/'],
        ['NAT64 local-use (RFC 8215)', 'http://[64:ff9b:1::a9fe:a9fe]/'],
        ['IPv4 traducida (RFC 6145)', 'http://[::ffff:0:a9fe:a9fe]/'],
        ['6to4', 'http://[2002:a9fe:a9fe::]/'],
        ['Teredo con servidor sin especificar', 'http://[2001:0:0:0:0:0:a9fe:a9fe]/'],
        ['IPv4 compatible (obsoleta)', 'http://[::7f00:1]/'],
    ])('bloquea %s', (_caso, url) => {
        expect(guardUrl(url).ok).toBe(false);
    });

    it('bloquea Teredo por el cliente invertido, aunque el servidor sea público', () => {
        // En Teredo la IPv4 del cliente va **invertida** en los dos últimos hextets: 0x5601 0x5601
        // es 169.254.169.254. El servidor (5db8:d822 = 93.184.216.34) es público, así que este
        // caso solo pasa si se comprueba la inversión.
        expect(guardUrl('http://[2001:0:5db8:d822:0:0:5601:5601]/').ok).toBe(false);
    });

    it('no bloquea una IPv4 pública embebida en una forma de transición', () => {
        // La misma forma NAT64 con 93.184.216.34 embebida: la regla clasifica la IPv4, no la forma.
        expect(guardUrl('http://[64:ff9b::5db8:d822]/').ok).toBe(true);
        // Y un Teredo con servidor público y cliente público tampoco se bloquea.
        expect(guardUrl('http://[2001:0:5db8:d822:0:0:a247:27dd]/').ok).toBe(true);
    });
});

const respuestaConLocation = (location: string): FetchResponseLike => ({
    status: 302,
    headers: { get: (nombre) => (nombre.toLowerCase() === 'location' ? location : null) },
    body: { getReader: () => ({ read: async () => ({ done: true }), cancel() {} }) },
});

describe('guarda SSRF: una redirección no puede pedir un destino bloqueado', () => {
    for (const location of [
        '//127.0.0.1/',
        'http://169.254.169.254/\r\nHost: x',
        'https://[64:ff9b::a9fe:a9fe]/',
    ]) {
        it(`bloquea Location ${JSON.stringify(location)} sin pedirla`, async () => {
            const pedidas: string[] = [];
            const fetchFalso: FetchLike = async (url) => {
                pedidas.push(url);
                return respuestaConLocation(location);
            };

            const resultado = await safeFetch('https://shop.example/a', { fetchImpl: fetchFalso });

            expect(resultado.ok).toBe(false);
            expect(pedidas).toEqual(['https://shop.example/a']);
        });
    }

    it('no confunde una ruta con aspecto raro con un cambio de host', async () => {
        // `Location: /../..///127.0.0.1/` **no** es un bypass: empieza con una barra, así que es una
        // ruta relativa y el host no cambia (`https://shop.example///127.0.0.1/`, verificado con el
        // parser de URL). Esto venía en la lista de sondas del verificador independiente como caso
        // bloqueado, y su observación era falsa: bloquear una ruta por su texto rompería las
        // redirecciones legítimas del mismo host. Confundir una ruta con una autoridad es el error
        // contrario al bypass, y también hay que fijarlo.
        const pedidas: string[] = [];
        const fetchFalso: FetchLike = async (url) => {
            pedidas.push(url);
            return pedidas.length === 1
                ? respuestaConLocation('/../..///127.0.0.1/')
                : ({ status: 200, headers: { get: () => null }, body: null } as unknown as FetchResponseLike);
        };

        const resultado = await safeFetch('https://shop.example/a', { fetchImpl: fetchFalso });

        expect(resultado.ok).toBe(true);
        expect(pedidas).toEqual(['https://shop.example/a', 'https://shop.example///127.0.0.1/']);
    });
});

/**
 * Sondas de la re-auditoría independiente del fix: **el motivo exacto**, no solo que bloquee, y
 * las formas de transición con IPv4 pública, que tienen que seguir pasando. Sin la segunda tabla,
 * un bloqueo a lo bruto de `2002::/16` o `64:ff9b::/96` daría verde igual.
 */
describe('guarda SSRF: transición IPv6 con el motivo exacto', () => {
    it.each([
        ['6to4 al loopback', 'http://[2002:7f00:1::]/', 'blocked-ip-loopback'],
        ['6to4 a una privada', 'http://[2002:c0a8:101::]/', 'blocked-ip-private'],
        ['6to4 a la dirección de metadatos', 'http://[2002:a9fe:a9fe::]/', 'blocked-ip-link-local'],
        ['NAT64 a una privada', 'http://[64:ff9b::c0a8:1]/', 'blocked-ip-private'],
        ['NAT64 al loopback', 'http://[64:ff9b::7f00:1]/', 'blocked-ip-loopback'],
        ['IPv4 traducida a una privada', 'http://[::ffff:0:c0a8:101]/', 'blocked-ip-private'],
        ['IPv4 compatible a una privada', 'http://[::c0a8:1]/', 'blocked-ip-private'],
        ['Teredo con servidor privado', 'http://[2001:0:c0a8:101:0:0:0:0]/', 'blocked-ip-private'],
    ])('bloquea %s', (_caso, url, reason) => {
        expect(guardUrl(url)).toEqual({ ok: false, reason });
    });

    it.each([
        ['6to4 con IPv4 pública', 'http://[2002:5db8:d822::]/'],
        ['NAT64 con IPv4 pública', 'http://[64:ff9b::5db8:d822]/'],
        ['traducida con IPv4 pública', 'http://[::ffff:0:5db8:d822]/'],
        ['compatible con IPv4 pública', 'http://[::5db8:d822]/'],
        ['Teredo con servidor y cliente públicos', 'http://[2001:0:5db8:d822:0:0:5db8:d822]/'],
    ])('no bloquea %s', (_caso, url) => {
        expect(guardUrl(url).ok).toBe(true);
    });

    it('bloquea de forma conservadora un layout NAT64 que no es /96', () => {
        // La RFC 6052 admite otras longitudes de prefijo; acá la IPv4 no cae en los últimos 32
        // bits, así que el bloqueo sale por casualidad del rango que sí se lee. Se documenta como
        // bloqueo conservador en vez de fingir que la lectura es correcta.
        expect(guardUrl('http://[64:ff9b::a9fe:a9fe:0:0]/')).toEqual({
            ok: false,
            reason: 'blocked-ip-unspecified',
        });
    });

    it('clasifica la transición también por el camino del resolvedor', () => {
        // `blockedIpReason` es lo que `safeFetch` aplica a cada dirección que devuelve el DNS.
        expect(blockedIpReason('64:ff9b::a9fe:a9fe')).toBe('blocked-ip-link-local');
        expect(blockedIpReason('2002:7f00:1::')).toBe('blocked-ip-loopback');
    });
});

/**
 * El otro hueco que encontró la auditoría adversarial de T4: **DNS rebinding (TOCTOU)**. La
 * validación del resolvedor solo bendecía el *nombre*; el `fetch` de verdad volvía a resolverlo, así
 * que un nombre controlado por el atacante podía responder público a la guarda y privado al socket
 * y llegar a una dirección que nadie contrastó.
 *
 * La mitigación no puede cerrar la ventana (Deno no permite fijar la IP del socket desde `fetch`),
 * pero sí estrecharla: se resuelve otra vez **justo antes** de pedir y se rechaza si la respuesta
 * cambió. Lo que se prueba acá es que un cambio de respuesta (o una segunda resolución que tira)
 * termina en rechazo, y que el `fetch` **no se llama**: si se llamara, la comprobación llegaría
 * tarde para tener efecto.
 */
describe('guarda SSRF: DNS rebinding entre la validación y la conexión', () => {
    /** Respuesta 200 mínima: el cuerpo es `null`, así que no hace falta simular lectura. */
    const respuestaVacia = (): FetchResponseLike => ({
        status: 200,
        headers: { get: (nombre) => (nombre.toLowerCase() === 'content-type' ? 'text/html' : null) },
        body: null,
    });

    it('no pide nada cuando la segunda resolución cambia a una dirección privada', async () => {
        // El caso del ataque: la primera respuesta es pública y pasa la guarda; la segunda, la que
        // se acerca al socket, es privada. `blocked-ip-private` es el motivo que ya existe para una
        // dirección privada, así que se reutiliza el nombre en vez de inventar uno nuevo.
        const pedidas: string[] = [];
        const fetchFalso: FetchLike = async (url) => {
            pedidas.push(url);
            return respuestaVacia();
        };
        let resoluciones = 0;
        const resolveHost = async (): Promise<string[]> => {
            resoluciones += 1;
            return resoluciones === 1 ? ['93.184.216.34'] : ['10.0.0.7'];
        };

        const resultado = await safeFetch('https://rebind.example/producto', {
            fetchImpl: fetchFalso,
            resolveHost,
        });

        expect(pedidas).toEqual([]);
        expect(resultado).toEqual({
            ok: false,
            reason: 'blocked-ip-private',
            finalUrl: 'https://rebind.example/producto',
            status: null,
        });
        // Una sola resolución extra, no un bucle: validar + reconfirmar.
        expect(resoluciones).toBe(2);
    });

    it('no pide nada cuando la segunda resolución cambia a otra dirección pública', async () => {
        // Ninguna de las dos direcciones está prohibida, así que ninguna regla `blocked-ip-*` nombra
        // lo que pasó: el problema es que el nombre **cambió de opinión** entre la guarda y la
        // conexión, y el vocabulario necesita un motivo para eso (`dns-changed`).
        const pedidas: string[] = [];
        const fetchFalso: FetchLike = async (url) => {
            pedidas.push(url);
            return respuestaVacia();
        };
        let resoluciones = 0;
        const resolveHost = async (): Promise<string[]> => {
            resoluciones += 1;
            return resoluciones === 1 ? ['93.184.216.34'] : ['93.184.216.35'];
        };

        const resultado = await safeFetch('https://rebind.example/producto', {
            fetchImpl: fetchFalso,
            resolveHost,
        });

        expect(pedidas).toEqual([]);
        expect(resultado).toEqual({
            ok: false,
            reason: 'dns-changed',
            finalUrl: 'https://rebind.example/producto',
            status: null,
        });
    });

    it('no pide nada si la segunda resolución tira', async () => {
        // Un resolvedor que falla en la reconfirmación no es permiso para pedir: sin segunda
        // respuesta no hay nada que comparar, así que se falla cerrado con el mismo `dns-failed`
        // que ya usa la primera resolución.
        const pedidas: string[] = [];
        const fetchFalso: FetchLike = async (url) => {
            pedidas.push(url);
            return respuestaVacia();
        };
        let resoluciones = 0;
        const resolveHost = async (): Promise<string[]> => {
            resoluciones += 1;
            if (resoluciones === 1) return ['93.184.216.34'];
            throw new Error('DNS inestable');
        };

        const resultado = await safeFetch('https://shop.example/producto', {
            fetchImpl: fetchFalso,
            resolveHost,
        });

        expect(pedidas).toEqual([]);
        expect(resultado).toEqual({
            ok: false,
            reason: 'dns-failed',
            finalUrl: 'https://shop.example/producto',
            status: null,
        });
        expect(resoluciones).toBe(2);
    });

    it('pide una sola vez cuando las dos resoluciones coinciden', async () => {
        // La preservación: la reconfirmación no puede romper el caso normal de una tienda que
        // resuelve estable. Se afirma el resultado entero, no solo `ok`, para fijar el contrato.
        const pedidas: string[] = [];
        const fetchFalso: FetchLike = async (url) => {
            pedidas.push(url);
            return respuestaVacia();
        };
        let resoluciones = 0;
        const resolveHost = async (): Promise<string[]> => {
            resoluciones += 1;
            return ['93.184.216.34'];
        };

        const resultado = await safeFetch('https://shop.example/producto', {
            fetchImpl: fetchFalso,
            resolveHost,
        });

        expect(pedidas).toEqual(['https://shop.example/producto']);
        expect(resultado).toEqual({
            ok: true,
            status: 200,
            finalUrl: 'https://shop.example/producto',
            contentType: 'text/html',
            body: '',
            truncated: false,
        });
        expect(resoluciones).toBe(2);
    });

    it('no reconfirma un literal IP, que no tiene nombre que rebindear', async () => {
        // La reconfirmación es una consulta por nombre: un literal IP no se resuelve ni la primera
        // vez, así que tampoco la segunda. Fija también que la mitigación no duplique la guarda.
        const pedidas: string[] = [];
        const fetchFalso: FetchLike = async (url) => {
            pedidas.push(url);
            return respuestaVacia();
        };
        let resoluciones = 0;
        const resolveHost = async (): Promise<string[]> => {
            resoluciones += 1;
            return ['10.0.0.7'];
        };

        const resultado = await safeFetch('http://8.8.8.8/producto', { fetchImpl: fetchFalso, resolveHost });

        expect(pedidas).toEqual(['http://8.8.8.8/producto']);
        expect(resultado.ok).toBe(true);
        expect(resoluciones).toBe(0);
    });
});
