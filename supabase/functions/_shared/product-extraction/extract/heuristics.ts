import { CURRENCY_CODES, detectCurrency, parsePriceText } from '../normalize/price.ts';
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
 * 2. **Un número sin moneda no es un precio, y la marca tiene que estar junto al número.** Se
 *    exige el símbolo (`€`, `$`, `£`…) antes o después —con o sin espacios— o un código ISO 4217
 *    **en mayúsculas y completo**, pegado (`29.95USD`) o separado por un espacio cuando cierra el
 *    texto (`29.95 USD`). Las mayúsculas y los límites de palabra son lo que separa un código de
 *    una palabra: `pen` en minúsculas, `PEN` dentro de `PENDRIVE` y `PACK 3 PEN DRIVE` llegaron a
 *    producir precios inventados.
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

    // Los candidatos son **números con su marca**, no nodos enteros. La clave conserva el nodo
    // como identidad para que la página siga contando «varios precios» igual que antes.
    const candidatos: { token: string; marca: string }[] = [];
    const claves = new Set<string>();

    for (const trozo of visible.split(/<[^>]*>/)) {
        const texto = collapseWhitespace(decodeHtmlEntities(trozo));
        if (texto === '' || !/\d/.test(texto)) continue;

        // Un rango (`12,99 - 19,99 €`) son dos lecturas: se pasa el nodo entero para que
        // `parsePriceText` lo rechace por el guion y la nota lo explique, en vez de quedarse con
        // uno de los dos extremos.
        const encontrados = RANGO_DE_PRECIO.test(texto)
            ? [{ token: texto, marca: '' }]
            : numerosConMarca(texto);

        for (const { token, marca } of encontrados) {
            const clave = `${texto}\u0000${token}`;
            if (claves.has(clave)) continue;
            claves.add(clave);
            candidatos.push({ token, marca });
        }
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
    const leido = parsePriceText(unico.token);
    if (!leido) {
        return { price: null, currency: null, priceNote: `El precio no se pudo interpretar: «${unico.token}».` };
    }

    // La moneda sale de la marca: el token ya no lleva el símbolo, así que `parsePriceText` no la
    // puede deducir. Un `$` suelto sigue dando `null` (es USD, ARS, MXN… y adivinarlo sería peor).
    return {
        price: unico.token,
        currency: detectCurrency({ declared: null, text: unico.marca }) ?? leido.currency,
        priceNote: null
    };
}

/** Símbolos de moneda: pueden ir antes o después del número, con o sin espacios. */
const SIMBOLOS_DE_MONEDA = String.raw`R\$|€|\$|£|¥|₩|₹|₽|₺|₪|zł|Kč`;

/**
 * La forma de un número de precio, que es la gramática del módulo y **no** una corrida de
 * dígitos: `\d+(?:[., ]\d{3})*(?:[.,]\d{1,2})?`. El espacio es separador de millares
 * (`1 234,56`), así que dos números separados nunca se unen (`2 39,99 €` no da 239,99). Los
 * guardas `(?<!\d)`/`(?!\d)` evitan cortar por la mitad una tirada más larga: `1250 €` no es 250.
 */
const NUMERO_DE_PRECIO = String.raw`\d+(?:[.,\u00A0 ]\d{3})*(?:[.,]\d{1,2})?`;

const CODIGOS_ISO = CURRENCY_CODES.join('|');

/**
 * Un código ISO 4217 **completo y en mayúsculas**: los guardas impiden que `PEN` case dentro de
 * `PENDRIVE` o `AUD` dentro de `AUDIO`, que es de donde salía un `2 PEN` inventado.
 */
const CODIGO_ISO = String.raw`(?<![A-Za-z])(?:${CODIGOS_ISO})(?![A-Za-z])`;

/**
 * El código **separado por un espacio** solo vale si cierra el texto: `29.95 USD` sí, y `PACK 3
 * PEN DRIVE` no, porque con otra palabra detrás la lectura ya es una invención. La forma **pegada**
 * (`29.95USD`) no necesita ese guarda: no hay ambigüedad posible.
 */
const CODIGO_ISO_FINAL = String.raw`${CODIGO_ISO}(?!\s*[A-Za-z])`;

/**
 * Un número **con su marca de moneda al lado**: un símbolo a cualquier lado, con o sin espacios
 * (`1.234,56 €`, `€ 39,99`, `$12.99`), o un código ISO 4217 **en mayúsculas**, pegado
 * (`29.95USD`) o separado por un espacio cuando cierra el texto (`29.95 USD`). Las mayúsculas y
 * los límites de palabra son lo que separa el código de una palabra: `pen` en minúsculas, `PEN`
 * dentro de `PENDRIVE` y `PACK 3 PEN DRIVE` llegaron a dar precios inventados (ver el encabezado).
 */
const PRECIO_CON_MARCA = new RegExp(
    String.raw`(?<![\d.,\-–—])` +
        `(?:(?<simboloAntes>${SIMBOLOS_DE_MONEDA})\\s*(?<numeroTrasSimbolo>${NUMERO_DE_PRECIO})` +
        `|(?<numeroAntesDeSimbolo>${NUMERO_DE_PRECIO})\\s*(?<simboloDespues>${SIMBOLOS_DE_MONEDA})` +
        `|(?<codigoAntes>${CODIGO_ISO})\\s*(?<numeroTrasCodigo>${NUMERO_DE_PRECIO})` +
        `|(?<numeroAntesDeCodigo>${NUMERO_DE_PRECIO})(?<codigoDespues>${CODIGO_ISO})` +
        `|(?<numeroAntesDeCodigoSeparado>${NUMERO_DE_PRECIO})\\s+(?<codigoFinal>${CODIGO_ISO_FINAL}))` +
        String.raw`(?!\d)`,
    'g'
);

/** Un guion pegado a un número (rango o signo) son dos lecturas: el nodo entero se rechaza. */
const RANGO_DE_PRECIO = new RegExp(String.raw`(?:${NUMERO_DE_PRECIO}\s*)?[-–—]\s*${NUMERO_DE_PRECIO}`);

/** Extrae de un nodo de texto cada número pegado a una marca de moneda. */
function numerosConMarca(texto: string): { token: string; marca: string }[] {
    const encontrados: { token: string; marca: string }[] = [];

    for (const coincidencia of texto.matchAll(PRECIO_CON_MARCA)) {
        const grupos: Record<string, string | undefined> = coincidencia.groups ?? {};
        const token =
            grupos.numeroTrasSimbolo ??
            grupos.numeroAntesDeSimbolo ??
            grupos.numeroTrasCodigo ??
            grupos.numeroAntesDeCodigo ??
            grupos.numeroAntesDeCodigoSeparado;
        const marca =
            grupos.simboloAntes ??
            grupos.simboloDespues ??
            grupos.codigoAntes ??
            grupos.codigoDespues ??
            grupos.codigoFinal;

        if (token !== undefined && marca !== undefined) encontrados.push({ token, marca });
    }

    return encontrados;
}
