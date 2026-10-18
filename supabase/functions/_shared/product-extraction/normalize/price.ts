/**
 * Lectura y normalización de **precios** que vienen de una página de producto.
 *
 * No es lo mismo que leer lo que teclea el usuario (`lib/format-price.ts`): acá el texto lo
 * escribió una tienda, puede venir como número o como string, con símbolo delante o detrás,
 * en formato español (`1.234,56 €`) o anglosajón (`$1,234.56`), y con espacios de millares.
 *
 * Tres reglas que se decidieron acá y conviene no re-descubrir:
 *
 * 1. **Con los dos separadores presentes, decide el último.** `1.234,56` es español y
 *    `1,234.56` es anglosajón; en los dos casos el separador decimal es el que aparece más a
 *    la derecha, y el otro tiene que agrupar de tres en tres o el texto se rechaza.
 * 2. **Con un solo separador y tres dígitos detrás hay ambigüedad real** (`1.234` es 1234 en
 *    España y 1,234 en Estados Unidos). Se resuelve con la convención del propietario
 *    —millares, igual que `parsePriceInput`— pero el resultado lo **declara** en `ambiguous`
 *    para que la duda no se pierda. Hay un test que pincha la coincidencia con
 *    `parsePriceInput`: si las dos lecturas se separan, ese test falla.
 * 3. **No se inventa un precio.** Un rango, un negativo, un cero, un texto sin dígitos y un
 *    valor que no quepa en `numeric(12,2)` devuelven `null`: el deseo se crea igual y el
 *    usuario completa el precio a mano.
 *
 * Este módulo vive en `supabase/functions/_shared/` porque lo usa la Edge Function, así que
 * **no importa nada de `lib/`** (Deno resuelve rutas relativas dentro de la función).
 */

/**
 * El tope de la columna `wishlist_items.price_numeric numeric(12,2)`, el mismo que
 * `PRECIO_MAXIMO` en `lib/format-price.ts`. Un valor que no quepa no puede salir de acá:
 * llegar a la base sería un error de escritura en vez de un dato que falta.
 */
export const PRICE_MAX = 9999999999.99;

export type PriceParse = {
    amount: number;
    /** Código ISO 4217 deducido del texto; `null` si no se puede saber (`$`, por ejemplo). */
    currency: string | null;
    /** El texto tal como venía, para poder enseñarlo. */
    raw: string;
    /** `true` cuando la lectura dependió de una convención y no de la evidencia. */
    ambiguous: boolean;
};

/**
 * Símbolos que identifican una moneda. `$` está a propósito con `null`: es USD, ARS, MXN,
 * CLP, COP y varias más, así que adivinarlo sería peor que dejarlo vacío.
 */
const CURRENCY_SYMBOLS: readonly (readonly [RegExp, string | null])[] = [
    [/R\$/, 'BRL'],
    [/[$]/, null],
    [/€/, 'EUR'],
    [/£/, 'GBP'],
    [/¥/, 'JPY'],
    [/₩/, 'KRW'],
    [/₹/, 'INR'],
    [/₽/, 'RUB'],
    [/₺/, 'TRY'],
    [/₪/, 'ILS'],
    [/zł/i, 'PLN'],
    [/Kč/i, 'CZK'],
];

/** Códigos ISO 4217 que se aceptan escritos en el texto (`99,00 CHF`). */
export const CURRENCY_CODES = [
    'EUR', 'USD', 'GBP', 'JPY', 'CHF', 'ARS', 'MXN', 'CLP', 'COP', 'PEN', 'BRL', 'UYU', 'BOB', 'PYG',
    'VES', 'KRW', 'INR', 'RUB', 'TRY', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'SEK', 'NOK', 'DKK', 'ILS',
    'CAD', 'AUD', 'CNY',
];

const CURRENCY_CODE_PATTERN = new RegExp(`\\b(${CURRENCY_CODES.join('|')})\\b`, 'i');

/**
 * Moneda del precio: primero el código que declara la página (JSON-LD `priceCurrency`, que es
 * la fuente fiable) y, si no hay, el símbolo del texto. Un `$` suelto **no** es una respuesta.
 */
