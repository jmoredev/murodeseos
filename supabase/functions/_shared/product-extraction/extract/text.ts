/**
 * Utilidades de texto compartidas por los extractores.
 *
 * Sin parser de HTML: todo lo que hay acá es regex sobre el texto crudo. La decisión es de S5
 * (cascada propia, sin dependencias) y también de robustez: un parser estricto se cae con el HTML
 * roto que de verdad sirven las tiendas, y una regex tolerante no.
 */

/** Entidades con nombre que de verdad aparecen en las páginas. Las demás se dejan intactas. */
const ENTIDADES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: '\u00a0'
};

/**
 * Decodifica entidades HTML (con nombre, decimales y hexadecimales).
 *
 * Hace falta aunque no pintemos HTML porque una URL de imagen con `&amp;` **no es** la URL real
 * (el `&amp;` es `&`) y porque un texto con `&nbsp;` no se debe colar como si fuera contenido.
 */
export function decodeHtmlEntities(text: string): string {
    return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entidad, codigo: string) => {
        if (/^#x/i.test(codigo)) {
            const punto = parseInt(codigo.slice(2), 16);
            return Number.isFinite(punto) && punto <= 0x10ffff ? String.fromCodePoint(punto) : entidad;
        }
        if (codigo.startsWith('#')) {
            const punto = parseInt(codigo.slice(1), 10);
            return Number.isFinite(punto) && punto <= 0x10ffff ? String.fromCodePoint(punto) : entidad;
        }
        return ENTIDADES[codigo.toLowerCase()] ?? entidad;
    });
}

/** Colapsa cualquier tirada de espacios (incluidos `\u00a0` y `\p{Zs}`) y recorta los extremos. */
export function collapseWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/** Convierte las etiquetas en espacio: así «<b>12</b>€» no pierde el espacio de separación. */
export function stripTags(html: string): string {
    return html.replace(/<[^>]*>/g, ' ');
}

/**
 * Atributos de una etiqueta abierta (`meta`, `img`, `span`…) en un mapa en minúsculas.
 *
 * Acepta comillas dobles, simples y valores sin comillas, y **no le importa el orden**. Si el
 * mismo atributo aparece dos veces gana el primero. No es un parser: es lo que basta para leer
 * `content`, `property`, `name`, `itemprop`, `src`, `srcset`, `width` y `height`.
 */
export function parseAttributes(raw: string): Map<string, string> {
    const atributos = new Map<string, string>();
    // Ojo: la regex se declara dentro para no arrastrar `lastIndex` entre llamadas.
    const patron = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let coincidencia: RegExpExecArray | null;

    while ((coincidencia = patron.exec(raw)) !== null) {
        const nombre = coincidencia[1].toLowerCase();
        if (atributos.has(nombre)) continue;
        atributos.set(nombre, coincidencia[2] ?? coincidencia[3] ?? coincidencia[4] ?? '');
    }

    return atributos;
}
