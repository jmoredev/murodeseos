import { detectCurrency, parsePriceText } from '../normalize/price.ts';
import { collapseWhitespace, decodeHtmlEntities, parseAttributes, stripTags } from './text.ts';

/**
 * Última capa de la cascada: lo que se puede leer del HTML cuando ninguna tienda declaró nada.
 *
 * Es deliberadamente conservadora, porque una heurística demasiado lista inventa un precio. Los
 * dos casos que la medición obligó a resolver:
 *
 * 1. **Un `€` suelto no es el precio del producto.** Amazon sirve 22 textos con moneda
 *    («Menos de 10€» de un filtro, cuotas, envíos, reseñas) y ninguno es fiable. Por eso solo se
 *    acepta el precio si hay **un único** texto candidato en toda la página; con dos o más, la
 *    heurística no adivina y lo deja en `null` con una nota.
 * 2. **Un número sin moneda no es un precio.** Se exige el símbolo (`€`, `$`, `£`…) o un código
 *    ISO 4217 (`29.95 USD`) pegado al número.
 *
 * El precio de un rango (`12,99 - 19,99 €`) se detecta como un único candidato y, al no poder
 * leerse, se deja en `null` y se explica en una nota: es exactamente lo que el usuario tiene que
 * completar a mano.
 */

export type HeuristicFields = {
    title: string | null;
    description: string | null;
    price: string | null;
    currency: string | null;
    /** Motivo por el que la heurística no pudo dar un precio, si lo tuvo. */
    priceNote: string | null;
};

export function extractHeuristics(html: string): HeuristicFields {
    const precio = leerPrecio(html);

    return {
        title: leerTitulo(html),
        description: leerDescripcion(html),
        price: precio.price,
        currency: precio.currency,
        priceNote: precio.priceNote
    };
}

/**
 * Normaliza un título: recorta espacios y quita **un** sufijo `| Site`, `- Site` o `· Site`
 * cuando el nombre del sitio se conoce y coincide de verdad con el final del título.
 *
 * Quitar solo uno es a propósito: títulos como el de AliExpress terminan en `- AliExpress
 * - AliExpress` y recortarlos en cadena borraría texto que el usuario sí escribió.
 */
export function normalizeTitle(raw: string, siteName: string | null): string {
    const titulo = collapseWhitespace(decodeHtmlEntities(raw));
    const sitio = siteName ? collapseWhitespace(siteName) : '';
    if (titulo === '' || sitio === '') return titulo;

    for (const separador of ['|', '-', '·']) {
        const sufijo = ` ${separador} ${sitio}`;
        if (titulo.length > sufijo.length && titulo.endsWith(sufijo)) {
            return titulo.slice(0, titulo.length - sufijo.length).trim();
        }
    }

    return titulo;
}

function leerTitulo(html: string): string | null {
    const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (title) {
        const valor = collapseWhitespace(decodeHtmlEntities(stripTags(title[1])));
        if (valor !== '') return valor;
    }

    const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    if (h1) {
        const valor = collapseWhitespace(decodeHtmlEntities(stripTags(h1[1])));
        if (valor !== '') return valor;
    }

    return null;
}

function leerDescripcion(html: string): string | null {
    const patron = /<meta\b([^>]*)>/gi;
    let coincidencia: RegExpExecArray | null;

    while ((coincidencia = patron.exec(html)) !== null) {
        const atributos = parseAttributes(coincidencia[1]);
        if ((atributos.get('name') ?? '').trim().toLowerCase() !== 'description') continue;

        const contenido = atributos.get('content');
        if (contenido === undefined) continue;

        const valor = collapseWhitespace(decodeHtmlEntities(contenido));
        if (valor !== '') return valor;
    }

    return null;
}

/**
 * **No hay capa heurística de imagen, y es una decisión medida, no un olvido.**
 *
 * Tres respuestas, las tres equivocadas, de la **misma página real** (fixture `amazon-es`)
 * cuando nadie declara la foto —ni JSON-LD, ni Open Graph, ni microdata—:
 *
 * 1. La imagen de mayor área declarada de toda la página es una **miniatura de reseña de
 *    154×154** (`…_AC_UC154,154_…`).
 * 2. Quitada esa por tamaño, lo «mejor» que queda es el **sprite de navegación**
 *    (`…/gno/sprites/nav-sprite-global-1x-reorg-privacy…png`).
 * 3. Y por debajo de eso, una **URL armada con texto de un `<script>`**
 *    (`https://www.amazon.es/dp/%22+t.image+%22`).
 *
 * La conclusión es que, en una página así, la imagen más grande del HTML no es la del producto:
 * es cromo. Y una foto equivocada es **peor que ninguna**: el usuario no la nota hasta que el
 * regalo llega distinto, mientras que una foto que falta se arregla de un toque en el formulario
 * de alta. Así que sin declaración no hay imagen, y la foto de esas tiendas —Amazon la primera—
 * es trabajo del adaptador de dominio (T3), donde cada regla entra con su fixture y su página.
 */

function leerPrecio(html: string): { price: string | null; currency: string | null; priceNote: string | null } {
    // El `€` de un `<script>` o de un CSS no es un precio visible: se quitan antes de mirar texto.
    const visible = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ');

    const candidatos: string[] = [];
    for (const trozo of visible.split(/<[^>]*>/)) {
        const texto = collapseWhitespace(decodeHtmlEntities(trozo));
        if (texto === '' || !/\d/.test(texto)) continue;
        if (!tieneMarcaDeMoneda(texto)) continue;
        if (!candidatos.includes(texto)) candidatos.push(texto);
    }

    if (candidatos.length === 0) return { price: null, currency: null, priceNote: null };
    if (candidatos.length > 1) {
        return {
            price: null,
            currency: null,
            priceNote: 'La página muestra varios precios; no se puede saber cuál es el del producto.'
        };
    }

    const unico = candidatos[0];
    const leido = parsePriceText(unico);
    if (!leido) {
        return { price: null, currency: null, priceNote: `El precio no se pudo interpretar: «${unico}».` };
    }

    return { price: unico, currency: leido.currency, priceNote: null };
}

/**
 * `detectCurrency` no reconoce un `$` suelto **a propósito** (es USD, ARS, MXN…), pero un `$` sí
 * es una marca de moneda para descartar un número pelado. Por eso se comprueba aparte.
 */
function tieneMarcaDeMoneda(texto: string): boolean {
    return detectCurrency({ declared: null, text: texto }) !== null || texto.includes('$');
}
