import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ensureBirthdayReminders } from '@/lib/reminder-utils';
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
