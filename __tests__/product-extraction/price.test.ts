import { describe, expect, it } from 'vitest';
import { PRECIO_MAXIMO, parsePriceInput } from '../../lib/format-price';
import { detectCurrency, parsePriceText } from '../../supabase/functions/_shared/product-extraction/normalize/price';

/**
 * El precio que llega de una página **no** es el que teclea el usuario: puede venir como
 * número o como texto, con símbolo delante o detrás, con formato español (`1.234,56`) o
 * anglosajón (`1,234.56`), y con espacios finos de millares. Estos tests fijan la lectura.
 */
describe('parsePriceText', () => {
    it('lee el número tal cual cuando la página ya lo declara numérico', () => {
        expect(parsePriceText(89.99)).toMatchObject({ amount: 89.99 });
        expect(parsePriceText(0.5)).toMatchObject({ amount: 0.5 });
    });

    it('lee el precio como string, que es como lo declara JSON-LD en varias tiendas', () => {
        // Medido en PcComponentes el 2026-10-18: `"price":"79.99"`.
        expect(parsePriceText('79.99')).toMatchObject({ amount: 79.99 });
        expect(parsePriceText('89.99')).toMatchObject({ amount: 89.99 });
    });

    it('lee el formato español, con la coma como separador decimal', () => {
        expect(parsePriceText('79,99 €')).toMatchObject({ amount: 79.99, currency: 'EUR' });
        expect(parsePriceText('€ 79,99')).toMatchObject({ amount: 79.99, currency: 'EUR' });
        expect(parsePriceText('12,9')).toMatchObject({ amount: 12.9 });
        expect(parsePriceText('349,00 €')).toMatchObject({ amount: 349 });
    });

    it('lee el formato anglosajón cuando están los dos separadores y decide el último', () => {
        expect(parsePriceText('$1,234.56')).toMatchObject({ amount: 1234.56 });
        expect(parsePriceText('1.234,56 €')).toMatchObject({ amount: 1234.56 });
    });

    it('marca como ambigua la lectura de un solo separador con tres dígitos detrás', () => {
        // `1.234` es 1234 en España (millares) y 1,234 en Estados Unidos. Se decide por la
        // convención del propietario, pero la duda viaja en el resultado.
        expect(parsePriceText('1.234 €')).toMatchObject({ amount: 1234, ambiguous: true });
        expect(parsePriceText('1.234')).toMatchObject({ amount: 1234, ambiguous: true });
        expect(parsePriceText('79,99')).toMatchObject({ ambiguous: false });
    });

    it('trata los espacios como separadores de millares (incluido el espacio fino)', () => {
        expect(parsePriceText('1 234,56 €')).toMatchObject({ amount: 1234.56 });
        expect(parsePriceText('1\u00a0234,56\u00a0€')).toMatchObject({ amount: 1234.56 });
        expect(parsePriceText('1\u202f234,56 €')).toMatchObject({ amount: 1234.56 });
    });

    it('descarta el separador de millares repetido', () => {
        expect(parsePriceText('1.234.567 €')).toMatchObject({ amount: 1234567 });
        expect(parsePriceText('1,234,567.89')).toMatchObject({ amount: 1234567.89 });
    });

    it('devuelve null cuando lo que hay no es un precio: vacío, texto, rango o mal formado', () => {
        expect(parsePriceText(null)).toBeNull();
        expect(parsePriceText(undefined)).toBeNull();
        expect(parsePriceText('')).toBeNull();
        expect(parsePriceText('   ')).toBeNull();
        expect(parsePriceText('A consultar')).toBeNull();
        expect(parsePriceText('€')).toBeNull();
        expect(parsePriceText('12,,5')).toBeNull();
        // Un rango es dos precios: elegir uno sería inventar. La cadena cruda queda como
        // evidencia para que el usuario lo corrija a mano.
        expect(parsePriceText('12,99 - 19,99 €')).toBeNull();
        expect(parsePriceText('1.23,45')).toBeNull();
        expect(parsePriceText('-5,00 €')).toBeNull();
    });

    it('no acepta un precio que no quepa en la columna, ni un cero como precio', () => {
        expect(parsePriceText('99999999999,00 €')).toBeNull();
        // `numeric(12,2)` y `PRECIO_MAXIMO` son la misma frontera: un valor que no quepa no
        // puede salir del extractor, porque llegar a la base sería un error de escritura.
        expect(parsePriceText(String(PRECIO_MAXIMO + 1))).toBeNull();
        expect(parsePriceText(String(PRECIO_MAXIMO))).toMatchObject({ amount: PRECIO_MAXIMO });
        // Un «0,00 €» casi siempre es un producto sin stock, no un regalo gratis.
        expect(parsePriceText('0,00 €')).toBeNull();
    });

    it('conserva el texto original para poder enseñarlo', () => {
        expect(parsePriceText('1.234,56 €')).toMatchObject({ raw: '1.234,56 €' });
    });
});

describe('detectCurrency', () => {
    it('prefiere el código declarado por la página', () => {
        expect(detectCurrency({ declared: 'EUR', text: '$ 10' })).toBe('EUR');
        expect(detectCurrency({ declared: 'usd', text: null })).toBe('USD');
        expect(detectCurrency({ declared: '  ars ', text: null })).toBe('ARS');
    });

    it('deduce la moneda del símbolo cuando la página no la declara', () => {
        expect(detectCurrency({ declared: null, text: '79,99 €' })).toBe('EUR');
        expect(detectCurrency({ declared: null, text: '£12.99' })).toBe('GBP');
        expect(detectCurrency({ declared: null, text: 'R$ 199,90' })).toBe('BRL');
        expect(detectCurrency({ declared: null, text: '99,00 CHF' })).toBe('CHF');
    });

    it('no adivina con un «$» suelto: es USD, ARS, MXN, CLP y varias más', () => {
        expect(detectCurrency({ declared: null, text: '$ 1.234,56' })).toBeNull();
        expect(detectCurrency({ declared: null, text: '1.234,56 $' })).toBeNull();
    });

    it('ignora un declarado que no es un código ISO de tres letras', () => {
        expect(detectCurrency({ declared: 'euros', text: '79,99 €' })).toBe('EUR');
        expect(detectCurrency({ declared: '???', text: null })).toBeNull();
        expect(detectCurrency({ declared: '', text: null })).toBeNull();
    });
});

/**
 * El extractor vive en `supabase/functions/_shared/` para poder correr en Deno (extensión
 * `.ts` en los imports), así que **no** puede importar `lib/format-price.ts` en tiempo de
 * ejecución. Este test es la costura: si las dos lecturas de precio se separan, acá se ve.
 */
describe('consistencia con la convención del propietario (lib/format-price.ts)', () => {
    const textosEspanoles = [
        '349',
        '349,5',
        '349,50',
        '349.50',
        '1.234',
        '1.234,56',
        '.5',
        ',5',
        '12,',
        '1.23,45',
        '12,,5',
        'A consultar',
        '',
        '-5',
    ];

    it('coincide con `parsePriceInput` en todos los textos de convención española', () => {
        for (const texto of textosEspanoles) {
            const mio = parsePriceText(texto);
            const suyo = parsePriceInput(texto);
            expect(mio?.amount ?? null, `texto: ${texto}`).toBe(suyo);
        }
    });

    it('usa el mismo tope que la columna `numeric(12,2)`', () => {
        expect(parsePriceText(String(PRECIO_MAXIMO))?.amount).toBe(PRECIO_MAXIMO);
        expect(parsePriceText(String(PRECIO_MAXIMO + 0.01))).toBeNull();
    });
});
