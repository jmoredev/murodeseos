import { describe, expect, it } from 'vitest';
import {
    pinnedFetch,
    type AbrirConexion,
    type ConexionHttp,
    type ParametrosConexion,
} from '../../supabase/functions/_shared/product-extraction/net/pinned-http.ts';
import {
    safeFetch,
    type FetchInitLike,
    type FetchLike,
    type FetchResponseLike,
} from '../../supabase/functions/_shared/product-extraction/net/safe-fetch.ts';

/**
 * El transporte propio de la capa de red. Todas las conexiones de este archivo son **falsas y en
 * memoria**: no sale ni un paquete y no hace falta `Deno`, así que se prueba el cliente HTTP
 * entero (bytes de la petición, SNI, parseo, cuerpo, topes y cierre) sin red.
 *
 * Lo que fija cada caso:
 *
 * - la petición se escribe a mano y el socket va a la **IP validada**, con el **nombre real** como
 *   SNI, que es lo que cierra el DNS rebinding: el nombre ya no se resuelve una segunda vez;
 * - el cuerpo se entrega como un `Response` real, así que `safeFetch` sigue leyendo
 *   `headers.get('location')`, `content-type` y el cuerpo sin cambios.
 */

/* ------------------------------------------------------------------ *
 * Conexión falsa en memoria
 * ------------------------------------------------------------------ */

function bytes(texto: string): Uint8Array {
    return new TextEncoder().encode(texto);
}

function unir(trozos: Uint8Array[]): Uint8Array {
    const total = trozos.reduce((suma, trozo) => suma + trozo.length, 0);
    const unido = new Uint8Array(total);
    let offset = 0;
    for (const trozo of trozos) {
        unido.set(trozo, offset);
        offset += trozo.length;
    }
    return unido;
}

/** Parte una respuesta en trozos pequeños para forzar lecturas parciales del parser. */
function trocear(texto: string, tamano = 7): Uint8Array[] {
    const datos = bytes(texto);
    const trozos: Uint8Array[] = [];
    for (let i = 0; i < datos.length; i += tamano) trozos.push(datos.slice(i, i + tamano));
    return trozos;
}

type ConexionFalsa = ConexionHttp & {
    /** Todo lo que el cliente escribió, ya decodificado. */
    peticion(): string;
    /** `true` si el cliente cerró la conexión. */
    cerrada(): boolean;
    /** Bytes que la conexión llegó a entregar, para probar que no se lee de más. */
    entregados(): number;
};

/**
 * Conexión falsa. `siguiente` devuelve el próximo trozo de la respuesta, o `null` al terminar el
 * guion. Con `colgar` la lectura se queda pendiente para siempre (servidor que no contesta).
 */
function crearConexionFalsa(
    siguiente: () => Uint8Array | null,
    opciones: { colgar?: boolean } = {}
): ConexionFalsa {
    let pendiente: Uint8Array = new Uint8Array(0);
    let cerrrada = false;
    let entregados = 0;
    const escrituras: Uint8Array[] = [];

    return {
        async read(destino: Uint8Array) {
            while (pendiente.length === 0) {
                const trozo = siguiente();
                if (trozo === null) {
                    // Con `colgar` la lectura se queda pendiente para siempre; solo el aborto puede
                    // sacar al cliente de acá.
                    if (opciones.colgar) return new Promise<null>(() => {});
                    return null;
                }
                pendiente = trozo;
            }
            const cuantos = Math.min(pendiente.length, destino.length);
            destino.set(pendiente.subarray(0, cuantos), 0);
            pendiente = pendiente.subarray(cuantos);
            entregados += cuantos;
            return cuantos;
        },
        async write(datos: Uint8Array) {
            escrituras.push(datos.slice());
            return datos.length;
        },
        close() {
            cerrrada = true;
        },
        peticion() {
            return new TextDecoder().decode(unir(escrituras));
        },
        cerrada() {
            return cerrrada;
        },
        entregados() {
            return entregados;
        },
    };
}

/** Conexión que sirve una respuesta fija, troceada. */
function conexionConRespuesta(respuesta: string, tamanoDeTrozo?: number): ConexionFalsa {
    const trozos = trocear(respuesta, tamanoDeTrozo);
    let indice = 0;
    return crearConexionFalsa(() => (indice < trozos.length ? trozos[indice++] : null));
}

