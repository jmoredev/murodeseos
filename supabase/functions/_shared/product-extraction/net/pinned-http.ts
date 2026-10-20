/**
 * Transporte HTTP/1.1 propio, con el socket **fijado a la dirección ya validada**.
 *
 * Es la pieza que cierra el DNS rebinding: `fetch` recibe una URL y resuelve el nombre por su
 * cuenta, así que un DNS hostil puede contestar público a la guarda y privado al socket. Acá se
 * conecta a la IP que pasó la guarda (`Deno.connect`) y el **nombre real** se usa solo para el SNI
 * y la validación del certificado (`Deno.startTls`). El nombre no se resuelve nunca más, así que
 * no queda ventana entre la validación y la conexión.
 *
 * Se escribe a mano porque `fetch` de Deno no acepta ni una IP fijada ni un dialer. Lo que se
 * implementa es lo mínimo que la capa de red necesita, no un cliente HTTP completo:
 *
 * - **Petición**: `GET` con `Host`, `Connection: close` y `accept-encoding: identity`. Lo último no
 *   es cosmética: `headers.ts` no manda `accept-encoding`, así que con `fetch` negociaba
 *   compresión y la descomprimía solo. Acá el cuerpo tiene que llegar en claro o el detector de
 *   precios lee gzip.
 * - **Respuesta**: se devuelve un `Response` **real**, no un objeto con la misma forma, para que
 *   `safeFetch` siga leyendo `headers.get('location')`, `content-type` y el cuerpo tal cual, con
 *   `.body` en streaming.
 * - **Cuerpo**: `content-length`, `transfer-encoding: chunked` (con chunk final y trailers) o
 *   lectura hasta el fin de la conexión (`Connection: close` la hace segura).
 * - **Siempre se cierra el socket**: en el camino feliz el `ReadableStream` se hace cargo y lo
 *   cierra al terminar, al cancelarse o al abortarse; cualquier fallo anterior pasa por el
 *   `finally`.
 *
 * El tope de bytes de negocio (el que marca `truncated`) sigue viviendo en `safe-fetch.ts`, que es
 * el que consume el cuerpo. Acá hay un `maxBytes` opcional que solo sirve de backstop para otro
 * llamador; por defecto no se aplica, porque cortar el cuerpo en el transporte dejaría al
 * consumidor sin forma de distinguir «el cuerpo terminó» de «el cuerpo se cortó».
 */

/** Lo mínimo de una conexión de bytes: lo que `Deno.TcpConn` y `Deno.TlsConn` ya cumplen. */
export type ConexionHttp = {
    read(destino: Uint8Array): Promise<number | null>;
    write(datos: Uint8Array): Promise<number>;
    close(): void;
};

/**
 * Parámetros de apertura. `hostname` es el **destino del socket** (la IP validada), mientras que
 * `sni` es el **nombre real** del sitio: separarlos es todo el punto de este módulo.
 */
export type ParametrosConexion = {
    hostname: string;
    port: number;
    tls: boolean;
    sni: string;
    /** Aborto de la petición: permite cortar un saludo TLS que no termina nunca. */
    signal?: AbortSignal;
};

/** Apertura de conexión inyectable. Los tests la reemplazan por una conexión en memoria. */
export type AbrirConexion = (parametros: ParametrosConexion) => Promise<ConexionHttp>;

export type PinnedHttpInit = {
    headers: Record<string, string>;
    signal?: AbortSignal;
    /** Dirección ya validada por la guarda. Sin ella se conecta al hostname (comportamiento previo). */
    address?: string;
    /** Backstop opcional de bytes del cuerpo. Ver el comentario de cabecera. */
    maxBytes?: number;
    /** Solo para tests: conexión en memoria en vez de `Deno.connect` + `Deno.startTls`. */
    abrirConexion?: AbrirConexion;
};

/** Tope de las cabeceras de respuesta: más que eso es basura o abuso, no una página. */
const MAX_HEADER_BYTES = 64 * 1024;

