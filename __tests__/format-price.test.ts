import { describe, expect, it } from 'vitest';
import {
    PRECIO_MAXIMO,
    comparePriceValues,
    filterPriceInputText,
    formatPrice,
    parsePriceInput,
    toCurrencyCode,
    toPriceNumber
} from '../lib/format-price';

/**
 * El precio es una columna **`numeric(12,2)`**, no texto libre: el contrato de este
 * módulo es el del dinero y el de lo que se teclea en un campo numérico, no el de
 * «interpretar lo que haya».
 */
describe('formatPrice', () => {
    it('devuelve null para null y undefined', () => {
        expect(formatPrice(null)).toBeNull();
        expect(formatPrice(undefined)).toBeNull();
    });

    it('devuelve null para números no finitos, en vez de «NaN» o «Infinity»', () => {
        expect(formatPrice(NaN)).toBeNull();
        expect(formatPrice(Infinity)).toBeNull();
        expect(formatPrice(-Infinity)).toBeNull();
    });

    it('pinta siempre dos decimales con coma, que es como se escribe el dinero', () => {
        expect(formatPrice(349)).toBe('349,00');
        expect(formatPrice(89.99)).toBe('89,99');
        expect(formatPrice(0.5)).toBe('0,50');
        expect(formatPrice(0)).toBe('0,00');
    });

    it('conserva los dos decimales de una cifra redonda', () => {
        // Es la diferencia con la época del texto: «25» se pintaba «25» y ahora se
        // pinta «25,00», que es lo correcto para un precio.
        expect(formatPrice(25)).toBe('25,00');
        expect(formatPrice(100)).toBe('100,00');
    });
});

describe('parsePriceInput', () => {
    it('lee lo que se teclea con coma o con punto', () => {
        expect(parsePriceInput('349')).toBe(349);
        expect(parsePriceInput('349,5')).toBe(349.5);
        expect(parsePriceInput('349,50')).toBe(349.5);
        expect(parsePriceInput('349.50')).toBe(349.5);
        expect(parsePriceInput('349,00')).toBe(349);
    });

    it('lee el punto como separador de millares cuando agrupa de tres en tres', () => {
        // Convención española, fijada por el propietario el 2026-10-13: el punto son
        // millares y la coma es el decimal. Antes `1.234` se leía `1,234` — mil veces
        // menos —, así que pegar un precio con separador de millares guardaba una cifra
        // falsa, en silencio.
        expect(parsePriceInput('1.234')).toBe(1234);
        expect(parsePriceInput('1.234.567')).toBe(1234567);
        expect(parsePriceInput('1.234,56')).toBe(1234.56);
        expect(parsePriceInput('1.234,5')).toBe(1234.5);
    });

    it('lee un punto que NO agrupa de tres en tres como separador decimal', () => {
        // `12.5` no puede ser un millar (no agrupa), así que es un decimal: es lo que
        // evita que un número pegado con punto decimal se multiplique por mil. Y junto
        // a una coma, un punto que no agrupa no es nada, así que se rechaza en vez de
        // adivinar.
        expect(parsePriceInput('12.5')).toBe(12.5);
        expect(parsePriceInput('1.234.5')).toBeNull();
        expect(parsePriceInput('1.23,45')).toBeNull();
    });

    it('lee un decimal sin parte entera, con punto o con coma', () => {
        // Lo encontró el refutador de la revisión y era una regresión de esta misma
        // tanda: la rama del punto decimal exigía un dígito **antes** del punto, así
        // que `.5` dejó de leerse cuando el baseline lo leía. La coma ya funcionaba por
        // la rama del entero vacío, así que los dos separadores discrepaban en un caso
        // que la regla de arriba dice que es un decimal. Se leen igual los dos.
        expect(parsePriceInput('.5')).toBe(0.5);
        expect(parsePriceInput('.50')).toBe(0.5);
        expect(parsePriceInput('.05')).toBe(0.05);
        expect(parsePriceInput(',5')).toBe(0.5);
        expect(parsePriceInput(',05')).toBe(0.05);
        // Y un punto solo, sin nada detrás, sigue sin ser un precio.
        expect(parsePriceInput('.')).toBeNull();
        expect(parsePriceInput(',')).toBeNull();
    });

    it('tolera espacios alrededor', () => {
        expect(parsePriceInput('  349  ')).toBe(349);
    });

    it('una coma final de una escritura a medias vale el número entero', () => {
        expect(parsePriceInput('12,')).toBe(12);
        expect(parsePriceInput('12.')).toBe(12);
    });

    it('devuelve null para lo que no es un precio', () => {
        expect(parsePriceInput('')).toBeNull();
        expect(parsePriceInput('   ')).toBeNull();
        expect(parsePriceInput('.')).toBeNull();
        expect(parsePriceInput('gratis')).toBeNull();
        expect(parsePriceInput('12abc')).toBeNull();
        expect(parsePriceInput('12,3,4')).toBeNull();
        expect(parsePriceInput('25/30')).toBeNull();
    });

    it('rechaza los negativos: la columna los prohíbe', () => {
        expect(parsePriceInput('-5')).toBeNull();
        expect(parsePriceInput('-0.01')).toBeNull();
    });

    it('rechaza lo que no cabe en numeric(12,2), en vez de dejar que falle la escritura', () => {
        expect(parsePriceInput('99999999999')).toBeNull();
        expect(parsePriceInput('10000000000')).toBeNull();
        // El máximo exacto sí entra.
        expect(parsePriceInput('9999999999.99')).toBe(PRECIO_MAXIMO);
    });
});