type Llamada = { parametros: ParametrosConexion; conexion: ConexionFalsa };

/** Abridor inyectable: captura los parámetros de conexión y devuelve una conexión falsa. */
function abridorFalso(respuesta: string | ConexionFalsa): { abrir: AbrirConexion; llamadas: Llamada[] } {
    const llamadas: Llamada[] = [];
    const conexion = typeof respuesta === 'string' ? conexionConRespuesta(respuesta) : respuesta;
    return {
        llamadas,
        abrir: async (parametros) => {
            llamadas.push({ parametros, conexion });
            return conexion;
        },
    };
}

const OK_CON_LONGITUD = 'HTTP/1.1 200 OK\r\nContent-Length: 11\r\nContent-Type: text/html\r\n\r\nHola mundo!';

/* ------------------------------------------------------------------ *
 * Petición escrita a mano
 * ------------------------------------------------------------------ */

describe('pinnedFetch · petición', () => {
    it('escribe una petición HTTP/1.1 con Host, Connection: close y accept-encoding: identity', async () => {
        const conexion = conexionConRespuesta(OK_CON_LONGITUD);
        const { abrir } = abridorFalso(conexion);

        await pinnedFetch('https://shop.example/producto?color=rojo', {
            headers: { 'user-agent': 'Mozilla/5.0', 'Accept-Language': 'es-ES' },
            address: '93.184.216.34',
            abrirConexion: abrir,
        });

        // Se afirma la petición entera: la línea de petición y el orden de las cabeceras son el
        // contrato que el servidor ve, no un detalle interno.
        expect(conexion.peticion()).toBe(
            'GET /producto?color=rojo HTTP/1.1\r\n' +
                'Host: shop.example\r\n' +
                'Connection: close\r\n' +
                'accept-encoding: identity\r\n' +
                'user-agent: Mozilla/5.0\r\n' +
                'Accept-Language: es-ES\r\n' +
                '\r\n'
        );
    });

    it('no manda content-length en un GET', async () => {
        const conexion = conexionConRespuesta(OK_CON_LONGITUD);
        const { abrir } = abridorFalso(conexion);

        await pinnedFetch('https://shop.example/', { headers: {}, address: '93.184.216.34', abrirConexion: abrir });

        expect(conexion.peticion().toLowerCase()).not.toContain('content-length');
    });

    it('deja que el llamador no pueda pisar Host ni Connection con sus headers', async () => {
        const conexion = conexionConRespuesta(OK_CON_LONGITUD);
        const { abrir } = abridorFalso(conexion);

        await pinnedFetch('https://shop.example/', {
            headers: { Host: 'evil.example', connection: 'keep-alive' },
            address: '93.184.216.34',
            abrirConexion: abrir,
        });

        expect(conexion.peticion()).toContain('Host: shop.example\r\n');
        expect(conexion.peticion()).toContain('Connection: close\r\n');
        expect(conexion.peticion()).not.toContain('evil.example');
    });

    it('incluye el puerto no estándar en el Host', async () => {
        const conexion = conexionConRespuesta(OK_CON_LONGITUD);
        const { abrir } = abridorFalso(conexion);

        await pinnedFetch('http://shop.example:443/producto', {
            headers: {},
            address: '93.184.216.34',
            abrirConexion: abrir,
        });

        expect(conexion.peticion()).toContain('Host: shop.example:443\r\n');
    });

    it('pide la ruta raíz cuando la URL no trae camino', async () => {
        const conexion = conexionConRespuesta(OK_CON_LONGITUD);
        const { abrir } = abridorFalso(conexion);

        await pinnedFetch('https://shop.example', { headers: {}, address: '93.184.216.34', abrirConexion: abrir });

        expect(conexion.peticion().startsWith('GET / HTTP/1.1\r\n')).toBe(true);
    });
});

/* ------------------------------------------------------------------ *
 * Socket a la IP validada, SNI con el nombre real
 * ------------------------------------------------------------------ */

