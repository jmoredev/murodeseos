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

/** Un código ISO 4217 tal como lo acepta `Intl`: tres letras. */
const CODIGO_ISO = /^[A-Z]{3}$/;

/**
 * Normaliza una moneda leída de la base o de la extracción.
 *
 * Devuelve `null` —no `'XXX'`, no una adivinanza— cuando no hay un código de tres letras: la
 * columna es libre y la extracción puede traer cualquier cosa, y un precio sin moneda se pinta
 * como número pelado en vez de mentir con un símbolo.
 */
export function toCurrencyCode(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const codigo = value.trim().toUpperCase();
    return CODIGO_ISO.test(codigo) ? codigo : null;
}

/**
 * Formatea un precio para mostrarlo.
 *
 * Con una moneda válida se pinta con su símbolo (`89,99 €`), que es lo que el usuario espera y
 * lo que respeta el formato de cada moneda. **Sin moneda se pinta sólo el número** (`89,99`),
 * que es como estaban todos los precios antes de T7 y como quedan las filas viejas y las páginas
 * que no declaran moneda: nunca se asume EUR.
 *
 * `null`, `undefined` y los números no finitos (`NaN`, `±Infinity`) devuelven `null`, porque los
 * consumidores ya pintan «Sin precio» y un `NaN` no tiene texto honesto que dar.
 */
export function formatPrice(price: number | null | undefined, currency?: string | null): string | null {
    if (price === null || price === undefined) return null;
    if (!Number.isFinite(price)) return null;

    const codigo = toCurrencyCode(currency);
    if (codigo) {
        // `useGrouping: false` a propósito: la app nunca pintó separador de miles
        // (`9999999999,99`), y agregarlo cambiaría el ancho del chip, que el e2e mide a 360px.
        // Lo que T7 suma es el símbolo, no una notación nueva.
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: codigo,
            useGrouping: false,
        }).format(price);
    }

    return price.toFixed(2).replace('.', ',');
}

/**
 * Lee lo que el usuario ha tecleado o pegado en el campo de precio.
 *
 * **Convención española**, fijada por el propietario el 2026-10-13: la **coma** es el
 * separador decimal y el **punto** es el de millares, y un punto solo cuenta como
 * millares **si agrupa de tres en tres** (`1.234`, `1.234.567`). Un punto que no
 * agrupa se lee como decimal (`12.5` vale `12,5`), que es lo que impide que pegar un
 * número con punto decimal se multiplique por mil; y si además hay una coma, un
 * punto que no agrupa se rechaza en vez de adivinar (`1.23,45` no es un precio).
 *
 * Acepta `349`, `349,5`, `349,50`, `349.50`, `1.234`, `1.234,56`, `.5` y espacios
 * alrededor; una coma final (`12,`) vale `12`. Devuelve `null` cuando no es un
 * precio: vacío, con letras, con más de una coma, con un grupo de millares mal
 * formado, **negativo**, o por encima del máximo de la columna — un valor que no
 * quepa en `numeric(12,2)` no puede salir de aquí, porque llegar a la base sería un
 * error de escritura en vez de un dato que falta.
 */
export function parsePriceInput(text: string): number | null {
    const limpio = text.trim();
    if (limpio === '') return null;

    const trozos = limpio.split(',');
    if (trozos.length > 2) return null; // dos comas no son un precio

    const [entera, decimales] = trozos;
    if (decimales !== undefined && !/^\d*$/.test(decimales)) return null;

    let parteEntera: string;
    let parteDecimal = decimales ?? '';

    if (entera.includes('.')) {
        if (/^\d{1,3}(\.\d{3})+$/.test(entera)) {
            // Agrupa de tres en tres: son millares, y los millares se van.
            parteEntera = entera.replace(/\./g, '');
        } else if (decimales === undefined && /^\d*\.\d*$/.test(entera)) {
            // Un solo punto que no agrupa y sin coma: es el separador decimal. La parte
            // entera puede estar vacía (`.5` es 0,50), igual que con la coma (`,5`): los
            // dos separadores tienen que leerse igual.
            [parteEntera, parteDecimal] = entera.split('.');
        } else {
            return null;
        }
    } else if (/^\d*$/.test(entera)) {
        parteEntera = entera;
    } else {
        return null;
    }

    // Un separador sin ningún dígito —«,» o «.»— no es un precio. La coma o el punto
    // finales de una escritura a medias sí lo son, y se leen como entero: «12,» es 12.
    if (parteEntera === '' && parteDecimal === '') return null;

    const value = Number(`${parteEntera}.${parteDecimal}`);
    if (!Number.isFinite(value) || value < 0 || value > PRECIO_MAXIMO) return null;

    return value;
}

/**
 * Filtra lo que entra en el campo de precio **mientras se teclea o se pega**.
 *
 * Deja dígitos, puntos y **una** coma; el resto no llega a aparecer. Los puntos se
 * dejan pasar en la parte entera porque un punto recién tecleado **todavía no se
 * puede juzgar**: al escribir `1.234`, el primer punto es un prefijo válido de un
 * separador de millares y descartarlo lo haría imposible de teclear. Los puntos
 * **después** de la coma sí se descartan, que ahí ya no significan nada.
 *
 * El filtro gobierna lo que se ve; decidir si eso es un precio es cosa de
 * `parsePriceInput`, y por eso el campo sigue avisando cuando lo tecleado no se
 * puede leer.
 */
export function filterPriceInputText(text: string): string {
    const soloValidos = text.replace(/[^\d.,]/g, '');
    const [entera, ...resto] = soloValidos.split(',');

    if (resto.length === 0) return entera;

    return `${entera},${resto.join('').replace(/\D/g, '')}`;
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
