import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    TOUR_FLAG_TIMEOUT_MS,
    markTourCompleted,
    readTourCompletedAt,
    shouldStartTour,
    type TourFlagDb,
    type TourFlagRow,
} from '@/lib/tour/flag';

/**
 * La marca del tour en el perfil (D2, D3) y la decisión de arranque (S1).
 *
 * Lo que se ancla aquí son las **tres** respuestas que el arranque sabe distinguir, porque
 * confundirlas es enseñar el tour a quien ya lo vio o empezarlo sin saber nada:
 *
 * - `null` → cuenta nueva, el tour empieza (D3: la condición es una sola, `tour_completed_at IS NULL`).
 * - una fecha → ya lo vio, no se vuelve a enseñar (aguanta cambiar de móvil o reinstalar, D2).
 * - `undefined` → no se pudo saber (fila ausente, error, plazo agotado): nunca arranca y nunca se
 *   reintenta en bucle.
 *
 * La base se dobla: esto no habla con la red, y el plazo se comprueba con relojes falsos para no
 * tardar doce segundos de verdad.
 */

const FECHA = '2026-10-24T13:00:00.000Z';

/** Lo que devuelve una lectura. `data: null` es «no hay fila», que no es lo mismo que «sin fecha». */
type Lectura = { data: TourFlagRow | null; error: { message: string } | null };

function bdDeLectura(lectura: Lectura | (() => Promise<Lectura>)): TourFlagDb {
    const responder = typeof lectura === 'function' ? lectura : async () => lectura;

    return {
        from: () => ({
            select: () => ({
                eq: () => ({ maybeSingle: responder }),
            }),
            update: () => ({ eq: async () => ({ error: null }) }),
        }),
    };
}

type Escritura = { valores: { tour_completed_at: string }; usuario: string };

function bdDeEscritura(
    responder: () => Promise<{ error: { message: string } | null }>,
    escrituras: Escritura[] = []
): TourFlagDb {
    return {
        from: () => ({
            select: () => ({
                eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
            update: (valores) => ({
                eq: async (_columna, usuario) => {
                    escrituras.push({ valores, usuario });

                    return responder();
                },
            }),
        }),
    };
}

/** Una base que acepta la consulta y no responde nunca: el caso del plazo agotado. */
function bdColgada(): TourFlagDb {
    return bdDeLectura(() => new Promise<Lectura>(() => {}));
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('readTourCompletedAt: las tres respuestas de la marca', () => {
    it('una cuenta nueva devuelve null (todavía no lo vio)', async () => {
        const bd = bdDeLectura({ data: { tour_completed_at: null }, error: null });

        await expect(readTourCompletedAt(bd, 'user-1')).resolves.toBeNull();
    });

    it('una cuenta que ya lo vio devuelve la fecha guardada', async () => {
        const bd = bdDeLectura({ data: { tour_completed_at: FECHA }, error: null });

        await expect(readTourCompletedAt(bd, 'user-1')).resolves.toBe(FECHA);
    });

    it('sin fila de perfil devuelve undefined: no se sabe', async () => {
        const bd = bdDeLectura({ data: null, error: null });

        await expect(readTourCompletedAt(bd, 'user-1')).resolves.toBeUndefined();
    });

    it('un error de la consulta (o un permiso denegado) devuelve undefined: no se sabe', async () => {
        const bd = bdDeLectura({ data: null, error: { message: 'permission denied' } });

        await expect(readTourCompletedAt(bd, 'user-1')).resolves.toBeUndefined();
    });

    it('una consulta que se cuelga no deja el arranque esperando: undefined al agotarse el plazo', async () => {
        vi.useFakeTimers();

        const lectura = readTourCompletedAt(bdColgada(), 'user-1');

        await vi.advanceTimersByTimeAsync(TOUR_FLAG_TIMEOUT_MS);

        await expect(lectura).resolves.toBeUndefined();
        // El plazo se retira al responder: no queda un temporizador vivo por cada arranque.
        expect(vi.getTimerCount()).toBe(0);
    });

    it('una lectura fallida nunca arranca el tour y no se reintenta', async () => {
        const responder = vi.fn(async (): Promise<Lectura> => ({
            data: null,
            error: { message: 'network down' },
        }));

        const bandera = await readTourCompletedAt(bdDeLectura(responder), 'user-1');

        expect(shouldStartTour(bandera)).toBe(false);
        // Una sola consulta: el arranque no insiste en bucle contra una base que falla.
        expect(responder).toHaveBeenCalledTimes(1);
    });
});

describe('shouldStartTour: sólo las cuentas nuevas', () => {
    it('arranca con null, que es «tour_completed_at IS NULL»', () => {
        expect(shouldStartTour(null)).toBe(true);
    });

    it('no arranca con una fecha: ya lo vio', () => {
        expect(shouldStartTour(FECHA)).toBe(false);
    });

    it('no arranca cuando no se pudo saber (undefined)', () => {
        expect(shouldStartTour(undefined)).toBe(false);
    });
});

describe('markTourCompleted: marcar es best-effort', () => {
    it('escribe la fecha en el perfil de ese usuario y dice que fue bien', async () => {
        const escrituras: Escritura[] = [];

        await expect(
            markTourCompleted(
                bdDeEscritura(async () => ({ error: null }), escrituras),
                'user-1'
            )
        ).resolves.toBe(true);

        expect(escrituras).toHaveLength(1);
        expect(escrituras[0].usuario).toBe('user-1');
        expect(Number.isNaN(Date.parse(escrituras[0].valores.tour_completed_at))).toBe(false);
    });

    it('si la escritura falla devuelve false, avisa una vez y no lanza', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(
            markTourCompleted(
                bdDeEscritura(async () => ({ error: { message: 'permission denied' } })),
                'user-1'
            )
        ).resolves.toBe(false);

        expect(error).toHaveBeenCalledTimes(1);
    });

    it('si la base revienta devuelve false, avisa una vez y no lanza', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(
            markTourCompleted(
                bdDeEscritura(async () => {
                    throw new Error('sin red');
                }),
                'user-1'
            )
        ).resolves.toBe(false);

        expect(error).toHaveBeenCalledTimes(1);
    });
});
