import { describe, expect, it } from 'vitest';
import {
    isCacheEnabled,
    LIMITE_POR_DEFECTO,
    readExtractionConfig,
    TTL_POR_DEFECTO,
    VENTANA_POR_DEFECTO,
} from '../../supabase/functions/_shared/product-extraction/config/env';

/** Un entorno de mentira: solo las claves que se le pasan. */
function entorno(valores: Record<string, string> = {}) {
    return (nombre: string): string | undefined => valores[nombre];
}

const LIMITE = 'PRODUCT_EXTRACTION_QUOTA_LIMIT';
const VENTANA = 'PRODUCT_EXTRACTION_QUOTA_WINDOW_SECONDS';
const TTL = 'PRODUCT_EXTRACTION_CACHE_TTL_SECONDS';

describe('readExtractionConfig: la cuota', () => {
    it('usa el límite por defecto cuando la variable no está', () => {
        expect(readExtractionConfig(entorno()).limite).toBe(LIMITE_POR_DEFECTO);
    });

    it('lee un límite explícito', () => {
        expect(readExtractionConfig(entorno({ [LIMITE]: '12' })).limite).toBe(12);
    });

    it('honra un 0 explícito: apagar la extracción es una decisión operativa', () => {
        // El resto del cambio define 0 como «no permitir ninguna extracción»: la función SQL
        // rechaza `p_limit <= 0` sin tocar la tabla y `decideQuota` con 0 nunca permite. Un lector
        // de entorno que convierta ese 0 en el valor por defecto entrega 30 extracciones a quien
        // pidió cero, y lo reporta como éxito.
        expect(readExtractionConfig(entorno({ [LIMITE]: '0' })).limite).toBe(0);
    });

    it('no concede más de lo pedido con un negativo: lo lee como 0', () => {
        // Un límite negativo no es un número con significado; la lectura segura de «menos que
        // nada» es «nada». Nunca el valor por defecto, que sería conceder de más.
        expect(readExtractionConfig(entorno({ [LIMITE]: '-5' })).limite).toBe(0);
    });

    it('usa el valor por defecto cuando el texto no es un número', () => {
        expect(readExtractionConfig(entorno({ [LIMITE]: 'muchas' })).limite).toBe(LIMITE_POR_DEFECTO);
    });
});

describe('readExtractionConfig: la ventana y el TTL', () => {
    it('usa los valores por defecto cuando no están', () => {
        const config = readExtractionConfig(entorno());

        expect(config.ventanaSegundos).toBe(VENTANA_POR_DEFECTO);
        expect(config.ttlSegundos).toBe(TTL_POR_DEFECTO);
    });

    it('lee valores explícitos', () => {
        const config = readExtractionConfig(entorno({ [VENTANA]: '120', [TTL]: '600' }));

        expect(config.ventanaSegundos).toBe(120);
        expect(config.ttlSegundos).toBe(600);
    });

    it('no acepta una ventana de cero: la función SQL la rechaza', () => {
        expect(readExtractionConfig(entorno({ [VENTANA]: '0' })).ventanaSegundos).toBe(VENTANA_POR_DEFECTO);
    });

    it('acepta un TTL de cero como caché apagada', () => {
        // Con TTL 0 el borrador expira al guardarse, pero eso **no basta**: las filas que se
        // escribieron con el TTL anterior siguen vigentes hasta su vencimiento, así que el
        // consumidor tiene que preguntar `isCacheEnabled` antes de leer y antes de escribir.
        expect(readExtractionConfig(entorno({ [TTL]: '0' })).ttlSegundos).toBe(0);
        expect(isCacheEnabled(readExtractionConfig(entorno({ [TTL]: '0' })))).toBe(false);
    });

    it('con la caché apagada no se sirven las filas que dejó el TTL anterior', () => {
        // La regla que faltaba: apagar la caché no puede depender de `expires_at`, porque una fila
        // escrita con TTL 3600 sigue viva una hora después de apagarla a mano.
        expect(isCacheEnabled(readExtractionConfig(entorno({ [TTL]: '3600' })))).toBe(true);
        expect(isCacheEnabled(readExtractionConfig(entorno()))).toBe(true);
    });

    it('no acepta un TTL negativo', () => {
        expect(readExtractionConfig(entorno({ [TTL]: '-1' })).ttlSegundos).toBe(TTL_POR_DEFECTO);
    });
});
