import { supabase } from './supabase';

/**
 * Genera los avisos de cumpleaños y onomástico del usuario vía RPC
 * `generate_birthday_reminders` (migración 20260930160000).
 *
 * Es "best-effort" a propósito: la generación de recordatorios no debe romper
 * nunca la pantalla de notificaciones; si el RPC falla (red, timeout, cliente
 * desactualizado), simplemente se registra y se continúa. La generación es
 * idempotente en el servidor, así que se puede reintentar en la próxima carga.
 */
export async function ensureBirthdayReminders(): Promise<void> {
    try {
        const { error } = await supabase.rpc('generate_birthday_reminders');

        if (error) {
            console.error('No se pudieron generar los avisos de cumpleaños/onomástico:', error);
        }
    } catch (err) {
        console.error('No se pudieron generar los avisos de cumpleaños/onomástico:', err);
    }
}