/** Tamaño de lectura del socket. Chico a propósito: el cuerpo se entrega en streaming. */
const TAMANO_DE_LECTURA = 16 * 1024;

/** Cabeceras que fija el transporte; el llamador no las puede pisar. */
const CABECERAS_RESERVADAS = new Set(['host', 'connection', 'accept-encoding', 'content-length', 'transfer-encoding']);

const CODIFICADOR = new TextEncoder();
const DECODIFICADOR = new TextDecoder();

/**
 * Lo mínimo de `Deno` que se usa, tipado acá: el `tsc` del proyecto corre con los tipos de DOM y
 * no trae los de Deno, y una dependencia de tipos solo por esto no se justifica.
 */
type DenoMinimo = {
    connect(opciones: { hostname: string; port: number }): Promise<ConexionHttp>;
    startTls(conexion: ConexionHttp, opciones: { hostname: string }): Promise<ConexionHttp>;
};

/** Apertura real: el socket va a la IP y el TLS se negocia con el nombre real. */
const abrirConexionPorDefecto: AbrirConexion = async ({ hostname, port, tls, sni, signal }) => {
    const deno = (globalThis as unknown as { Deno?: DenoMinimo }).Deno;
    if (!deno) throw new Error('Deno.connect no está disponible en este runtime');

    const conexion = await deno.connect({ hostname, port });
    if (!tls) return conexion;

    // El aborto pudo llegar mientras se conectaba: el TCP ya no se usa.
    if (signal?.aborted) {
        conexion.close();
        throw errorDeAborto();
    }

    // `Deno.startTls` no acepta la señal: si el aborto llega durante el saludo, la única forma de
    // cortarlo es cerrar el TCP, o el socket queda abierto hasta que Deno lo corte por su cuenta.
    let negociado = false;
    const alAbortar = () => {
        if (!negociado) conexion.close();
    };
    signal?.addEventListener('abort', alAbortar, { once: true });

    try {
        // SNI y certificado contra el nombre de la tienda, aunque el socket haya ido a la IP.
        const seguro = await deno.startTls(conexion, { hostname: sni });
        negociado = true;
        return seguro;
    } catch (error) {
        // Un TLS fallido deja el socket TCP abierto si no se cierra acá.
        conexion.close();
        throw error;
    } finally {
        signal?.removeEventListener('abort', alAbortar);
    }
};

/** Un servidor que encadena más de esto no está negociando: está colgado. */
const MAX_RESPUESTAS_INTERINAS = 5;

/**
 * Un cuerpo que termina antes de lo prometido no es un final: es un corte. Se tira para que
 * `safeFetch` lo traduzca a un fallo, en vez de devolver `ok:true` con media página.
 */
function cuerpoTruncado(): Error {
    return new Error('el cuerpo se cortó antes de terminar');
}

/**
 * Pide una URL conectando a `init.address`. Devuelve un `Response` real; tira en cualquier fallo de
 * red, igual que `fetch`, y el llamador (`safeFetch`) traduce el tiro a un motivo.
 */