describe('pinnedFetch · conexión fijada a la IP', () => {
    it('para https conecta a la IP validada y negocia TLS con el nombre real', async () => {
        const { abrir, llamadas } = abridorFalso(OK_CON_LONGITUD);

        await pinnedFetch('https://shop.example/producto', {
            headers: {},
            address: '93.184.216.34',
            abrirConexion: abrir,
        });

        expect(llamadas).toHaveLength(1);
        // El destino del socket es la dirección que ya pasó la guarda: acá no hay nombre que un
        // DNS hostil pueda volver a resolver.
        expect(llamadas[0].parametros.hostname).toBe('93.184.216.34');
        expect(llamadas[0].parametros.port).toBe(443);
        expect(llamadas[0].parametros.tls).toBe(true);
        // …y el certificado y el SNI siguen siendo del nombre real, o el TLS falla.
        expect(llamadas[0].parametros.sni).toBe('shop.example');
    });

    it('para http conecta a la IP validada en el puerto 80 y sin TLS', async () => {
        const { abrir, llamadas } = abridorFalso(OK_CON_LONGITUD);

        await pinnedFetch('http://shop.example/producto', {
            headers: {},
            address: '93.184.216.34',
            abrirConexion: abrir,
        });

        expect(llamadas[0].parametros).toEqual({
            hostname: '93.184.216.34',
            port: 80,
            tls: false,
            sni: 'shop.example',
        });
    });

    it('sin dirección validada cae al hostname (nunca hay un destino vacío)', async () => {
        const { abrir, llamadas } = abridorFalso(OK_CON_LONGITUD);

        await pinnedFetch('https://shop.example/producto', { headers: {}, abrirConexion: abrir });

        expect(llamadas[0].parametros.hostname).toBe('shop.example');
        expect(llamadas[0].parametros.sni).toBe('shop.example');
    });

    it('quita los corchetes de una IPv6 al conectar', async () => {
        const { abrir, llamadas } = abridorFalso(OK_CON_LONGITUD);

        await pinnedFetch('http://[2001:4860:4860::8888]/producto', {
            headers: {},
            address: '[2001:4860:4860::8888]',
            abrirConexion: abrir,
        });

        expect(llamadas[0].parametros.hostname).toBe('2001:4860:4860::8888');
    });
});

/* ------------------------------------------------------------------ *
 * Respuesta: estado, cabeceras y cuerpos
 * ------------------------------------------------------------------ */

describe('pinnedFetch · respuesta', () => {
    it('devuelve un Response real con status, cabeceras y cuerpo por content-length', async () => {
        const conexion = conexionConRespuesta(OK_CON_LONGITUD);
        const { abrir } = abridorFalso(conexion);

        const respuesta = await pinnedFetch('https://shop.example/producto', {
            headers: {},
            address: '93.184.216.34',
            abrirConexion: abrir,
        });

        expect(respuesta).toBeInstanceOf(Response);
        expect(respuesta.status).toBe(200);
        expect(respuesta.headers.get('content-type')).toBe('text/html');
        expect(await respuesta.text()).toBe('Hola mundo!');
        expect(conexion.cerrada()).toBe(true);
    });

    it('decodifica un cuerpo chunked, incluido el chunk final y los trailers', async () => {
        const respuestaCruda =
            'HTTP/1.1 200 OK\r\n' +
            'Transfer-Encoding: chunked\r\n' +
            'Content-Type: text/html; charset=utf-8\r\n' +
            '\r\n' +
            '5\r\nHola \r\n' +
            '6\r\nmundo!\r\n' +
            '0\r\n' +
            'X-Resto: 1\r\n' +
            '\r\n';
        const conexion = conexionConRespuesta(respuestaCruda);
        const { abrir } = abridorFalso(conexion);

        const respuesta = await pinnedFetch('https://shop.example/producto', {
            headers: {},
            address: '93.184.216.34',
            abrirConexion: abrir,
        });

        expect(respuesta.status).toBe(200);
        expect(await respuesta.text()).toBe('Hola mundo!');
        expect(conexion.cerrada()).toBe(true);
    });

    it('lee hasta el fin de la conexión cuando no hay longitud ni chunked', async () => {
        const conexion = conexionConRespuesta('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nHasta el final');
        const { abrir } = abridorFalso(conexion);

        const respuesta = await pinnedFetch('https://shop.example/producto', {
            headers: {},
            address: '93.184.216.34',
            abrirConexion: abrir,
        });

        expect(await respuesta.text()).toBe('Hasta el final');
    });

    it('expone el location de un 302 para que safeFetch pueda seguirlo', async () => {
        const conexion = conexionConRespuesta(
            'HTTP/1.1 302 Found\r\nLocation: https://shop.example/otra\r\nContent-Length: 5\r\n\r\nadios'
        );
        const { abrir } = abridorFalso(conexion);

        const respuesta = await pinnedFetch('https://shop.example/producto', {
            headers: {},
            address: '93.184.216.34',
            abrirConexion: abrir,
        });

        expect(respuesta.status).toBe(302);
        expect(respuesta.headers.get('location')).toBe('https://shop.example/otra');

        // El cuerpo de una redirección no se lee; descartarlo tiene que cerrar el socket.
        await respuesta.body?.cancel();
        expect(conexion.cerrada()).toBe(true);
    });

    it('encuentra las cabeceras sin importar cómo vengan escritas', async () => {
        const respuestaCruda =
            'HTTP/1.1 200 OK\r\n' +
            'CoNtEnT-LeNgTh: 11\r\n' +
            'cOnTeNt-TyPe: text/html\r\n' +
            '\r\n' +
            'Hola mundo!';
        const { abrir } = abridorFalso(respuestaCruda);

        const respuesta = await pinnedFetch('https://shop.example/producto', {
            headers: {},
            address: '93.184.216.34',
            abrirConexion: abrir,
        });

        expect(respuesta.headers.get('content-length')).toBe('11');
        expect(respuesta.headers.get('Content-Type')).toBe('text/html');
        expect(await respuesta.text()).toBe('Hola mundo!');
    });

    it('no inventa cuerpo en un 204', async () => {
        const { abrir } = abridorFalso('HTTP/1.1 204 No Content\r\n\r\n');

        const respuesta = await pinnedFetch('https://shop.example/producto', {
            headers: {},
            address: '93.184.216.34',
            abrirConexion: abrir,
        });

        expect(respuesta.status).toBe(204);
        expect(await respuesta.text()).toBe('');
    });
});