describe('filterPriceInputText', () => {
    it('deja pasar dígitos y un separador', () => {
        expect(filterPriceInputText('349')).toBe('349');
        expect(filterPriceInputText('349,50')).toBe('349,50');
        expect(filterPriceInputText('349.50')).toBe('349.50');
    });

    it('quita las letras, que es lo que el teclado del móvil no evita', () => {
        // `keyboardType` es una sugerencia para el teclado del sistema: con un teclado
        // físico o pegando texto, la letra llega igual, así que el filtro es la
        // garantía, no el teclado.
        expect(filterPriceInputText('12a3')).toBe('123');
        expect(filterPriceInputText('gratis')).toBe('');
        expect(filterPriceInputText('25/30')).toBe('2530');
    });

    it('deja un solo separador: el segundo no llega a aparecer', () => {
        expect(filterPriceInputText('12,3,4')).toBe('12,34');
        expect(filterPriceInputText('1,2.3')).toBe('1,23');
    });

    it('deja pasar los puntos de millares, que es lo que se pega', () => {
        // El defecto que se arregla: al pegar `1.234,56`, el filtro dejaba pasar el
        // primer separador y descartaba el resto, así que llegaba `1.23456` a la
        // lectura. Los puntos de millares tienen que sobrevivir a la parte entera.
        expect(filterPriceInputText('1.234.567')).toBe('1.234.567');
        expect(filterPriceInputText('1.234,56')).toBe('1.234,56');
        expect(filterPriceInputText('1.234,5x6')).toBe('1.234,56');
    });

    it('no inventa nada con un texto vacío', () => {
        expect(filterPriceInputText('')).toBe('');
    });
});

describe('toPriceNumber', () => {
    it('acepta un número', () => {
        expect(toPriceNumber(349)).toBe(349);
    });

    it('acepta la cadena numérica que devuelve PostgREST para un numeric', () => {
        // Este es el caso que no se puede dar por hecho: según la versión, un
        // `numeric` llega como número o como cadena. Y la cadena usa punto.
        expect(toPriceNumber('349.00')).toBe(349);
        expect(toPriceNumber('89.99')).toBe(89.99);
    });

    it('devuelve null para lo que no es un número utilizable', () => {
        expect(toPriceNumber('')).toBeNull();
        expect(toPriceNumber('   ')).toBeNull();
        expect(toPriceNumber('349,00')).toBeNull();
        expect(toPriceNumber('gratis')).toBeNull();
        expect(toPriceNumber(null)).toBeNull();
        expect(toPriceNumber(undefined)).toBeNull();
        expect(toPriceNumber(NaN)).toBeNull();
        expect(toPriceNumber({})).toBeNull();
    });
});