export async function pinnedFetch(url: string, init: PinnedHttpInit): Promise<Response> {
    const destino = new URL(url);
    const tls = destino.protocol === 'https:';
    const puerto = destino.port === '' ? (tls ? 443 : 80) : Number(destino.port);
    const nombre = sinCorchetes(destino.hostname);
    // El socket va a la IP validada; sin dirección validada no hay nada que fijar y se usa el
    // nombre (mismo comportamiento que el `fetch` de antes).
    const objetivo = init.address ? sinCorchetes(init.address) : nombre;
    const signal = init.signal;

    if (signal?.aborted) throw errorDeAborto();

    const abrir = init.abrirConexion ?? abrirConexionPorDefecto;
    let cierre: { cerrar(): void } | null = null;
    let cedido = false;

    try {
        // `abrir` no se puede cancelar. Si el aborto gana la carrera, la conexión puede llegar
        // cuando ya nadie la espera: se cierra al llegar, o queda un socket filtrado por cada
        // intento que se pasa de tiempo.
        const apertura = abrir({ hostname: objetivo, port: puerto, tls, sni: nombre, signal });
        let conexion: ConexionHttp;
        try {
            conexion = await conAborto(apertura, signal);
        } catch (error) {
            apertura.then((tardia) => tardia.close()).catch(() => {});
            throw error;
        }
        cierre = crearCierre(conexion, signal);

        await conAborto(escribirTodo(conexion, construirPeticion(destino, init.headers)), signal);

        const fuente = crearFuente(conexion, signal);

        // Una respuesta 1xx (103 Early Hints) es interina: la final viene detrás, en la misma
        // conexión. No se puede devolver tal cual porque `Response` sólo acepta 200-599, así que
        // se saltea y se lee la siguiente. El tope corta a un servidor que encadena 1xx.
        let respuesta = parsearRespuesta(await leerCabeceras(fuente));
        for (let interinas = 0; respuesta.status >= 100 && respuesta.status < 200; interinas += 1) {
            if (interinas >= MAX_RESPUESTAS_INTERINAS) throw new Error('demasiadas respuestas intermedias');
            respuesta = parsearRespuesta(await leerCabeceras(fuente));
        }

        const { status, statusText, headers } = respuesta;

        // 204, 205 y 304 no llevan cuerpo, y `new Response` tira si se le pasa uno.
        if (status === 204 || status === 205 || status === 304) {
            return new Response(null, { status, statusText, headers });
        }

        const cuerpo = crearCuerpo(crearMarco(headers, fuente), {
            maxBytes: init.maxBytes,
            cerrar: cierre.cerrar,
        });

        // Se arma la respuesta **antes** de declarar el socket cedido: si el constructor tira
        // (un estado que exige cuerpo nulo, por ejemplo) el `finally` todavía puede cerrarlo.
        const respuestaFinal = new Response(cuerpo, { status, statusText, headers });

        // A partir de acá el `ReadableStream` es dueño del socket: lo cierra al terminar, al
        // cancelarse o al abortarse la señal.
        cedido = true;
        return respuestaFinal;
    } finally {
        // Cubre todos los caminos que no llegan a entregar el cuerpo (conexión, escritura,
        // cabeceras ilegibles): sin esto un fallo de parseo dejaría el socket abierto.
        if (!cedido) cierre?.cerrar();
    }
}

/* ------------------------------------------------------------------ *
 * Petición
 * ------------------------------------------------------------------ */

function construirPeticion(url: URL, cabeceras: Record<string, string>): Uint8Array {
    const lineas = [
        `GET ${url.pathname}${url.search} HTTP/1.1`,
        // El `Host` lleva el nombre original (con puerto solo si no es el de defecto), no la IP:
        // los servidores virtuales de las tiendas eligen el sitio por este header.
        `Host: ${url.hostname}${url.port === '' ? '' : `:${url.port}`}`,
        'Connection: close',
        // Sin esto el servidor puede contestar gzip y el cuerpo llegaría comprimido.
        'accept-encoding: identity',
    ];

    for (const [nombre, valor] of Object.entries(cabeceras)) {
        if (CABECERAS_RESERVADAS.has(nombre.toLowerCase())) continue;
        // Un salto de línea en un valor permitiría inyectar cabeceras: se descarta.
        lineas.push(`${nombre}: ${valor.replace(/[\r\n]/g, '')}`);
    }

    return CODIFICADOR.encode(`${lineas.join('\r\n')}\r\n\r\n`);
}

async function escribirTodo(conexion: ConexionHttp, datos: Uint8Array): Promise<void> {
    let enviados = 0;
    while (enviados < datos.length) {
        const escritos = await conexion.write(datos.subarray(enviados));
        if (escritos <= 0) throw new Error('la conexión no aceptó la petición');
        enviados += escritos;
    }
}

/* ------------------------------------------------------------------ *
 * Respuesta: cabeceras
 * ------------------------------------------------------------------ */

