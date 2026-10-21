import { describe, expect, it } from 'vitest';
import { buildBrowserHeaders } from '../../supabase/functions/_shared/product-extraction/net/headers.ts';
import {
    blockedIpReason,
    guardUrl,
    type GuardReason,
} from '../../supabase/functions/_shared/product-extraction/net/url-guard.ts';
import {
    safeFetch,
    type FetchInitLike,
    type FetchLike,
    type FetchResponseLike,
    type ResponseBodyLike,
} from '../../supabase/functions/_shared/product-extraction/net/safe-fetch.ts';

/**
 * Toda la red de este archivo es un `fetchImpl` falso: no sale ni un paquete. Los casos que se
 * afirman son los que la guarda SSRF tiene que cubrir, no los que el detector de mutaciones
 * quiera. Ningún test llama a `fetch` global ni a `Deno.resolveDns`.
 */

/* ------------------------------------------------------------------ *
 * Utilidades de respuesta falsa
 * ------------------------------------------------------------------ */

function cuerpoDe(trozos: Uint8Array[]): ResponseBodyLike {
    let indice = 0;
    return {
        getReader() {
            return {
                async read() {
                    if (indice >= trozos.length) return { done: true, value: undefined };
                    const value = trozos[indice];
                    indice += 1;
                    return { done: false, value };
                },
                cancel() {
                    /* no hace falta liberar nada en un cuerpo falso */
                },
            };
        },
    };
}

function cuerpoColgado(signal: AbortSignal): ResponseBodyLike {
    return {
        getReader() {
            return {
                read() {
                    return new Promise<{ done: boolean; value?: Uint8Array }>((_, reject) => {
                        const abortar = () => reject(new DOMException('Aborted', 'AbortError'));
                        if (signal.aborted) {
                            abortar();
                            return;
                        }
                        signal.addEventListener('abort', abortar, { once: true });
                    });
                },
                cancel() {
                    /* idem */
                },
            };
        },
    };
}

function respuesta(opciones: {
    status?: number;
    body?: string;
    contentType?: string | null;
    headers?: Record<string, string>;
} = {}): FetchResponseLike {
    const { status = 200, body = '', contentType = 'text/html; charset=utf-8', headers = {} } = opciones;
    const mapa: Record<string, string> = { ...headers };
    if (contentType !== null) mapa['content-type'] = contentType;
    return {
        status,
        headers: { get: (nombre: string) => mapa[nombre.toLowerCase()] ?? null },
        body: cuerpoDe([new TextEncoder().encode(body)]),
    };
}

/* ------------------------------------------------------------------ *
 * guardUrl: esquema
 * ------------------------------------------------------------------ */

