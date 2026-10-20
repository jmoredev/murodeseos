import { collapseWhitespace, decodeHtmlEntities, parseAttributes, stripTags } from './text.ts';

/**
 * Lectura de microdata / RDFa (`itemprop`).
 *
 * El valor de un `itemprop` puede estar en un atributo (`content`, `src`, `href`) o ser el texto
 * del propio elemento (`<span itemprop="name">Cafetera</span>`). Se cubren los dos. No es un
 * parser de HTML: el elemento se cierra buscando su primera etiqueta de cierre, que basta para el
 * marcado real de las tiendas y no arrastra una dependencia.
 */

export type MicrodataFields = {
    name: string | null;
    price: string | null;
    currency: string | null;
    image: string | null;
};

export function extractMicrodata(html: string): MicrodataFields {
    const campos: MicrodataFields = { name: null, price: null, currency: null, image: null };

    const patron = /<([a-z][a-z0-9-]*)\b([^>]*\bitemprop\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*)>/gi;
    let coincidencia: RegExpExecArray | null;

    while ((coincidencia = patron.exec(html)) !== null) {
        const etiqueta = coincidencia[1].toLowerCase();
        const atributos = parseAttributes(coincidencia[2]);
        const nombres = (coincidencia[3] ?? coincidencia[4] ?? coincidencia[5] ?? '')
            .toLowerCase()
            .split(/\s+/)
            .filter((nombre) => nombre !== '');

        const valor = leerValor(html, coincidencia, etiqueta, atributos);
        if (valor === null) continue;

        for (const nombre of nombres) {
            if (nombre === 'name' && campos.name === null) campos.name = valor;
            else if (nombre === 'price' && campos.price === null) campos.price = valor;
            else if (nombre === 'pricecurrency' && campos.currency === null) campos.currency = valor;
            else if (nombre === 'image' && campos.image === null) campos.image = valor;
        }
    }

    return campos;
}

function leerValor(
    html: string,
    coincidencia: RegExpExecArray,
    etiqueta: string,
    atributos: Map<string, string>
): string | null {
    const directo = atributos.get('content') ?? atributos.get('src') ?? atributos.get('href');
    if (directo !== undefined) {
        const valor = decodeHtmlEntities(directo).trim();
        if (valor !== '') return valor;
    }

    const inicio = coincidencia.index + coincidencia[0].length;
    const cierre = html.indexOf(`</${etiqueta}`, inicio);
    if (cierre === -1) return null;

    const valor = collapseWhitespace(decodeHtmlEntities(stripTags(html.slice(inicio, cierre))));
    return valor === '' ? null : valor;
}