async function leerCabeceras(fuente: Fuente): Promise<string> {
    for (;;) {
        const disponibles = fuente.disponibles();
        const fin = buscarFinDeCabeceras(disponibles);
        if (fin) {
            const bloque = disponibles.subarray(0, fin.inicio);
            fuente.consumir(fin.inicio + fin.largo);
            return DECODIFICADOR.decode(bloque);
        }
        if (disponibles.length > MAX_HEADER_BYTES) throw new Error('cabeceras de respuesta demasiado grandes');
        if (!(await fuente.rellenar())) throw new Error('la conexión se cerró antes de las cabeceras');
    }
}

/** Busca el terminador del bloque de cabeceras: `CRLFCRLF` (o `LFLF` de un servidor vago). */
function buscarFinDeCabeceras(datos: Uint8Array): { inicio: number; largo: number } | null {
    for (let i = 0; i < datos.length; i += 1) {
        if (datos[i] !== 10) continue;

        if (datos[i + 1] === 10) return { inicio: i, largo: 2 };

        if (datos[i + 1] === 13 && datos[i + 2] === 10) {
            // El bloque termina antes del CR que abre el terminador, no antes del LF.
            const inicio = datos[i - 1] === 13 ? i - 1 : i;
            return { inicio, largo: i - inicio + 3 };
        }
    }
    return null;
}

function parsearRespuesta(bloque: string): { status: number; statusText: string; headers: Headers } {
    const lineas = bloque.replace(/\r\n/g, '\n').split('\n');
    const estado = /^HTTP\/\d(?:\.\d)?[ \t]+(\d{3})(?:[ \t]+(.*))?$/.exec(lineas[0].trim());
    if (!estado) throw new Error(`línea de estado ilegible: ${JSON.stringify(lineas[0].slice(0, 80))}`);

    const status = Number(estado[1]);
    const statusText = limpiarMotivo(estado[2] ?? '');
    const headers = new Headers();

    for (const linea of lineas.slice(1)) {
        if (linea === '') continue;
        const separador = linea.indexOf(':');
        // Una línea sin `:` no es una cabecera; se ignora en vez de tirar la respuesta entera.
        if (separador <= 0) continue;

        const nombre = linea.slice(0, separador).trim();
        if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(nombre)) continue;
        headers.append(nombre, linea.slice(separador + 1).trim());
    }

    return { status, statusText, headers };
}

/**
 * El `statusText` de `new Response` no admite caracteres de control, y lo que llega es de un
 * servidor remoto: se descarta lo que no sea ASCII imprimible en vez de dejar que tire.
 */
function limpiarMotivo(motivo: string): string {
    return motivo.replace(/[^\t\x20-\x7e]/g, '').trim();
}

/* ------------------------------------------------------------------ *
 * Respuesta: cuerpo
 * ------------------------------------------------------------------ */

/** Marco del cuerpo: `siguiente` devuelve el próximo trozo, o `null` cuando el cuerpo terminó. */
type Marco = { siguiente(): Promise<Uint8Array | null> };

function crearMarco(cabeceras: Headers, fuente: Fuente): Marco {
    const codificacion = (cabeceras.get('transfer-encoding') ?? '').toLowerCase();
    if (codificacion.includes('chunked')) return marcoChunked(fuente);

    const longitud = cabeceras.get('content-length');
    if (longitud !== null) {
        const total = Number.parseInt(longitud.trim(), 10);
        if (Number.isFinite(total) && total >= 0) return marcoPorLongitud(fuente, total);
    }

    // `Connection: close` hace seguro leer hasta el fin.
    return marcoHastaFin(fuente);
}

function marcoPorLongitud(fuente: Fuente, total: number): Marco {
    let restante = total;
    return {
        async siguiente() {
            if (restante <= 0) return null;
            // El `fetch` nativo rechaza un cuerpo más corto que su Content-Length; aceptarlo acá
            // sería entregar una página a medias como si estuviera entera.
            if (fuente.disponibles().length === 0 && !(await fuente.rellenar())) throw cuerpoTruncado();

            const disponibles = fuente.disponibles();
            const cuantos = Math.min(restante, disponibles.length);
            if (cuantos === 0) throw cuerpoTruncado();

            restante -= cuantos;
            return fuente.consumir(cuantos);
        },
    };
}