describe('guardUrl · esquema', () => {
    it('acepta http y https', () => {
        expect(guardUrl('http://shop.example/producto')).toEqual({
            ok: true,
            url: 'http://shop.example/producto',
        });
        expect(guardUrl('https://shop.example/producto')).toEqual({
            ok: true,
            url: 'https://shop.example/producto',
        });
    });

    it('rechaza cualquier esquema que no sea http(s), nombrando la regla', () => {
        for (const bruto of ['ftp://shop.example/x', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,x']) {
            expect(guardUrl(bruto)).toEqual({ ok: false, reason: 'scheme-not-allowed' });
        }
    });
});

/* ------------------------------------------------------------------ *
 * guardUrl: credenciales y puerto
 * ------------------------------------------------------------------ */

describe('guardUrl · credenciales y puerto', () => {
    it('rechaza credenciales embebidas (usuario:contraseña@host)', () => {
        expect(guardUrl('https://usuario:secreto@shop.example/')).toEqual({
            ok: false,
            reason: 'credentials-not-allowed',
        });
        expect(guardUrl('https://usuario@shop.example/')).toEqual({
            ok: false,
            reason: 'credentials-not-allowed',
        });
    });

    it('rechaza un puerto explícito distinto de 80/443', () => {
        expect(guardUrl('https://shop.example:8443/')).toEqual({ ok: false, reason: 'port-not-allowed' });
        expect(guardUrl('http://shop.example:8080/')).toEqual({ ok: false, reason: 'port-not-allowed' });
        expect(guardUrl('http://shop.example:22/')).toEqual({ ok: false, reason: 'port-not-allowed' });
    });

    it('acepta los puertos estándar 80 y 443', () => {
        expect(guardUrl('https://shop.example:443/producto')).toEqual({
            ok: true,
            url: 'https://shop.example/producto',
        });
        expect(guardUrl('http://shop.example:80/producto')).toEqual({
            ok: true,
            url: 'http://shop.example/producto',
        });
    });
});

/* ------------------------------------------------------------------ *
 * guardUrl: topes de longitud
 * ------------------------------------------------------------------ */

describe('guardUrl · longitudes', () => {
    it('rechaza una URL que pasa el tope de longitud', () => {
        const larga = `https://shop.example/producto?basura=${'x'.repeat(5000)}`;
        expect(guardUrl(larga)).toEqual({ ok: false, reason: 'url-too-long' });
    });

    it('rechaza un hostname que pasa el tope de 253 caracteres', () => {
        // Cinco etiquetas de 50 + cuatro puntos = 254 caracteres: por encima del máximo DNS.
        const host = Array.from({ length: 5 }, () => 'a'.repeat(50)).join('.');
        expect(host.length).toBe(254);
        expect(guardUrl(`https://${host}/`)).toEqual({ ok: false, reason: 'hostname-too-long' });
    });

    it('acepta un hostname justo por debajo del tope', () => {
        const host = Array.from({ length: 5 }, () => 'a'.repeat(49)).join('.');
        expect(host.length).toBe(249);
        expect(guardUrl(`https://${host}/`)).toEqual({ ok: true, url: `https://${host}/` });
    });
});

/* ------------------------------------------------------------------ *
 * guardUrl: literales IP que nunca son una tienda
 * ------------------------------------------------------------------ */

function rangos(urls: string[], esperado: GuardReason): void {
    for (const url of urls) {
        expect(guardUrl(url), url).toEqual({ ok: false, reason: esperado });
    }
}

describe('guardUrl · literales IP bloqueados', () => {
    it('bloquea loopback (127/8 y ::1)', () => {
        rangos(
            ['http://127.0.0.1/', 'http://127.0.0.5:80/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/'],
            'blocked-ip-loopback'
        );
    });

    it('bloquea rangos privados (10/8, 172.16/12, 192.168/16)', () => {
        rangos(
            [
                'http://10.0.0.1/',
                'http://172.16.0.1/',
                'http://172.31.255.255/',
                'http://192.168.1.1/',
                'http://[::ffff:10.0.0.1]/',
            ],
            'blocked-ip-private'
        );
    });

    it('bloquea enlace-local (169.254/16 y fe80::/10), incluida la IP de metadatos', () => {
        rangos(
            ['http://169.254.169.254/latest/meta-data/', 'http://169.254.0.1/', 'http://[fe80::1]/'],
            'blocked-ip-link-local'
        );
    });

    it('bloquea unique-local (fc00::/7)', () => {
        rangos(['http://[fc00::1]/', 'http://[fd12:3456::1]/'], 'blocked-ip-unique-local');
    });

    it('bloquea carrier-grade NAT (100.64/10)', () => {
        rangos(['http://100.64.0.1/', 'http://100.127.255.254/'], 'blocked-ip-carrier-grade-nat');
    });

    it('bloquea multicast (224/4 y ff00::/8)', () => {
        rangos(
            ['http://224.0.0.1/', 'http://239.255.255.255/', 'http://[ff02::1]/'],
            'blocked-ip-multicast'
        );
    });

    it('bloquea la dirección no especificada (0.0.0.0 y ::)', () => {
        rangos(['http://0.0.0.0/', 'http://[::]/', 'http://[::ffff:0.0.0.0]/'], 'blocked-ip-unspecified');
    });

    it('bloquea el rango reservado (240/4)', () => {
        rangos(['http://240.0.0.1/', 'http://255.255.255.255/'], 'blocked-ip-reserved');
    });

    it('no reclama direcciones públicas ni los bordes de los rangos bloqueados', () => {
        const publicas = [
            'http://8.8.8.8/',
            'https://93.184.216.34/',
            'http://172.32.0.1/',
            'http://172.15.255.255/',
            'http://11.0.0.1/',
            'http://192.169.0.1/',
            'http://169.253.255.255/',
            'http://100.63.255.255/',
            'http://100.128.0.1/',
            'http://223.255.255.255/',
        ];
        for (const url of publicas) {
            expect(guardUrl(url).ok, url).toBe(true);
        }
        expect(guardUrl('http://[2606:4700::1111]/').ok).toBe(true);
    });

    it('clasifica la IP desnuda igual que la URL, para que la use el resolvedor', () => {
        expect(blockedIpReason('127.0.0.1')).toBe('blocked-ip-loopback');
        expect(blockedIpReason('10.1.2.3')).toBe('blocked-ip-private');
        expect(blockedIpReason('169.254.169.254')).toBe('blocked-ip-link-local');
        expect(blockedIpReason('::ffff:192.168.0.1')).toBe('blocked-ip-private');
        expect(blockedIpReason('::1')).toBe('blocked-ip-loopback');
        expect(blockedIpReason('fe80::1')).toBe('blocked-ip-link-local');
        expect(blockedIpReason('2606:4700::1111')).toBeNull();
        expect(blockedIpReason('shop.example')).toBeNull();
    });
});

/* ------------------------------------------------------------------ *
 * guardUrl: hostnames que nunca son una tienda
 * ------------------------------------------------------------------ */

describe('guardUrl · hostnames reservados', () => {
    it('bloquea localhost y sus subdominios', () => {
        rangos(['http://localhost/', 'http://localhost:80/x', 'http://dev.localhost/'], 'blocked-hostname');
    });

    it('bloquea .local, .internal y metadata.google.internal', () => {
        rangos(
            [
                'http://impresora.local/',
                'http://servicio.internal/',
                'http://metadata.google.internal/computeMetadata/',
            ],
            'blocked-hostname'
        );
    });

    it('no bloquea nombres parecidos', () => {
        expect(guardUrl('http://notlocalhost.example/').ok).toBe(true);
        expect(guardUrl('http://localhost.evil.example/').ok).toBe(true);
        expect(guardUrl('http://internal.example/').ok).toBe(true);
    });
});

/* ------------------------------------------------------------------ *
 * guardUrl: nada tira, ni siquiera la basura
 * ------------------------------------------------------------------ */

describe('guardUrl · entradas basura', () => {
    it('devuelve invalid-url sin tirar con entrada vacía, número o nula', () => {
        for (const bruto of ['', '   ', 42, 0, null, undefined, true, {}, [], 'no es una url', '//shop.example/']) {
            expect(() => guardUrl(bruto), String(bruto)).not.toThrow();
            expect(guardUrl(bruto), String(bruto)).toEqual({ ok: false, reason: 'invalid-url' });
        }
    });

    it('acepta una URL con unicode sin tirar y normaliza el host a punycode', () => {
        const resultado = guardUrl('https://mañana.es/producto');
        expect(resultado.ok).toBe(true);
        if (resultado.ok) expect(resultado.url).toContain('xn--maana-pta.es');
        expect(guardUrl('https://例え.テスト/パス').ok).toBe(true);
    });
});

/* ------------------------------------------------------------------ *
 * safeFetch
 * ------------------------------------------------------------------ */

describe('safeFetch · caso feliz', () => {
    it('trae el cuerpo de una URL pública y devuelve el resultado completo', async () => {
        const llamadas: string[] = [];
        const fetchFalso: FetchLike = async (url) => {
            llamadas.push(url);
            return respuesta({ status: 200, body: '<html>hola</html>' });
        };

        const resultado = await safeFetch('https://shop.example/producto', { fetchImpl: fetchFalso });

        expect(llamadas).toEqual(['https://shop.example/producto']);
        expect(resultado).toEqual({
            ok: true,
            status: 200,
            finalUrl: 'https://shop.example/producto',
            contentType: 'text/html; charset=utf-8',
            body: '<html>hola</html>',
            truncated: false,
        });
    });

    it('no devuelve el cuerpo de un 403 con challenge: el bloqueo no llega al parser', async () => {
        // Antes esto devolvía `ok: true` con el cuerpo del challenge y el extractor lo convertía en
        // un deseo titulado «Just a moment...». Medido el 2026-10-21 contra PcComponentes.
        const fetchFalso: FetchLike = async () =>
            respuesta({ status: 403, body: '<title>Just a moment...</title>' });

        const resultado = await safeFetch('https://shop.example/producto', { fetchImpl: fetchFalso });

        expect(resultado).toEqual({
            ok: false,
            reason: 'blocked-by-site',
            finalUrl: 'https://shop.example/producto',
            status: 403,
        });
    });
});

describe('safeFetch · headers', () => {
    it('manda exactamente los headers canónicos y nada más, con redirect manual', async () => {
        let initCapturado: FetchInitLike | null = null;
        const fetchFalso: FetchLike = async (_url, init) => {
            initCapturado = init;
            return respuesta({ body: '<html></html>' });
        };

        await safeFetch('https://shop.example/producto', { fetchImpl: fetchFalso });

        expect(initCapturado).not.toBeNull();
        const init = initCapturado as unknown as FetchInitLike;
        expect(init.headers).toEqual(buildBrowserHeaders());
        expect(init.redirect).toBe('manual');
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });
});

describe('safeFetch · redirecciones', () => {
    it('sigue una redirección pública y devuelve la URL final', async () => {
        const visitadas: string[] = [];
        const fetchFalso: FetchLike = async (url, init) => {
            visitadas.push(url);
            expect(init.redirect).toBe('manual');
            if (url === 'https://shop.example/a') {
                return respuesta({ status: 301, headers: { location: 'https://shop.example/b' } });
            }
            return respuesta({ status: 200, body: 'final' });
        };

        const resultado = await safeFetch('https://shop.example/a', { fetchImpl: fetchFalso });

        expect(visitadas).toEqual(['https://shop.example/a', 'https://shop.example/b']);
        expect(resultado).toEqual({
            ok: true,
            status: 200,
            finalUrl: 'https://shop.example/b',
            contentType: 'text/html; charset=utf-8',
            body: 'final',
            truncated: false,
        });
    });

    it('bloquea una redirección a una dirección privada, sin pedirla nunca', async () => {
        const visitadas: string[] = [];
        const fetchFalso: FetchLike = async (url) => {
            visitadas.push(url);
            return respuesta({ status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
        };

        const resultado = await safeFetch('https://shop.example/a', { fetchImpl: fetchFalso });

        // `finalUrl` es el último salto que sí pasó la guarda; `status` es `null` porque el
        // salto bloqueado no se pidió nunca y por tanto no tiene respuesta. El 302 se queda
        // atrás: el motivo ya dice que la guarda cortó, no que el destino falló.
        expect(resultado).toEqual({
            ok: false,
            reason: 'blocked-ip-link-local',
            finalUrl: 'https://shop.example/a',
            status: null,
        });
        expect(visitadas).toEqual(['https://shop.example/a']);
    });

    it('bloquea una redirección a un esquema que no es http(s)', async () => {
        const fetchFalso: FetchLike = async () =>
            respuesta({ status: 302, headers: { location: 'file:///etc/passwd' } });

        const resultado = await safeFetch('https://shop.example/a', { fetchImpl: fetchFalso });

        expect(resultado.ok).toBe(false);
        if (!resultado.ok) expect(resultado.reason).toBe('scheme-not-allowed');
    });

    it('bloquea una cadena de redirecciones más larga que el máximo', async () => {
        let pedidos = 0;
        const fetchFalso: FetchLike = async (url) => {
            pedidos += 1;
            return respuesta({ status: 302, headers: { location: `${url}/x` } });
        };

        const resultado = await safeFetch('https://shop.example/a', { fetchImpl: fetchFalso, maxRedirects: 2 });

        expect(resultado).toEqual({
            ok: false,
            reason: 'too-many-redirects',
            finalUrl: 'https://shop.example/a/x/x',
            status: 302,
        });
        expect(pedidos).toBe(3);
    });

    it('falla con redirect-without-location cuando el 3xx no trae Location', async () => {
        const fetchFalso: FetchLike = async () => respuesta({ status: 302 });

        const resultado = await safeFetch('https://shop.example/a', { fetchImpl: fetchFalso });

        expect(resultado).toEqual({
            ok: false,
            reason: 'redirect-without-location',
            finalUrl: 'https://shop.example/a',
            status: 302,
        });
    });
});

describe('safeFetch · tiempo y tamaño', () => {
    it('corta por presupuesto de tiempo y aborta la lectura del cuerpo en vez de colgarse', async () => {
        const fetchFalso: FetchLike = async (_url, init) => ({
            status: 200,
            headers: { get: () => 'text/html' },
            body: cuerpoColgado(init.signal),
        });

        const resultado = await safeFetch('https://shop.example/producto', { fetchImpl: fetchFalso, timeoutMs: 30 });

        expect(resultado).toEqual({
            ok: false,
            reason: 'timeout',
            finalUrl: 'https://shop.example/producto',
            status: 200,
        });
    });

    it('trunca un cuerpo que pasa el tope y lo sigue devolviendo utilizable', async () => {
        const cuerpo = 'x'.repeat(100);
        const fetchFalso: FetchLike = async () => respuesta({ status: 200, body: cuerpo });

        const resultado = await safeFetch('https://shop.example/producto', { fetchImpl: fetchFalso, maxBytes: 10 });

        expect(resultado.ok).toBe(true);
        if (resultado.ok) {
            expect(resultado.truncated).toBe(true);
            expect(resultado.body).toBe('xxxxxxxxxx');
            expect(resultado.status).toBe(200);
        }
    });

    it('no marca truncado cuando el cuerpo cabe justo en el tope', async () => {
        const fetchFalso: FetchLike = async () => respuesta({ status: 200, body: 'x'.repeat(10) });

        const resultado = await safeFetch('https://shop.example/producto', { fetchImpl: fetchFalso, maxBytes: 10 });

        expect(resultado.ok).toBe(true);
        if (resultado.ok) {
            expect(resultado.truncated).toBe(false);
            expect(resultado.body).toBe('xxxxxxxxxx');
        }
    });
});

describe('safeFetch · resolvedor inyectable', () => {
    it('bloquea cuando un nombre público resuelve a una dirección privada', async () => {
        const fetchFalso: FetchLike = async () => respuesta({ body: 'no debería llegar' });

        const resultado = await safeFetch('https://tienda-que-miente.example/', {
            fetchImpl: fetchFalso,
            resolveHost: async () => ['93.184.216.34', '10.0.0.7'],
        });

        expect(resultado).toEqual({
            ok: false,
            reason: 'blocked-ip-private',
            finalUrl: 'https://tienda-que-miente.example/',
            status: null,
        });
    });

    it('deja pasar un nombre que resuelve solo a direcciones públicas', async () => {
        const hosts: string[] = [];
        const fetchFalso: FetchLike = async () => respuesta({ body: 'ok' });

        const resultado = await safeFetch('https://shop.example/producto', {
            fetchImpl: fetchFalso,
            resolveHost: async (host) => {
                hosts.push(host);
                return ['93.184.216.34'];
            },
        });

        expect(hosts).toEqual(['shop.example', 'shop.example']);
        expect(resultado.ok).toBe(true);
    });

    it('falla con dns-failed cuando el resolvedor revienta, sin tirar', async () => {
        const fetchFalso: FetchLike = async () => respuesta({ body: 'no' });

        const resultado = await safeFetch('https://shop.example/producto', {
            fetchImpl: fetchFalso,
            resolveHost: async () => {
                throw new Error('DNS caído');
            },
        });

        expect(resultado).toEqual({
            ok: false,
            reason: 'dns-failed',
            finalUrl: 'https://shop.example/producto',
            status: null,
        });
    });

    it('no consulta el resolvedor para un literal IP público', async () => {
        let consultas = 0;
        const fetchFalso: FetchLike = async () => respuesta({ status: 200, body: 'ok' });

        const resultado = await safeFetch('http://8.8.8.8/', {
            fetchImpl: fetchFalso,
            resolveHost: async () => {
                consultas += 1;
                return ['10.0.0.1'];
            },
        });

        expect(consultas).toBe(0);
        expect(resultado.ok).toBe(true);
    });
});

describe('safeFetch · entradas basura', () => {
    it('devuelve invalid-url sin tirar y sin tocar el fetch', async () => {
        let llamadas = 0;
        const fetchFalso: FetchLike = async () => {
            llamadas += 1;
            return respuesta();
        };

        for (const bruto of ['', 42, null, undefined, 'no es una url']) {
            const resultado = await safeFetch(bruto, { fetchImpl: fetchFalso });
            expect(resultado).toEqual({ ok: false, reason: 'invalid-url', finalUrl: null, status: null });
        }
        expect(llamadas).toBe(0);
    });

    it('no tira si el fetch inyectado revienta', async () => {
        const fetchFalso: FetchLike = async () => {
            throw new Error('sin red');
        };

        const resultado = await safeFetch('https://shop.example/producto', { fetchImpl: fetchFalso });

        expect(resultado).toEqual({
            ok: false,
            reason: 'fetch-failed',
            finalUrl: 'https://shop.example/producto',
            status: null,
        });
    });
});