/* ------------------------------------------------------------------ *
 * Tope de bytes y cancelación
 * ------------------------------------------------------------------ */

describe('pinnedFetch · topes y cancelación', () => {
    it('corta en el tope de bytes en vez de leer un cuerpo infinito', async () => {
        // Servidor hostil: cabeceras válidas con una longitud enorme y cuerpo sin fin.
        const cabeceras = 'HTTP/1.1 200 OK\r\nContent-Length: 100000000\r\n\r\n';
        let indice = 0;
        const conexion = crearConexionFalsa(() => {
            indice += 1;
            return indice === 1 ? bytes(cabeceras) : bytes('0123456789');
        });
        const { abrir } = abridorFalso(conexion);

        const respuesta = await pinnedFetch('https://shop.example/producto', {
            headers: {},
            address: '93.184.216.34',
            maxBytes: 8,
            abrirConexion: abrir,
        });

        expect(await respuesta.text()).toBe('01234567');
        expect(conexion.cerrada()).toBe(true);
        // Lo que prueba que no se bufferiza de más: solo se pidió un trozo de cuerpo.
        expect(conexion.entregados()).toBeLessThanOrEqual(cabeceras.length + 10);
    });

    it('un aborto cierra el socket y rechaza la lectura', async () => {
        const cabeceras = 'HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\n';
        let indice = 0;
        const conexion = crearConexionFalsa(
            () => {
                indice += 1;
                return indice === 1 ? bytes(cabeceras) : null;
            },
            { colgar: true }
        );
        const { abrir } = abridorFalso(conexion);

        const controlador = new AbortController();
        const respuesta = await pinnedFetch('https://shop.example/producto', {
            headers: {},
            address: '93.184.216.34',
            signal: controlador.signal,
            abrirConexion: abrir,
        });

        const lectura = respuesta.text();
        await new Promise((resolver) => setTimeout(resolver, 0));
        controlador.abort();

        await expect(lectura).rejects.toThrow();
        expect(conexion.cerrada()).toBe(true);
    });

    it('rechaza antes de conectar cuando la señal ya viene abortada', async () => {
        const { abrir, llamadas } = abridorFalso(OK_CON_LONGITUD);
        const controlador = new AbortController();
        controlador.abort();

        await expect(
            pinnedFetch('https://shop.example/producto', {
                headers: {},
                address: '93.184.216.34',
                signal: controlador.signal,
                abrirConexion: abrir,
            })
        ).rejects.toThrow();

        expect(llamadas).toHaveLength(0);
    });

    it('cierra el socket aunque la respuesta no traiga cabeceras válidas', async () => {
        const conexion = conexionConRespuesta('esto no es HTTP');
        const { abrir } = abridorFalso(conexion);

        await expect(
            pinnedFetch('https://shop.example/producto', {
                headers: {},
                address: '93.184.216.34',
                abrirConexion: abrir,
            })
        ).rejects.toThrow();

        expect(conexion.cerrada()).toBe(true);
    });

    it('cierra el socket cuando el servidor no contesta nada', async () => {
        const conexion = crearConexionFalsa(() => null);
        const { abrir } = abridorFalso(conexion);

        await expect(
            pinnedFetch('https://shop.example/producto', {
                headers: {},
                address: '93.184.216.34',
                abrirConexion: abrir,
            })
        ).rejects.toThrow();

        expect(conexion.cerrada()).toBe(true);
    });
});

