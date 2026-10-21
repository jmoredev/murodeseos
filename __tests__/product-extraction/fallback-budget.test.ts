import { describe, expect, it } from 'vitest';
import { consumirRespaldo } from '../../supabase/functions/_shared/product-extraction/fallback/postgrest.ts';
import type { QuotaFetch } from '../../supabase/functions/_shared/product-extraction/quota/postgrest.ts';

/**
 * Presupuesto del respaldo: el RPC es el que decide, y acá se prueba lo que la Edge Function no
 * puede probar por sí sola (usa `Deno`): la petición que se manda, la lectura de la respuesta y
 * qué significa cada fallo.
 *
 * La regla que importa: **si no se puede saber, no se gasta**. Con 1.000 créditos al mes, un `null`
 * tratado como «adelante» convertiría un PostgREST caído en una factura.
 */

const BASE = {
    supabaseUrl: 'https://proj.supabase.co',
    serviceRoleKey: 'service-role',
    userId: 'a3f1c1e2-0000-4000-8000-000000000001',
    limite: 20,
    ventanaSegundos: 2_592_000,
    ahoraMs: Date.parse('2026-10-21T10:00:00.000Z'),
};

function respuesta(cuerpo: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        json: async () => cuerpo,
    } as unknown as Response;
}

describe('consumirRespaldo', () => {
    it('manda la petición al RPC propio con el límite y la ventana de 30 días', async () => {
        let capturado: { url: string; init: { body?: string; method?: string } } | null = null;
        const fetchFalso: QuotaFetch = async (url, init) => {
            capturado = { url, init };
            return respuesta([{ allowed: true, used: 1, window_end: '2026-11-20T00:00:00.000Z' }]);
        };

        const resultado = await consumirRespaldo({ ...BASE, fetchImpl: fetchFalso });

        // `capturado` se asigna dentro del doble, y TypeScript no ve esa asignación: se castea,
        // igual que en `net.test.ts`, en vez de silenciar con `!`.
        const pedido = capturado as unknown as {
            url: string;
            init: { method?: string; body?: string };
        };
        expect(pedido.url).toBe('https://proj.supabase.co/rest/v1/rpc/consume_product_fallback');
        expect(pedido.init.method).toBe('POST');
        expect(JSON.parse(pedido.init.body ?? '{}')).toEqual({
            p_user_id: BASE.userId,
            p_limit: 20,
            p_window_seconds: 2_592_000,
        });
        expect(resultado).toEqual({
            allowed: true,
            used: 1,
            windowEndMs: Date.parse('2026-11-20T00:00:00.000Z'),
        });
    });

    it('respeta un rechazo del RPC y devuelve cuántos se usaron', async () => {
        const fetchFalso: QuotaFetch = async () =>
            respuesta([{ allowed: false, used: 20, window_end: '2026-11-20T00:00:00.000Z' }]);

        const resultado = await consumirRespaldo({ ...BASE, fetchImpl: fetchFalso });

        expect(resultado?.allowed).toBe(false);
        expect(resultado?.used).toBe(20);
    });

    it('acepta la fila suelta, no solo la lista', async () => {
        const fetchFalso: QuotaFetch = async () =>
            respuesta({ allowed: true, used: 2, window_end: '2026-11-20T00:00:00.000Z' });

        const resultado = await consumirRespaldo({ ...BASE, fetchImpl: fetchFalso });

        expect(resultado?.allowed).toBe(true);
        expect(resultado?.used).toBe(2);
    });

    it('devuelve null cuando el RPC no está disponible: no se gasta', async () => {
        const conError: QuotaFetch = async () => respuesta({ message: 'nope' }, false, 503);

        expect(await consumirRespaldo({ ...BASE, fetchImpl: conError })).toBeNull();
    });

    it('devuelve null con un cuerpo que no se puede leer', async () => {
        const raro: QuotaFetch = async () => respuesta([{ nada: true }]);

        expect(await consumirRespaldo({ ...BASE, fetchImpl: raro })).toBeNull();
    });

    it('devuelve null si la red o el tiempo fallan, sin tirar', async () => {
        const revienta: QuotaFetch = async () => {
            throw new Error('boom');
        };

        await expect(consumirRespaldo({ ...BASE, fetchImpl: revienta })).resolves.toBeNull();
    });
});
