/**
 * Formato y comparación de precios.
 *
 * `price` es una columna **text** en la base de datos: el usuario escribe lo que
 * quiere y la app nunca ha formateado separadores de miles. Un valor ambiguo como
 * `1.234` se lee como decimal (`1,234`), así que el formateador se niega a tocar
 * cualquier cosa que no sea un número simple: lo que no sepa interpretar, se
 * devuelve tal cual, sin inventar, truncar ni quitar caracteres.
 */

/**
 * Formatea un precio para mostrarlo.
 *
 * Reglas, en orden:
 * 1. `null`, `undefined` o vacío (tras recortar espacios) → `null` (los
 *    consumidores ya pintan «Sin precio»).
 * 1b. Un número **no finito** (`NaN`, `±Infinity`) → `null`: `String(NaN)` es
 *    «NaN» y la tarjeta lo pintaba literalmente como «NaN €».
 * 2. Decimal con punto (`349.00`) → se cambia el punto por coma (`349,00`).
 * 3. Decimal con coma (`349,00`) → sin cambios.
 * 4. Entero simple (`349`) → sin cambios.
 * 5. Cualquier otra cosa → verbatim. Nunca inventar, truncar ni quitar caracteres.
 */
export function formatPrice(price: string | number | null | undefined): string | null {
    if (price === null || price === undefined) return null;

    // `NaN` e `Infinity` no tienen texto honesto que devolver, y sin esta guarda
    // el contrato «lo que no entiendo lo devuelvo verbatim» se cumplía al pie de
    // la letra con un texto inventado por JavaScript.
    if (typeof price === 'number' && !Number.isFinite(price)) return null;

    const text = typeof price === 'number' ? String(price) : price.trim();
    if (text === '') return null;

    // Decimal con punto: «349.00» → «349,00». Sólo dígitos y un punto.
    if (/^\d+\.\d+$/.test(text)) return text.replace('.', ',');

    return text;
}

/**
 * Convierte un precio de texto en un número comparable para ordenar.
 *
 * Devuelve `null` cuando el valor no se puede interpretar como número: un
 * comparador que devuelva `NaN` deja el orden indefinido, así que el que llama
 * debe elegir un valor estable para los no numéricos.
 */
export function parsePriceForSort(price: string | number | null | undefined): number | null {
    if (price === null || price === undefined) return null;

    if (typeof price === 'number') return Number.isFinite(price) ? price : null;

    // Normaliza el separador decimal: `parseFloat('349,00')` devuelve 349
    // porque se detiene en la coma y suelta silenciosamente los decimales.
    const normalized = price.trim().replace(',', '.');
    if (normalized === '' || !/^\d*\.?\d+$/.test(normalized)) return null;

    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}

/**
 * Comparador de precios para `Array.prototype.sort`.
 *
 * Es un **orden total**: los valores no numéricos van al final, dos no numéricos
 * comparan igual (`0`) y **nunca se devuelve `NaN`**. Un comparador que devuelve
 * `NaN` deja el orden del array indefinido, y la clave
 * `?? Number.POSITIVE_INFINITY` que se usaba en `WishListTab` lo hacía en cuanto
 * había **dos** precios no numéricos: `Infinity - Infinity` es `NaN`.
 */
export function comparePriceForSort(
    a: string | number | null | undefined,
    b: string | number | null | undefined
): number {
    const priceA = parsePriceForSort(a);
    const priceB = parsePriceForSort(b);

    if (priceA === null && priceB === null) return 0;
    if (priceA === null) return 1;
    if (priceB === null) return -1;

    // Ambos finitos por contrato de `parsePriceForSort`.
    return priceA - priceB;
}