/* ------------------------------------------------------------------ *
 * Cableado con safeFetch
 * ------------------------------------------------------------------ */

const respuestaVacia = (): FetchResponseLike => ({
    status: 200,
    headers: { get: (nombre) => (nombre.toLowerCase() === 'content-type' ? 'text/html' : null) },
    body: null,
});

/**
 * Pone un `Deno` de mentira en `globalThis` para que `safeFetch` corra `pinnedFetch` de verdad
 * (sin pasar `fetchImpl`) contra conexiones en memoria. Devuelve las conexiones que se abrieron y
 * los parámetros de cada apertura.
 */
async function conDenoFalso(
    conexiones: ConexionFalsa[],
    cuerpo: () => Promise<void>
): Promise<ParametrosConexion[]> {
    const llamadas: ParametrosConexion[] = [];
    let siguiente = 0;

    const denoFalso = {
        connect: async (parametros: { hostname: string; port: number }): Promise<ConexionHttp> => {
            const conexion = conexiones[siguiente];
            siguiente += 1;
            if (!conexion) throw new Error('el test no preparó más conexiones');
            llamadas.push({ hostname: parametros.hostname, port: parametros.port, tls: false, sni: '' });
            return conexion;
        },
        startTls: async (conexion: ConexionHttp, opciones: { hostname: string }): Promise<ConexionHttp> => {
            llamadas[llamadas.length - 1] = { ...llamadas[llamadas.length - 1], tls: true, sni: opciones.hostname };
            return conexion;
        },
    };

    Reflect.set(globalThis, 'Deno', denoFalso);
    try {
        await cuerpo();
    } finally {
        Reflect.deleteProperty(globalThis, 'Deno');
    }

    return llamadas;
}

