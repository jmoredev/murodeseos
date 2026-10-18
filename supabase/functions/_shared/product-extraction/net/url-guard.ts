/**
 * Guarda SSRF de URLs: **pura, síncrona, sin DNS y sin E/S**.
 *
 * Todo lo que se pueda decidir mirando solo el texto de la URL se decide acá, y se devuelve
 * como resultado discriminado (`{ ok: true, url }` / `{ ok: false, reason }`), nunca tirando.
 * La URL `ok` es la forma **normalizada** por el parser (`URL.href`), que ya baja a minúsculas
 * el host, resuelve el punycode y canoniza las formas raras de IPv4 (`127.1`, `0x7f.1`,
 * `2130706433` → `127.0.0.1`).
 *
 * Lo que **no** cubre este módulo, a propósito: DNS. Un nombre público que resuelve a una
 * dirección privada no se puede detectar sin resolver, y resolver es E/S asíncrona. Eso vive
 * en `safe-fetch.ts` mediante el `resolveHost` inyectable, que en T5 será `Deno.resolveDns`.
 *
 * El vocabulario de `reason` es estable y en inglés kebab-case, igual que los `failure` del
 * manifiesto de fixtures: `scheme-not-allowed`, `credentials-not-allowed`, `port-not-allowed`,
 * `url-too-long`, `hostname-too-long`, `blocked-hostname` y `blocked-ip-<rango>`. Quien lee un
 * log tiene que poder distinguir «bloqueamos a un usuario» de «el destino estaba roto».
 */

/** Rangos de IP que no pueden ser una tienda. El nombre viaja dentro de `reason`. */
export type BlockedIpRange =
    | 'loopback'
    | 'private'
    | 'link-local'
    | 'unique-local'
    | 'carrier-grade-nat'
    | 'multicast'
    | 'unspecified'
    | 'reserved';

/** Motivos por los que `guardUrl` rechaza una URL. Cada uno nombra la regla que disparó. */
export type GuardReason =
    | 'invalid-url'
    | 'scheme-not-allowed'
    | 'credentials-not-allowed'
    | 'port-not-allowed'
    | 'url-too-long'
    | 'hostname-too-long'
    | 'blocked-hostname'
    | `blocked-ip-${BlockedIpRange}`;

export type GuardResult = { ok: true; url: string } | { ok: false; reason: GuardReason };

/**
 * Tope de la URL entera. 4 KB es muy por encima de cualquier URL de producto real (la más
 * larga de los fixtures ronda los 120 caracteres) y muy por debajo de lo que hace falta para
 * un ataque de longitud. Es un tope de cordura, no una regla de negocio.
 */
export const MAX_URL_LENGTH = 4096;

/**
 * Tope del hostname: 253 caracteres, el máximo de un nombre DNS sin el punto final. Un
 * hostname más largo no puede resolver, así que es basura o abuso.
 */
export const MAX_HOSTNAME_LENGTH = 253;

/**
 * Decide si una URL se puede pedir. Devuelve la URL normalizada o el motivo del rechazo.
 *
 * Orden de las reglas: parseo → esquema → credenciales → puerto → longitudes → hostname
 * reservado → IP. Solo importa cuando una misma entrada dispara dos reglas a la vez; cada
 * regla tiene su test con una entrada de una sola falla.
 */
export function guardUrl(rawUrl: unknown): GuardResult {
    const url = parsear(rawUrl);
    if (!url) return { ok: false, reason: 'invalid-url' };

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { ok: false, reason: 'scheme-not-allowed' };
    }

    // `https://usuario:secreto@shop.example/`: las credenciales viajan a un tercero y permiten
    // confundir el host real (`https://trusted.example@evil.example`). Ninguna tienda las pide.
    if (url.username !== '' || url.password !== '') {
        return { ok: false, reason: 'credentials-not-allowed' };
    }

    // Decisión: solo 80/443. Una tienda comparte en los puertos estándar de la web; cualquier
    // otro puerto es un pivote clásico a servicios internos (8080, 8443, 22, 5432…) y no
    // aporta ningún caso de uso real. El parser ya normaliza 80/443 a `''`, y acá se aceptan
    // también explícitos por si el esquema no coincide con el puerto.
    if (url.port !== '' && url.port !== '80' && url.port !== '443') {
        return { ok: false, reason: 'port-not-allowed' };
    }

    if (url.href.length > MAX_URL_LENGTH) {
        return { ok: false, reason: 'url-too-long' };
    }

    const host = hostnameDe(url);
    if (host.length > MAX_HOSTNAME_LENGTH) {
        return { ok: false, reason: 'hostname-too-long' };
    }

    if (esHostnameReservado(host)) {
        return { ok: false, reason: 'blocked-hostname' };
    }

    const ip = blockedIpReason(host);
    if (ip) return { ok: false, reason: ip };

    return { ok: true, url: url.href };
}

