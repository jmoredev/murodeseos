/**
 * Formato, lectura y comparación de precios.
 *
 * `wishlist_items.price_numeric` es **`numeric(12,2)`**: el precio es un número, y
 * este módulo es el único sitio donde se convierte a texto para pintarlo, donde se
 * lee lo que el usuario teclea y donde se decide el orden. Ya **no hay texto libre
 * que defender**: la columna no puede contenerlo, así que el formateador no tiene
 * que adivinar qué hacer con basura.
 *
 * Nota de por qué la columna se llama `price_numeric` y no `price`: renombrarla
 * obligaba a que la app tolerase los dos nombres —escribir un número en una columna
 * que todavía es texto falla, y escribir texto en la que ya es numérica también— o a
 * una segunda publicación. La decisión está en `odd/tasks/price-numeric.md`.
 */

/** El máximo que admite `numeric(12,2)`: diez dígitos enteros y dos decimales. */
export const PRECIO_MAXIMO = 9999999999.99;

/**
 * Formatea un precio para mostrarlo: **siempre dos decimales con coma**, que es
 * como se escribe el dinero en español.
 *
 * `null`, `undefined` y los números no finitos (`NaN`, `±Infinity`) devuelven
 * `null`, porque los consumidores ya pintan «Sin precio» y un `NaN` no tiene texto
 * honesto que dar.
 */
export function formatPrice(price: number | null | undefined): string | null {
    if (price === null || price === undefined) return null;
    if (!Number.isFinite(price)) return null;

    return price.toFixed(2).replace('.', ',');
}

/**
 * Lee lo que el usuario ha tecleado en el campo de precio.
 *
 * Acepta `349`, `349,5`, `349.50`, `349,00` y espacios alrededor; una coma final
 * (`12,`) vale `12`. Devuelve `null` cuando no es un precio: vacío, con letras, con
 * más de un separador, **negativo**, o por encima del máximo de la columna — un
 * valor que no quepa en `numeric(12,2)` no puede salir de aquí, porque llegar a la
 * base sería un error de escritura en vez de un dato que falta.
 */
export function parsePriceInput(text: string): number | null {
    const normalized = text.trim().replace(',', '.');

    // Sólo dígitos y, como mucho, un separador: `12.3.4` o `-5` no son un precio.
    if (!/^\d*\.?\d*$/.test(normalized)) return null;

    // La coma (o el punto) final de una escritura a medias: «12,» es 12.
    const sinSeparadorFinal = normalized.replace(/\.$/, '');
    if (sinSeparadorFinal === '') return null;

    const value = Number(sinSeparadorFinal);
    if (!Number.isFinite(value) || value < 0 || value > PRECIO_MAXIMO) return null;

    return value;
}

/**
 * Filtra lo que entra en el campo de precio **mientras se teclea**.
 *
 * Deja sólo dígitos y **un** separador decimal, así que ni una letra ni un segundo
 * separador llegan a aparecer en el campo. El filtro gobierna lo que se ve; decidir
 * si eso es un precio es cosa de `parsePriceInput`, y por eso el campo sigue
 * avisando cuando lo tecleado no se puede leer.
 */
export function filterPriceInputText(text: string): string {
    const soloValidos = text.replace(/[^\d.,]/g, '');
    const separador = soloValidos.search(/[.,]/);

    if (separador === -1) return soloValidos;

    return soloValidos.slice(0, separador + 1) + soloValidos.slice(separador + 1).replace(/[.,]/g, '');
}

/**
 * Normaliza lo que llega de la base de datos.
 *
 * PostgREST puede devolver una columna `numeric` como **número** o como **cadena
 * numérica**, según la versión, así que la ruta de lectura no puede dar por hecho
 * ninguno de los dos: pasa por aquí y el resto del código sólo ve números o `null`.
 */
export function toPriceNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

/**
 * Comparador de precios para `Array.prototype.sort`.
 *
 * Es un **orden total**: los precios ausentes o ilegibles van al final, dos
 * ausentes comparan igual (`0`) y **nunca se devuelve `NaN`**. Un comparador que
 * devuelve `NaN` deja el orden del array indefinido, y la clave
 * `?? Number.POSITIVE_INFINITY` que se usaba antes lo hacía en cuanto había **dos**
 * precios sin número: `Infinity - Infinity` es `NaN`.
 */
export function comparePriceValues(a: number | null | undefined, b: number | null | undefined): number {
    const priceA = toPriceNumber(a);
    const priceB = toPriceNumber(b);

    if (priceA === null && priceB === null) return 0;
    if (priceA === null) return 1;
    if (priceB === null) return -1;

    // Ambos finitos por contrato de `toPriceNumber`.
    return priceA - priceB;
}