describe('safeFetch · cableado con el transporte fijado', () => {
    it('le pasa al transporte la dirección que pasó la validación, sin tocar el resto del init', async () => {
        let initCapturado: FetchInitLike | null = null;
        const fetchFalso: FetchLike = async (_url, init) => {
            initCapturado = init;
            return respuestaVacia();
        };

        await safeFetch('https://shop.example/producto', {
            fetchImpl: fetchFalso,
            resolveHost: async () => ['93.184.216.34'],
        });

        const init = initCapturado as unknown as FetchInitLike;
        // Lo nuevo: la IP validada viaja al transporte, que es lo que evita la segunda resolución.
        expect(init.address).toBe('93.184.216.34');
        // Lo de siempre: el resto del init es exactamente el mismo contrato.
        expect(init.redirect).toBe('manual');
        expect(init.signal).toBeInstanceOf(AbortSignal);
        expect(Object.keys(init).sort()).toEqual(['address', 'headers', 'redirect', 'signal']);
    });

    it('sigue funcionando con un doble de fetch que ignora la dirección', async () => {
        // La preservación del contrato: los dobles de los tests existentes no saben de `address` y
        // `safeFetch` tiene que devolver lo mismo que antes.
        const visitadas: string[] = [];
        const fetchFalso: FetchLike = async (url) => {
            visitadas.push(url);
            return url === 'https://shop.example/a'
                ? { status: 301, headers: { get: (n) => (n.toLowerCase() === 'location' ? '/b' : null) }, body: null }
                : respuestaVacia();
        };

        const resultado = await safeFetch('https://shop.example/a', { fetchImpl: fetchFalso });

        expect(visitadas).toEqual(['https://shop.example/a', 'https://shop.example/b']);
        expect(resultado).toEqual({
            ok: true,
            status: 200,
            finalUrl: 'https://shop.example/b',
            contentType: 'text/html',
            body: '',
            truncated: false,
        });
    });

    it('por defecto pide con el transporte propio, que conecta a la IP y negocia TLS con el nombre', async () => {
        // Prueba el cableado de producción sin red: se le pone un `Deno` de mentira a `globalThis` y
        // se llama a `safeFetch` sin `fetchImpl`, así que corre `pinnedFetch` de verdad.
        const conn = conexionConRespuesta(
            'HTTP/1.1 200 OK\r\nContent-Length: 11\r\nContent-Type: text/html\r\n\r\nHola mundo!'
        );

        let resultado: Awaited<ReturnType<typeof safeFetch>> | null = null;
        const conexiones = await conDenoFalso([conn], async () => {
            resultado = await safeFetch('https://shop.example/producto', {
                resolveHost: async () => ['93.184.216.34'],
            });
        });

        expect(resultado).toEqual({
            ok: true,
            status: 200,
            finalUrl: 'https://shop.example/producto',
            contentType: 'text/html',
            body: 'Hola mundo!',
            truncated: false,
        });
        expect(conexiones).toEqual([{ hostname: '93.184.216.34', port: 443, tls: true, sni: 'shop.example' }]);
        expect(conn.cerrada()).toBe(true);
    });

    it('sigue una redirección con cada salto fijado a su propia dirección validada', async () => {
        const primera = conexionConRespuesta(
            'HTTP/1.1 302 Found\r\nLocation: https://otra.example/b\r\nContent-Length: 0\r\n\r\n'
        );
        const segunda = conexionConRespuesta('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok');

        let resultado: Awaited<ReturnType<typeof safeFetch>> | null = null;
        const conexiones = await conDenoFalso([primera, segunda], async () => {
            resultado = await safeFetch('https://shop.example/a', {
                // El resolvedor contesta distinto por nombre: cada salto se fija a la suya.
                resolveHost: async (host) => (host === 'shop.example' ? ['93.184.216.34'] : ['93.184.216.35']),
            });
        });

        expect(resultado).toEqual({
            ok: true,
            status: 200,
            finalUrl: 'https://otra.example/b',
            contentType: null,
            body: 'ok',
            truncated: false,
        });
        expect(conexiones).toEqual([
            { hostname: '93.184.216.34', port: 443, tls: true, sni: 'shop.example' },
            { hostname: '93.184.216.35', port: 443, tls: true, sni: 'otra.example' },
        ]);
        expect(primera.cerrada()).toBe(true);
        expect(segunda.cerrada()).toBe(true);
    });

    it('mantiene el tope de bytes de safeFetch con el transporte propio: trunca, no falla', async () => {
        // El tope de negocio no se movió: lo sigue aplicando `safeFetch` sobre el `Response` real,
        // así que `truncated` sigue significando lo mismo con el cliente nuevo.
        const conn = conexionConRespuesta(
            'HTTP/1.1 200 OK\r\nContent-Length: 30\r\nContent-Type: text/html\r\n\r\n' + 'x'.repeat(30)
        );

        let resultado: Awaited<ReturnType<typeof safeFetch>> | null = null;
        await conDenoFalso([conn], async () => {
            resultado = await safeFetch('https://shop.example/producto', {
                resolveHost: async () => ['93.184.216.34'],
                maxBytes: 10,
            });
        });

        expect(resultado).toEqual({
            ok: true,
            status: 200,
            finalUrl: 'https://shop.example/producto',
            contentType: 'text/html',
            body: 'x'.repeat(10),
            truncated: true,
        });
        expect(conn.cerrada()).toBe(true);
    });
});

/* ------------------------------------------------------------------ *
 * Averías de la red, no caminos felices de framing
 * ------------------------------------------------------------------ */