/**
 * Clasifica una dirección IP (con o sin corchetes de IPv6) contra los rangos que nunca son
 * una tienda. Devuelve el `reason` correspondiente o `null` si la dirección es utilizable (o
 * si el texto no es una IP).
 *
 * La usa `safe-fetch.ts` sobre cada dirección que devuelve el resolvedor: un nombre público
 * puede resolver a `10.0.0.1`, y eso es exactamente el SSRF basado en DNS que la guarda de
 * texto no ve.
 */
export function blockedIpReason(host: string): GuardReason | null {
    const normalizada = quitarCorchetes(host);

    const ipv4 = parsearIpv4(normalizada);
    if (ipv4 !== null) {
        const rango = rangoDeIpv4(ipv4);
        return rango ? `blocked-ip-${rango}` : null;
    }

    const grupos = parsearIpv6(normalizada);
    if (grupos === null) return null;

    if (grupos.every((grupo) => grupo === 0)) return 'blocked-ip-unspecified';
    if (grupos.slice(0, 7).every((grupo) => grupo === 0) && grupos[7] === 1) return 'blocked-ip-loopback';
    if ((grupos[0] & 0xffc0) === 0xfe80) return 'blocked-ip-link-local'; // fe80::/10
    if ((grupos[0] & 0xfe00) === 0xfc00) return 'blocked-ip-unique-local'; // fc00::/7
    if ((grupos[0] & 0xff00) === 0xff00) return 'blocked-ip-multicast'; // ff00::/8

    // Formas que **llevan una IPv4 adentro**: se clasifica la IPv4 embebida, así que el motivo
    // nombra el rango que de verdad es. Va después de los rangos propios de IPv6 para que `::`
    // siga siendo «unspecified» y `::1` siga siendo «loopback», como dicen sus tests.
    for (const embebida of ipv4Embebidas(grupos)) {
        const rango = rangoDeIpv4(embebida);
        if (rango) return `blocked-ip-${rango}`;
    }

    return null;
}

/**
 * Todas las IPv4 que una dirección IPv6 puede estar representando, según su forma.
 *
 * **No** es una lista de formas prohibidas: es la lista de formas **con IPv4 embebida**, y la IPv4
 * de adentro se clasifica con las reglas de siempre. La diferencia importa: bloquear la forma
 * entera dejaría inalcanzable una tienda servida por NAT64 en una red IPv6-only.
 *
 * La encontró el **verificador independiente de T4**: la guarda solo miraba `::ffff:a.b.c.d`, así
 * que `http://[64:ff9b::a9fe:a9fe]/latest/meta-data/` (NAT64) llegaba a la dirección de metadatos,
 * que es el bypass clásico de una guarda de SSRF. En Teredo hay **dos** candidatas, porque la IPv4
 * del cliente viaja invertida bit a bit en los dos últimos hextets.
 */
function ipv4Embebidas(grupos: number[]): number[] {
    const ultima = ((grupos[6] << 16) | grupos[7]) >>> 0;
    const ceros = (desde: number, hasta: number): boolean => {
        for (let i = desde; i <= hasta; i++) if (grupos[i] !== 0) return false;
        return true;
    };
    const embebidas: number[] = [];

    // ::ffff:a.b.c.d (IPv4 mapeada) y ::ffff:0:a.b.c.d (IPv4 traducida, RFC 6145)
    if (ceros(0, 4) && grupos[5] === 0xffff) embebidas.push(ultima);
    if (ceros(0, 3) && grupos[4] === 0xffff && grupos[5] === 0) embebidas.push(ultima);
    // ::a.b.c.d (IPv4 compatible, obsoleta). `::` y `::1` ya salieron con su propio motivo.
    if (ceros(0, 5)) embebidas.push(ultima);
    // 64:ff9b::/96 (NAT64, RFC 6052) y 64:ff9b:1::/48 (RFC 8215)
    if (grupos[0] === 0x0064 && grupos[1] === 0xff9b) embebidas.push(ultima);
    // 2002::/16 (6to4): la IPv4 en los grupos 1 y 2
    if (grupos[0] === 0x2002) embebidas.push(((grupos[1] << 16) | grupos[2]) >>> 0);
    // 2001:0::/32 (Teredo): el servidor en los grupos 2 y 3, el cliente invertido en los últimos
    if (grupos[0] === 0x2001 && grupos[1] === 0) {
        embebidas.push(((grupos[2] << 16) | grupos[3]) >>> 0);
        embebidas.push(~ultima >>> 0);
    }

    return embebidas;
}

