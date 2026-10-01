import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    DEFAULT_REMINDER_LEAD_DAYS,
    ensureBirthdayReminders,
    getGroupReminderLeadDays,
    setGroupReminderLeadDays,
} from '@/lib/reminder-utils';
import { supabase } from '@/lib/supabase';

describe('ensureBirthdayReminders', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        // El mock global de Supabase no declara `rpc`; se añade aquí.
        (supabase as any).rpc = vi.fn();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('llama a supabase.rpc una única vez con el nombre exacto de la función', async () => {
        (supabase as any).rpc.mockResolvedValue({ error: null });

        await ensureBirthdayReminders();

        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        expect(supabase.rpc).toHaveBeenCalledWith('generate_birthday_reminders');
    });

    it('resuelve sin error cuando el RPC tiene éxito', async () => {
        (supabase as any).rpc.mockResolvedValue({ error: null });

        await expect(ensureBirthdayReminders()).resolves.toBeUndefined();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('no lanza cuando el RPC devuelve error y lo reporta por consola', async () => {
        const failure = { code: '42883', message: 'function generate_birthday_reminders() does not exist' };
        (supabase as any).rpc.mockResolvedValue({ error: failure });

        await expect(ensureBirthdayReminders()).resolves.toBeUndefined();

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('cumpleaños'),
            failure
        );
    });

    it('no propaga la excepción cuando el propio RPC rechaza', async () => {
        const thrown = new Error('network down');
        (supabase as any).rpc.mockRejectedValue(thrown);

        await expect(ensureBirthdayReminders()).resolves.toBeUndefined();

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('cumpleaños'),
            thrown
        );
    });
});

describe('getGroupReminderLeadDays', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // El mock global de Supabase no declara la cadena que necesita el lector:
    // se monta una mínima por test (patrón de wish-reservation.test.ts).
    function stubReaderChain(maybeSingle: ReturnType<typeof vi.fn>) {
        const chain: Record<string, any> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = maybeSingle;
        vi.mocked(supabase.from).mockReturnValue(chain as any);
        return chain;
    }

    it('devuelve el lead_days persistido para ese (user_id, group_id)', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({ data: { lead_days: 30 }, error: null });
        const { select, eq } = stubReaderChain(maybeSingle);

        await expect(getGroupReminderLeadDays('user-1', 'grupo-1')).resolves.toBe(30);

        expect(supabase.from).toHaveBeenCalledWith('group_reminder_settings');
        expect(select).toHaveBeenCalledWith('lead_days');
        expect(eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
        expect(eq).toHaveBeenNthCalledWith(2, 'group_id', 'grupo-1');
        expect(maybeSingle).toHaveBeenCalledTimes(1);
    });

    it('resuelve 15 cuando no hay fila, igual que el coalesce del RPC', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        stubReaderChain(maybeSingle);

        await expect(getGroupReminderLeadDays('user-1', 'grupo-1')).resolves.toBe(15);

        // Contra-regresión: la constante compartida no puede desviarse del default de la base.
        expect(DEFAULT_REMINDER_LEAD_DAYS).toBe(15);
    });

    it('propaga el error de PostgREST en la lectura', async () => {
        const failure = { code: '42501', message: 'row-level security policy' };
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: failure });
        stubReaderChain(maybeSingle);

        await expect(getGroupReminderLeadDays('user-1', 'grupo-1')).rejects.toBe(failure);
    });
});

describe('setGroupReminderLeadDays', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('hace upsert con la clave compuesta exacta y envía updated_at', async () => {
        const upsert = vi.fn().mockResolvedValue({ error: null });
        vi.mocked(supabase.from).mockReturnValue({ upsert } as any);

        await expect(setGroupReminderLeadDays('user-1', 'grupo-1', 30)).resolves.toBeUndefined();

        expect(supabase.from).toHaveBeenCalledWith('group_reminder_settings');
        expect(upsert).toHaveBeenCalledTimes(1);
        const [payload, options] = upsert.mock.calls[0];
        expect(payload).toMatchObject({ user_id: 'user-1', group_id: 'grupo-1', lead_days: 30 });
        // `updated_at` se fija en cliente: la tabla no tiene trigger.
        expect(typeof payload.updated_at).toBe('string');
        expect(Number.isNaN(Date.parse(payload.updated_at))).toBe(false);
        expect(options).toEqual({ onConflict: 'user_id,group_id' });
    });

    it('propaga el error de PostgREST en la escritura', async () => {
        const failure = { code: '42501', message: 'row-level security policy' };
        const upsert = vi.fn().mockResolvedValue({ error: failure });
        vi.mocked(supabase.from).mockReturnValue({ upsert } as any);

        await expect(setGroupReminderLeadDays('user-1', 'grupo-1', 30)).rejects.toBe(failure);
    });

    it('acepta los límites del CHECK (1 y 365) y sí llegan a Supabase', async () => {
        const upsert = vi.fn().mockResolvedValue({ error: null });
        vi.mocked(supabase.from).mockReturnValue({ upsert } as any);

        await expect(setGroupReminderLeadDays('user-1', 'grupo-1', 1)).resolves.toBeUndefined();
        await expect(setGroupReminderLeadDays('user-1', 'grupo-1', 365)).resolves.toBeUndefined();

        expect(upsert).toHaveBeenCalledTimes(2);
        expect(upsert.mock.calls[0][0].lead_days).toBe(1);
        expect(upsert.mock.calls[1][0].lead_days).toBe(365);
    });

    it('rechaza valores inválidos sin llamar a Supabase en absoluto', async () => {
        // El clearAllMocks del beforeEach deja `from` sin llamadas registradas:
        // cualquier llamada aquí delataría una validación tardía.
        for (const invalid of [0, -1, 366, 15.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            await expect(setGroupReminderLeadDays('user-1', 'grupo-1', invalid)).rejects.toThrow(
                /integer between 1 and 365/
            );
        }

        expect(supabase.from).not.toHaveBeenCalled();
    });
});