/**
 * El refutador de la revisión encontró que estas tres se aceptaban en silencio: un cuerpo cortado
 * se entregaba como `ok:true` con `truncated:false`, y un sitio que manda `103 Early Hints`
 * tumbaba la petición entera. El `fetch` nativo rechaza las tres, así que el cliente tiene que
 * hacer lo mismo: si no, la extracción lee una página a medias como si estuviera completa.
 */
describe('pinnedFetch · averías de la red', () => {
    it('rechaza un cuerpo más corto que el Content-Length prometido', async () => {
        const conexion = conexionConRespuesta('HTTP/1.1 200 OK\r\nContent-Length: 50\r\n\r\nHola mundo!');
        const { abrir } = abridorFalso(conexion);

        const respuesta = await pinnedFetch('https://shop.example/', { headers: {}, address: '93.184.216.34', abrirConexion: abrir });

        // El cuerpo es un stream: el corte no se ve al abrir la respuesta sino al leerla, y ahí
        // tiene que tirar en vez de cerrarse como si el cuerpo hubiera terminado.
        await expect(respuesta.text()).rejects.toThrow(/cuerpo/);
    });

    it('no devuelve ok a través de safeFetch cuando el cuerpo llegó cortado', async () => {
        const conexion = conexionConRespuesta('HTTP/1.1 200 OK\r\nContent-Length: 50\r\n\r\nHola mundo!');
        const { abrir } = abridorFalso(conexion);

        const resultado = await safeFetch('https://shop.example/', {
            resolveHost: async () => ['93.184.216.34'],
            fetchImpl: (url, init) => pinnedFetch(url, { ...init, abrirConexion: abrir }),
        });

        expect(resultado.ok).toBe(false);
    });

    it('rechaza un chunked cortado a mitad de chunk', async () => {
        // El chunk declara 11 bytes y llegan 8: la conexión se cerró en medio del cuerpo.
        const conexion = conexionConRespuesta('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nb\r\nHola mun');
        const { abrir } = abridorFalso(conexion);

        const respuesta = await pinnedFetch('https://shop.example/', { headers: {}, address: '93.184.216.34', abrirConexion: abrir });

        await expect(respuesta.text()).rejects.toThrow(/cuerpo/);
    });

    it('rechaza un chunked cortado antes del CRLF que cierra el último chunk', async () => {
        // El chunk está completo (`b` = 11 bytes) pero falta el CRLF que lo cierra y el chunk `0`.
        const conexion = conexionConRespuesta('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nb\r\nHola mundo!');
        const { abrir } = abridorFalso(conexion);

        const respuesta = await pinnedFetch('https://shop.example/', { headers: {}, address: '93.184.216.34', abrirConexion: abrir });

        await expect(respuesta.text()).rejects.toThrow(/cuerpo/);
    });

    it('saltea una respuesta interina 103 y devuelve la final', async () => {
        const conexion = conexionConRespuesta(
            'HTTP/1.1 103 Early Hints\r\nLink: </estilo.css>; rel=preload\r\n\r\n' + OK_CON_LONGITUD
        );
        const { abrir } = abridorFalso(conexion);

        const respuesta = await pinnedFetch('https://shop.example/', { headers: {}, address: '93.184.216.34', abrirConexion: abrir });

        expect(respuesta.status).toBe(200);
        await expect(respuesta.text()).resolves.toBe('Hola mundo!');
    });

    it('corta un servidor que encadena respuestas 1xx sin llegar nunca a la final', async () => {
        const interina = bytes('HTTP/1.1 103 Early Hints\r\n\r\n');
        const conexion = crearConexionFalsa(() => interina);
        const { abrir } = abridorFalso(conexion);

        await expect(
            pinnedFetch('https://shop.example/', { headers: {}, address: '93.184.216.34', abrirConexion: abrir })
        ).rejects.toThrow(/intermedias/);
    });

    it('prueba todas las direcciones validadas antes de darse por vencido', async () => {
        const intentos: (string | undefined)[] = [];

        const resultado = await safeFetch('https://shop.example/', {
            resolveHost: async () => ['93.184.216.34', '93.184.216.35'],
            fetchImpl: async (_url, init) => {
                intentos.push(init?.address);
                throw new Error('sin ruta');
            },
        });

        expect(resultado.ok).toBe(false);
        expect(intentos).toEqual(['93.184.216.34', '93.184.216.35']);
    });
});