/** `true` si `host` es un literal IPv4 o IPv6 (con o sin corchetes), no un nombre DNS. */
export function isIpLiteral(host: string): boolean {
    const normalizada = quitarCorchetes(host);
    return parsearIpv4(normalizada) !== null || parsearIpv6(normalizada) !== null;
}

/* ------------------------------------------------------------------ *
 * Parseo
 * ------------------------------------------------------------------ */

function parsear(rawUrl: unknown): URL | null {
    try {
        if (rawUrl instanceof URL) return new URL(rawUrl.href);
        if (typeof rawUrl !== 'string') return null;
        return new URL(rawUrl);
    } catch {
        return null;
    }
}

/** Host en minúsculas, sin corchetes de IPv6 y sin el punto final del FQDN. */
function hostnameDe(url: URL): string {
    return quitarPuntoFinal(quitarCorchetes(url.hostname)).toLowerCase();
}

function quitarCorchetes(host: string): string {
    return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function quitarPuntoFinal(host: string): string {
    return host.endsWith('.') ? host.slice(0, -1) : host;
}

/* ------------------------------------------------------------------ *
 * Hostnames reservados
 * ------------------------------------------------------------------ */

function esHostnameReservado(host: string): boolean {
    return (
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        host === 'metadata.google.internal'
    );
}

/* ------------------------------------------------------------------ *
 * IPv4
 * ------------------------------------------------------------------ */

function parsearIpv4(texto: string): number | null {
    const partes = texto.split('.');
    if (partes.length !== 4) return null;

    let valor = 0;
    for (const parte of partes) {
        if (!/^\d{1,3}$/.test(parte)) return null;
        const octeto = Number(parte);
        if (octeto > 255) return null;
        valor = (valor << 8) | octeto;
    }
    return valor >>> 0;
}

function rangoDeIpv4(valor: number): BlockedIpRange | null {
    const a = (valor >>> 24) & 0xff;
    const b = (valor >>> 16) & 0xff;

    if (valor === 0) return 'unspecified';
    if (a === 127) return 'loopback';
    if (a === 10) return 'private';
    if (a === 172 && b >= 16 && b <= 31) return 'private';
    if (a === 192 && b === 168) return 'private';
    if (a === 169 && b === 254) return 'link-local';
    if (a === 100 && b >= 64 && b <= 127) return 'carrier-grade-nat';
    if (a >= 224 && a <= 239) return 'multicast';
    if (a >= 240) return 'reserved';
    return null;
}

/* ------------------------------------------------------------------ *
 * IPv6
 * ------------------------------------------------------------------ */

/**
 * Parser de IPv6 a ocho hextets. Acepta la forma comprimida (`::`), la IPv4 embebida
 * (`::ffff:127.0.0.1`) y devuelve `null` ante cualquier cosa que no sea una IPv6 válida (por
 * ejemplo un nombre DNS). No usa `Deno` ni red: es texto puro.
 */
function parsearIpv6(entrada: string): number[] | null {
    let texto = entrada;

    // Índice de zona (`fe80::1%eth0`): no forma parte de la dirección.
    const porcentaje = texto.indexOf('%');
    if (porcentaje !== -1) texto = texto.slice(0, porcentaje);

    // IPv4 embebida al final: se convierte a dos hextets y sigue el parser normal.
    if (texto.includes('.')) {
        const ultimoDosPuntos = texto.lastIndexOf(':');
        if (ultimoDosPuntos === -1) return null;
        const ipv4 = parsearIpv4(texto.slice(ultimoDosPuntos + 1));
        if (ipv4 === null) return null;
        const alto = ((ipv4 >>> 16) & 0xffff).toString(16);
        const bajo = (ipv4 & 0xffff).toString(16);
        texto = `${texto.slice(0, ultimoDosPuntos + 1)}${alto}:${bajo}`;
    }

    const doble = texto.indexOf('::');
    if (doble !== -1 && texto.indexOf('::', doble + 2) !== -1) return null;

    const parteAlta = doble === -1 ? texto : texto.slice(0, doble);
    const parteBaja = doble === -1 ? null : texto.slice(doble + 2);

    const separar = (parte: string): number[] | null => {
        if (parte === '') return [];
        const numeros: number[] = [];
        for (const hextet of parte.split(':')) {
            if (!/^[0-9a-fA-F]{1,4}$/.test(hextet)) return null;
            numeros.push(parseInt(hextet, 16));
        }
        return numeros;
    };

    const alto = separar(parteAlta);
    if (alto === null) return null;

    if (parteBaja === null) return alto.length === 8 ? alto : null;

    const bajo = separar(parteBaja);
    if (bajo === null) return null;

    const total = alto.length + bajo.length;
    if (total > 7) return null;
    return [...alto, ...new Array<number>(8 - total).fill(0), ...bajo];
}