function marcoHastaFin(fuente: Fuente): Marco {
    return {
        async siguiente() {
            if (fuente.disponibles().length === 0 && !(await fuente.rellenar())) return null;
            return fuente.consumir(fuente.disponibles().length);
        },
    };
}

/**
 * Decodificador de `chunked`: tamaño en hexadecimal, datos, CRLF, y al final el chunk `0` con sus
 * trailers opcionales. Se lee en streaming, así que un cuerpo enorme no se acumula en memoria.
 */
function marcoChunked(fuente: Fuente): Marco {
    let estado: 'tamano' | 'datos' | 'fin-de-datos' | 'trailers' | 'fin' = 'tamano';
    let restante = 0;

    return {
        async siguiente() {
            for (;;) {
                if (estado === 'fin') return null;

                if (estado === 'datos') {
                    if (restante === 0) {
                        estado = 'fin-de-datos';
                        continue;
                    }
                    // Cortarse en medio de los datos de un chunk es un corte, no el final del cuerpo.
                    if (fuente.disponibles().length === 0 && !(await fuente.rellenar())) throw cuerpoTruncado();
                    const disponibles = fuente.disponibles();
                    const cuantos = Math.min(restante, disponibles.length);
                    if (cuantos === 0) throw cuerpoTruncado();
                    restante -= cuantos;
                    return fuente.consumir(cuantos);
                }

                if (estado === 'fin-de-datos') {
                    // El CRLF que cierra los datos del chunk: sin él el chunk quedó a medias.
                    if ((await leerLinea(fuente)) === null) throw cuerpoTruncado();
                    estado = 'tamano';
                    continue;
                }

                if (estado === 'trailers') {
                    const trailer = await leerLinea(fuente);
                    // La línea vacía sí termina el cuerpo; un EOF antes de completarla, no.
                    if (trailer === '') {
                        estado = 'fin';
                        return null;
                    }
                    if (trailer === null) throw cuerpoTruncado();
                    continue;
                }

                const linea = await leerLinea(fuente);
                if (linea === null) throw cuerpoTruncado();

                // El tamaño puede traer extensiones después de `;` (`1a;nombre=valor`).
                const tamano = Number.parseInt(linea.split(';')[0].trim(), 16);
                if (!Number.isFinite(tamano) || tamano < 0) throw new Error(`chunk ilegible: ${linea.slice(0, 80)}`);

                if (tamano === 0) {
                    estado = 'trailers';
                    continue;
                }

                restante = tamano;
                estado = 'datos';
            }
        },
    };
}

/** Lee una línea terminada en CRLF (o LF). `null` si la conexión se cerró antes. */
async function leerLinea(fuente: Fuente): Promise<string | null> {
    for (;;) {
        const disponibles = fuente.disponibles();
        const salto = disponibles.indexOf(10);
        if (salto >= 0) {
            const linea = disponibles.subarray(0, salto);
            fuente.consumir(salto + 1);
            return DECODIFICADOR.decode(linea).replace(/\r$/, '');
        }

        if (disponibles.length > MAX_HEADER_BYTES) throw new Error('línea de respuesta demasiado larga');
        if (!(await fuente.rellenar())) {
            if (disponibles.length === 0) return null;
            // Última línea sin terminador: se entrega lo que hay.
            const resto = fuente.consumir(disponibles.length);
            return DECODIFICADOR.decode(resto);
        }
    }
}

/**
 * `ReadableStream` sobre el marco del cuerpo. `pull` lee un trozo por pedido del consumidor, así
 * que la memoria no depende de lo que mande el servidor: el que no lee, no acumula.
 */