describe('comparePriceValues', () => {
    it('ordena de menor a mayor y manda los precios ausentes al final', () => {
        const items = [25, null, 349, 100, undefined];
        expect([...items].sort(comparePriceValues)).toEqual([25, 100, 349, null, undefined]);
    });

    it('con DOS precios ausentes devuelve 0, nunca NaN', () => {
        // Control negativo de la revisión R3-sort-nan: con la clave `?? Infinity`,
        // dos ausentes daban `Infinity - Infinity = NaN` y el orden quedaba
        // indefinido. El test antiguo no lo cazaba porque usaba uno solo.
        expect(comparePriceValues(null, null)).toBe(0);
        expect(comparePriceValues(undefined, undefined)).toBe(0);
        expect(Number.isNaN(comparePriceValues(null, undefined))).toBe(false);
    });

    it('es un orden total: reflexivo, simétrico y finito en toda la matriz', () => {
        const values: (number | null | undefined)[] = [null, undefined, NaN, Infinity, -Infinity, 0, 25.5, 349];

        for (const a of values) {
            expect(comparePriceValues(a, a)).toBe(0);

            for (const b of values) {
                const ab = comparePriceValues(a, b);
                const ba = comparePriceValues(b, a);

                // `toBe` distingue 0 de -0, así que se compara la suma de signos.
                expect(Number.isFinite(ab)).toBe(true);
                expect(Math.sign(ab) + Math.sign(ba)).toBe(0);
            }
        }
    });

    it('con dos ausentes separados por números el orden queda definido', () => {
        const items: (number | null)[] = [null, 25, 349, null];
        // `sort` es estable en V8: los dos ausentes (clave igual) conservan su orden
        // relativo en vez de quedar indefinidos.
        expect([...items].sort(comparePriceValues)).toEqual([25, 349, null, null]);
    });
});

describe('formatPrice con moneda', () => {
    // `Intl` separa el número del símbolo con un espacio **duro** (U+00A0), no con uno normal: se
    // afirma el carácter exacto porque es lo que termina viendo el usuario.
    const DURO = '\u00a0';

    it('pinta el símbolo de la moneda cuando se conoce', () => {
        expect(formatPrice(89.99, 'EUR')).toBe(`89,99${DURO}€`);
        expect(formatPrice(89.99, 'USD')).toBe(`89,99${DURO}US$`);
    });

    it('normaliza el código antes de formatear', () => {
        expect(formatPrice(1, 'eur')).toBe(`1,00${DURO}€`);
        expect(formatPrice(1, ' eur ')).toBe(`1,00${DURO}€`);
    });

    it('sin moneda utilizable vuelve al número pelado, sin tirar', () => {
        expect(formatPrice(89.99)).toBe('89,99');
        expect(formatPrice(89.99, null)).toBe('89,99');
        expect(formatPrice(89.99, 'XX')).toBe('89,99');
        expect(formatPrice(89.99, 'EURO')).toBe('89,99');
        expect(formatPrice(89.99, '')).toBe('89,99');
    });

    it('no agrega separador de miles: el ancho del precio es el de siempre', () => {
        // Es el peor caso de la columna, el que el e2e mide a 360px: con agrupación saldría
        // `9.999.999.999,99 €` y cambaría el ancho que la app siempre tuvo.
        expect(formatPrice(9999999999.99, 'EUR')).toBe(`9999999999,99${DURO}€`);
    });

    it('un precio ausente sigue siendo null aunque haya moneda', () => {
        expect(formatPrice(null, 'EUR')).toBeNull();
        expect(formatPrice(NaN, 'EUR')).toBeNull();
    });
});

describe('toCurrencyCode', () => {
    it('acepta un ISO 4217 de tres letras y lo devuelve en mayúsculas', () => {
        expect(toCurrencyCode('EUR')).toBe('EUR');
        expect(toCurrencyCode('usd')).toBe('USD');
        expect(toCurrencyCode('  ars  ')).toBe('ARS');
    });

    it('rechaza lo que no es un código de tres letras', () => {
        expect(toCurrencyCode('EURO')).toBeNull();
        expect(toCurrencyCode('EU')).toBeNull();
        expect(toCurrencyCode('E1R')).toBeNull();
        expect(toCurrencyCode('')).toBeNull();
        expect(toCurrencyCode(null)).toBeNull();
        expect(toCurrencyCode(undefined)).toBeNull();
        expect(toCurrencyCode(42)).toBeNull();
    });
});
