import { describe, expect, it } from 'vitest';
import { comparePriceForSort, formatPrice, parsePriceForSort } from '../lib/format-price';

describe('formatPrice', () => {
    it('devuelve null para null, undefined y vacío', () => {
        expect(formatPrice(null)).toBeNull();
        expect(formatPrice(undefined)).toBeNull();
        expect(formatPrice('')).toBeNull();
        expect(formatPrice('   ')).toBeNull();
    });

    it('convierte el punto decimal en coma', () => {
        expect(formatPrice('349.00')).toBe('349,00');
        expect(formatPrice('89.99')).toBe('89,99');
    });

    it('mantiene los decimales con coma sin cambios', () => {
        expect(formatPrice('349,00')).toBe('349,00');
    });

    it('mantiene el entero simple sin cambios', () => {
        expect(formatPrice('349')).toBe('349');
    });

    it('control negativo: devuelve verbatim lo que no es un número simple', () => {
        // Controles negativos: si el formateador "limpiara" la entrada, estos tests fallarían.
        expect(formatPrice('gratis')).toBe('gratis');
        expect(formatPrice('1.234,56')).toBe('1.234,56');
        // Ambiguo: `1.234` encaja con el patrón de decimal con punto, así que se
        // lee como decimal (1,234) — es la limitación documentada del formateador.
        expect(formatPrice('1.234')).toBe('1,234');
        expect(formatPrice('-5')).toBe('-5');
        expect(formatPrice('349 €')).toBe('349 €');
    });

    it('acepta números reales', () => {
        expect(formatPrice(349)).toBe('349');
        expect(formatPrice(349.5)).toBe('349,5');
    });

    it('devuelve null para números no finitos en lugar de «NaN» o «Infinity»', () => {
        // Control negativo de la revisión R3-format-nan: la rama numérica es
        // `String(price)`, así que `NaN` se pintaba como «NaN €» en la tarjeta y
        // `Infinity` como «Infinity €». No hay texto honesto que devolver: el
        // contrato de `null` es el que ya pinta «Sin precio».
        expect(formatPrice(NaN)).toBeNull();
        expect(formatPrice(Infinity)).toBeNull();
        expect(formatPrice(-Infinity)).toBeNull();
    });
});

describe('parsePriceForSort', () => {
    it('parsea decimales con punto', () => {
        expect(parsePriceForSort('349.00')).toBe(349);
        expect(parsePriceForSort('89.99')).toBeCloseTo(89.99);
    });

    it('parsea decimales con coma sin perder los decimales', () => {
        // Control negativo del bug: parseFloat('349,00') devolvía 349, soltando los
        // decimales en silencio. Este test habría fallado antes del arreglo.
        expect(parsePriceForSort('349,00')).toBe(349);
        expect(parsePriceForSort('349,99')).toBeCloseTo(349.99);
    });

    it('parsea enteros', () => {
        expect(parsePriceForSort('349')).toBe(349);
        expect(parsePriceForSort(349)).toBe(349);
    });

    it('devuelve null para no numéricos, vacíos y NaN — nunca NaN', () => {
        // Control negativo: un comparador con NaN deja el orden indefinido.
        expect(parsePriceForSort('gratis')).toBeNull();
        expect(parsePriceForSort('')).toBeNull();
        expect(parsePriceForSort('   ')).toBeNull();
        expect(parsePriceForSort(null)).toBeNull();
        expect(parsePriceForSort(undefined)).toBeNull();
        expect(parsePriceForSort('12abc')).toBeNull();
        expect(parsePriceForSort(NaN)).toBeNull();
    });
});

describe('comparePriceForSort', () => {
    it('ordena precios numéricos de menor a mayor respetando la coma decimal', () => {
        const items = ['25,00', 'no numeric', '349,00', '100.00'];
        const sorted = [...items].sort(comparePriceForSort);

        // El no numérico va al final, y «349,00» vale 349.00, no 349.
        expect(sorted).toEqual(['25,00', '100.00', '349,00', 'no numeric']);
    });

    it('con DOS valores no numéricos devuelve 0, nunca NaN', () => {
        // Control negativo de la revisión R3-sort-nan: con la clave
        // `?? Number.POSITIVE_INFINITY` dos no numéricos daban
        // `Infinity - Infinity = NaN` y el orden del array quedaba indefinido.
        // El test anterior no lo cazaba porque usaba UN solo no numérico.
        expect(comparePriceForSort('gratis', 'aprox 30')).toBe(0);
        expect(Number.isNaN(comparePriceForSort('gratis', 'aprox 30'))).toBe(false);
        expect(Number.isNaN(comparePriceForSort('', ''))).toBe(false);
        expect(Number.isNaN(comparePriceForSort(null, NaN))).toBe(false);
        expect(Number.isNaN(comparePriceForSort(Infinity, undefined))).toBe(false);
    });

    it('es un orden total: reflexivo, simétrico y finito en toda la matriz', () => {
        const values: (string | number | null | undefined)[] = [
            null, undefined, NaN, Infinity, -Infinity, '', '   ', 'gratis', '12abc',
            '0', '25,00', '100.00', '349,00'
        ];

        for (const a of values) {
            expect(comparePriceForSort(a, a)).toBe(0);

            for (const b of values) {
                const ab = comparePriceForSort(a, b);
                const ba = comparePriceForSort(b, a);

                // `toBe` distingue 0 de -0, así que se compara la suma de signos.
                expect(Number.isFinite(ab)).toBe(true);
                expect(Number.isFinite(ba)).toBe(true);
                expect(Math.sign(ab) + Math.sign(ba)).toBe(0);
            }
        }
    });

    it('con dos no numéricos separados por numéricos el orden queda definido', () => {
        const items = ['gratis', '25,00', 'aprox 30', '100.00'];
        // `sort` es estable en V8: los dos no numéricos (clave igual) conservan
        // su orden relativo en vez de quedar indefinidos.
        expect([...items].sort(comparePriceForSort)).toEqual([
            '25,00', '100.00', 'gratis', 'aprox 30'
        ]);
    });
});