function crearCuerpo(marco: Marco, opciones: { maxBytes?: number; cerrar(): void }): ReadableStream<Uint8Array> {
    const { maxBytes, cerrar } = opciones;
    let entregados = 0;

    return new ReadableStream<Uint8Array>({
        async pull(controlador) {
            try {
                for (;;) {
                    const trozo = await marco.siguiente();
                    if (trozo === null) {
                        cerrar();
                        controlador.close();
                        return;
                    }
                    if (trozo.length === 0) continue;

                    if (maxBytes !== undefined) {
                        const quedan = maxBytes - entregados;
                        if (trozo.length >= quedan) {
                            if (quedan > 0) controlador.enqueue(trozo.subarray(0, quedan));
                            entregados = maxBytes;
                            cerrar();
                            controlador.close();
                            return;
                        }
                        entregados += trozo.length;
                    }

                    controlador.enqueue(trozo);
                    return;
                }
            } catch (error) {
                // Cualquier fallo de lectura cierra el socket antes de propagar: el consumidor ve
                // el rechazo, no un socket colgado.
                cerrar();
                controlador.error(error);
            }
        },
        cancel() {
            cerrar();
        },
    });
}

/* ------------------------------------------------------------------ *
 * Fuente de bytes y cierre
 * ------------------------------------------------------------------ */

type Fuente = {
    disponibles(): Uint8Array;
    consumir(cuantos: number): Uint8Array;
    /** Lee más del socket. `false` cuando la conexión terminó. */
    rellenar(): Promise<boolean>;
};

function crearFuente(conexion: ConexionHttp, signal?: AbortSignal): Fuente {
    let pendiente: Uint8Array = new Uint8Array(0);
    let terminada = false;

    return {
        disponibles() {
            return pendiente;
        },
        consumir(cuantos) {
            const tomado = pendiente.subarray(0, cuantos);
            pendiente = pendiente.subarray(cuantos);
            return tomado;
        },
        async rellenar() {
            if (terminada) return false;

            const destino = new Uint8Array(TAMANO_DE_LECTURA);
            const leidos = await conAborto(conexion.read(destino), signal);
            // `Deno` devuelve `null` al final de la conexión; un 0 se trata igual para no girar
            // en vacío contra un servidor que no avanza.
            if (leidos === null || leidos <= 0) {
                terminada = true;
                return false;
            }

            pendiente = concatenar(pendiente, destino.subarray(0, leidos));
            return true;
        },
    };
}

/**
 * Cierre idempotente del socket, con el aborto como red de seguridad: si el consumidor nunca lee el
 * cuerpo y nadie lo cancela, el `AbortSignal` del presupuesto de tiempo igual lo cierra.
 */
function crearCierre(conexion: ConexionHttp, signal?: AbortSignal): { cerrar(): void } {
    let cerrada = false;

    const cerrar = () => {
        if (cerrada) return;
        cerrada = true;
        signal?.removeEventListener('abort', cerrar);
        try {
            conexion.close();
        } catch {
            // Ya estaba cerrada (o el runtime la dio por muerta): cerrar es idempotente.
        }
    };

    signal?.addEventListener('abort', cerrar, { once: true });
    return { cerrar };
}

/* ------------------------------------------------------------------ *
 * Utilidades
 * ------------------------------------------------------------------ */

function concatenar(a: Uint8Array, b: Uint8Array): Uint8Array {
    if (a.length === 0) return b;
    const unido = new Uint8Array(a.length + b.length);
    unido.set(a, 0);
    unido.set(b, a.length);
    return unido;
}

function sinCorchetes(host: string): string {
    return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function errorDeAborto(): DOMException {
    return new DOMException('Aborted', 'AbortError');
}

/** Carrera entre una promesa cualquiera y el aborto: abortar tiene que cortar la espera. */
function conAborto<T>(promesa: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promesa;
    if (signal.aborted) return Promise.reject(errorDeAborto());

    return new Promise<T>((resolve, reject) => {
        const alAbortar = () => reject(errorDeAborto());
        signal.addEventListener('abort', alAbortar, { once: true });
        promesa.then(
            (valor) => {
                signal.removeEventListener('abort', alAbortar);
                resolve(valor);
            },
            (error: unknown) => {
                signal.removeEventListener('abort', alAbortar);
                reject(error);
            }
        );
    });
}
