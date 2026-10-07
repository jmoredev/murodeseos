import { describe, expect, it } from 'vitest';
import { formatPrice, parsePriceForSort } from '../lib/format-price';

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

    it('ordena correctamente: el comparador no produce NaN y las comas se respetan', () => {
        const sortKey = (p: string | number | null | undefined): number =>
            parsePriceForSort(p) ?? Number.POSITIVE_INFINITY;

        const items = ['25,00', 'no numeric', '349,00', '100.00'];
        const sorted = [...items].sort((a, b) => sortKey(a) - sortKey(b));

        // El no numérico va al final (clave estable ∞), y «349,00» vale 349.00, no 349.
        expect(sorted).toEqual(['25,00', '100.00', '349,00', 'no numeric']);
    });
});