export function detectCurrency(input: { declared?: string | null; text?: string | null }): string | null {
    const declared = input.declared?.trim();
    if (declared && /^[A-Za-z]{3}$/.test(declared)) return declared.toUpperCase();

    const text = input.text;
    if (!text) return null;

    for (const [pattern, currency] of CURRENCY_SYMBOLS) {
        if (pattern.test(text)) return currency;
    }

    const found = CURRENCY_CODE_PATTERN.exec(text);
    return found ? found[1].toUpperCase() : null;
}

function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

function buildResult(
    integer: string,
    decimals: string,
    currency: string | null,
    raw: string,
    ambiguous: boolean
): PriceParse | null {
    if (integer === '' && decimals === '') return null;

    const amount = roundToCents(Number(`${integer === '' ? '0' : integer}.${decimals === '' ? '0' : decimals}`));
    // `0` no es un precio: casi siempre es un producto sin stock. Y por encima del tope de la
    // columna no puede salir de acá.
    if (!Number.isFinite(amount) || amount <= 0 || amount > PRICE_MAX) return null;

    return { amount, currency, raw, ambiguous };
}

export function parsePriceText(raw: string | number | null | undefined): PriceParse | null {
    if (raw === null || raw === undefined) return null;

    if (typeof raw === 'number') {
        if (!Number.isFinite(raw)) return null;
        const amount = roundToCents(raw);
        if (amount <= 0 || amount > PRICE_MAX) return null;
        return { amount, currency: null, raw: String(raw), ambiguous: false };
    }

    const text = raw.trim();
    if (text === '') return null;

    // Un guion es un rango (`12,99 - 19,99`) o un negativo. En los dos casos hay dos lecturas
    // posibles y elegir una sería inventar el precio.
    if (text.includes('-')) return null;

    const currency = detectCurrency({ declared: null, text });

    // Todo lo que no sea dígito o separador se va: símbolos de moneda, códigos, letras y
    // **espacios**, que en español y en francés son separadores de millares (`1 234,56`).
    const compact = text.replace(/[^\d.,]/g, '');
    if (!/\d/.test(compact)) return null;

    const dots = (compact.match(/\./g) ?? []).length;
    const commas = (compact.match(/,/g) ?? []).length;

    if (dots > 0 && commas > 0) {
        const decimalSeparator = compact.lastIndexOf('.') > compact.lastIndexOf(',') ? '.' : ',';
        const groupSeparator = decimalSeparator === '.' ? ',' : '.';
        const cut = compact.lastIndexOf(decimalSeparator);
        const integerPart = compact.slice(0, cut);
        const decimals = compact.slice(cut + 1);

        // El separador que no es decimal tiene que agrupar de tres en tres: `1.23,45` no es un
        // precio, y sin esta comprobación se leería 123,45.
        if (!new RegExp(`^\\d{1,3}(?:\\${groupSeparator}\\d{3})*$`).test(integerPart)) return null;
        if (!/^\d*$/.test(decimals)) return null;

        return buildResult(integerPart.split(groupSeparator).join(''), decimals, currency, text, false);
    }

    if (dots + commas === 0) {
        return /^\d+$/.test(compact) ? buildResult(compact, '', currency, text, false) : null;
    }

    const separator = dots > 0 ? '.' : ',';
    const cut = compact.lastIndexOf(separator);
    const before = compact.slice(0, cut);
    const after = compact.slice(cut + 1);

    if (dots + commas > 1) {
        // Varias apariciones del mismo separador: son millares, y tienen que agrupar de tres.
        if (!new RegExp(`^\\d{1,3}(?:\\${separator}\\d{3})+$`).test(compact)) return null;
        return buildResult(compact.split(separator).join(''), '', currency, text, false);
    }

    if (after.length === 3 && before.length > 0) {
        // `1.234` / `1,234`: millares acá, decimales en Estados Unidos. Se decide por la
        // convención del propietario y la duda queda declarada.
        return buildResult(`${before}${after}`, '', currency, text, true);
    }

    if (!/^\d*$/.test(before) || !/^\d*$/.test(after)) return null;
    return buildResult(before, after, currency, text, false);
}
