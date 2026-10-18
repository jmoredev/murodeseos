import { describe, expect, it } from 'vitest';
import {
    computeQuotaWindow,
    decideQuota,
} from '../../supabase/functions/_shared/product-extraction/quota/decision.ts';

/**
 * La decisión de cuota es pura y vive en un solo sitio; el SQL hace la parte **atómica** (el
 * incremento con `returning`). Estos tests fijan la aritmética de la ventana y del reintento, que
 * es la que el SQL y la función de TS tienen que compartir.
 */

const UNA_HORA_S = 3600;
const INICIO_DE_2026_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

describe('computeQuotaWindow', () => {
    it('alinea la ventana al reloj de época', () => {
        const ahora = Date.UTC(2026, 0, 1, 0, 30, 0);
        expect(computeQuotaWindow(ahora, UNA_HORA_S)).toEqual({
            startMs: INICIO_DE_2026_MS,
            endMs: INICIO_DE_2026_MS + UNA_HORA_S * 1000,
        });
    });

    it('abre una ventana nueva exactamente en el borde', () => {
        const borde = INICIO_DE_2026_MS + UNA_HORA_S * 1000;
        expect(computeQuotaWindow(borde, UNA_HORA_S)).toEqual({
            startMs: borde,
            endMs: borde + UNA_HORA_S * 1000,
        });
    });

    it('cae en la ventana anterior un milisegundo antes del borde', () => {
        const borde = INICIO_DE_2026_MS + UNA_HORA_S * 1000;
        expect(computeQuotaWindow(borde - 1, UNA_HORA_S).startMs).toBe(INICIO_DE_2026_MS);
    });
});

describe('decideQuota', () => {
    const ventanaFin = INICIO_DE_2026_MS + UNA_HORA_S * 1000;

    it('permite mientras no se alcanzó el límite', () => {
        expect(
            decideQuota({ count: 3, limit: 5, nowMs: INICIO_DE_2026_MS, windowEndMs: ventanaFin })
        ).toEqual({ allowed: true, retryAfterSeconds: 0 });
    });

    it('niega al alcanzar el límite y dice cuántos segundos faltan', () => {
        expect(
            decideQuota({
                count: 5,
                limit: 5,
                nowMs: ventanaFin - 120_000,
                windowEndMs: ventanaFin,
            })
        ).toEqual({ allowed: false, retryAfterSeconds: 120 });
    });

    it('redondea hacia arriba los segundos del reintento', () => {
        expect(
            decideQuota({
                count: 5,
                limit: 5,
                nowMs: ventanaFin - 120_001,
                windowEndMs: ventanaFin,
            })
        ).toEqual({ allowed: false, retryAfterSeconds: 121 });
    });

    it('niega si el conteo ya superó el límite', () => {
        expect(
            decideQuota({
                count: 9,
                limit: 5,
                nowMs: INICIO_DE_2026_MS,
                windowEndMs: ventanaFin,
            }).allowed
        ).toBe(false);
    });

    it('con límite cero nunca permite', () => {
        expect(
            decideQuota({ count: 0, limit: 0, nowMs: INICIO_DE_2026_MS, windowEndMs: ventanaFin })
        ).toEqual({ allowed: false, retryAfterSeconds: 3600 });
    });

    it('nunca devuelve un reintento de cero segundos cuando niega', () => {
        // Si la ventana ya venció (reloj movido, valor viejo), reintentar en 0 haría un bucle.
        expect(
            decideQuota({ count: 5, limit: 5, nowMs: ventanaFin, windowEndMs: ventanaFin })
        ).toEqual({ allowed: false, retryAfterSeconds: 1 });
    });
});
