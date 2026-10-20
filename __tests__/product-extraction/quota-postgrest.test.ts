import { describe, expect, it, vi } from 'vitest';
import { consumirCuota } from '../../supabase/functions/_shared/product-extraction/quota/postgrest';
import type { QuotaFetch } from '../../supabase/functions/_shared/product-extraction/quota/postgrest';
import { computeQuotaWindow } from '../../supabase/functions/_shared/product-extraction/quota/decision';

/**
 * El consumo de cuota es un RPC por PostgREST, y el handler lo espera **antes** de pedir la
 * página: sin timeout, un PostgREST que acepta la conexión y no contesta deja la petición
 * colgada para siempre. Estas pruebas fijan el contrato exacto con PostgREST (URL, método,
 * cabeceras y cuerpo) y el tope de espera, que devuelve `null` —el `503 quota-unavailable` que
 * documenta la Edge Function— y nunca una excepción.
 */

const URL_BASE = 'https://proyecto.supabase.co';
const CLAVE = 'service-role-key';
const USER_ID = '9f1c1c3e-0000-4000-8000-000000000000';
const URL_RPC = `${URL_BASE}/rest/v1/rpc/consume_product_extraction_quota`;
const LIMITE = 30;
const VENTANA_S = 3600;

/** `ahoraMs` fijo: la ventana de respaldo tiene que ser predecible. */
const AHORA_MS = Date.parse('2026-10-19T10:30:00.000Z');
const FIN_DE_VENTANA = computeQuotaWindow(AHORA_MS, VENTANA_S).endMs;

const PARAMS = {
    supabaseUrl: URL_BASE,
    serviceRoleKey: CLAVE,
    userId: USER_ID,
    limite: LIMITE,
    ventanaSegundos: VENTANA_S,
    ahoraMs: AHORA_MS,
};

/** Una respuesta JSON como la de PostgREST. */
function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function fetchQueResponde(body: unknown, status = 200) {
    return vi.fn<QuotaFetch>(async () => jsonResponse(body, status));
}

/**
 * Un `fetch` que **nunca responde** pero honra la señal, como el de verdad: solo se destraba
 * cuando el `signal` que le pasan aborta. Es lo que distingue un timeout real de un mock que
 * devuelve una promesa ya resuelta.
 */
function fetchQueNoResponde() {
    return vi.fn<QuotaFetch>(
        (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            })
    );
}

describe('consumir cuota por PostgREST', () => {
    it('llama al RPC con el mismo contrato que la Edge Function', async () => {
        const fetchImpl = fetchQueResponde([
            { allowed: true, used: 3, window_end: '2026-10-19T11:00:00.000Z' },
        ]);

        await consumirCuota({ ...PARAMS, fetchImpl });

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0];

        expect(url).toBe(URL_RPC);
        expect(init.method).toBe('POST');
        expect(init.headers.apikey).toBe(CLAVE);
        expect(init.headers.authorization).toBe(`Bearer ${CLAVE}`);
        expect(init.headers['content-type']).toBe('application/json');
        expect(init.headers.accept).toBe('application/json');
        // Los nombres de los parámetros son los del SQL: cambiarlos rompe el RPC.
        expect(JSON.parse(init.body as string)).toEqual({
            p_user_id: USER_ID,
            p_limit: LIMITE,
            p_window_seconds: VENTANA_S,
        });
        // La señal que hace cancelable un `fetch` de verdad.
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('traduce la fila del RPC al resultado que consume el handler', async () => {
        const fetchImpl = fetchQueResponde([
            { allowed: false, used: LIMITE, window_end: '2026-10-19T11:00:00.000Z' },
        ]);

        await expect(consumirCuota({ ...PARAMS, fetchImpl })).resolves.toEqual({
            allowed: false,
            used: LIMITE,
            windowEndMs: Date.parse('2026-10-19T11:00:00.000Z'),
        });
    });

    it('acepta una fila suelta, no solo una lista', async () => {
        // PostgREST devuelve una lista para `returns table`, pero el contrato toleraba la fila
        // suelta y eso se conserva tal cual.
        const fetchImpl = fetchQueResponde({
            allowed: true,
            used: 1,
            window_end: '2026-10-19T11:00:00.000Z',
        });

        await expect(consumirCuota({ ...PARAMS, fetchImpl })).resolves.toEqual({
            allowed: true,
            used: 1,
            windowEndMs: Date.parse('2026-10-19T11:00:00.000Z'),
        });
    });

    it('una respuesta sin «used» ni fecha usable no inventa datos: usa 0 y la ventana de respaldo', async () => {
        const fetchImpl = fetchQueResponde({ allowed: true, used: 'mucho', window_end: 'no-es-fecha' });

        await expect(consumirCuota({ ...PARAMS, fetchImpl })).resolves.toEqual({
            allowed: true,
            used: 0,
            windowEndMs: FIN_DE_VENTANA,
        });
    });

    it('una respuesta no-ok es null (el handler la convierte en 503)', async () => {
        const fetchImpl = fetchQueResponde({ message: 'boom' }, 500);

        await expect(consumirCuota({ ...PARAMS, fetchImpl })).resolves.toBeNull();
    });

    it('una respuesta mal formada es null', async () => {
        for (const cuerpo of [{}, [], [null], [{ used: 1 }], [{ allowed: 'sí' }], null]) {
            const fetchImpl = fetchQueResponde(cuerpo);
            await expect(consumirCuota({ ...PARAMS, fetchImpl })).resolves.toBeNull();
        }
    });

    it('un fallo de red es null, no una excepción', async () => {
        const fetchImpl = vi.fn<QuotaFetch>(async () => {
            throw new TypeError('Failed to fetch');
        });

        await expect(consumirCuota({ ...PARAMS, fetchImpl })).resolves.toBeNull();
    });

    it('un PostgREST que no responde corta por timeout y es null, no un cuelgue', async () => {
        const fetchImpl = fetchQueNoResponde();

        await expect(
            consumirCuota({ ...PARAMS, fetchImpl, timeoutMs: 25 })
        ).resolves.toBeNull();
    });
});
