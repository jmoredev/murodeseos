import { supabase } from './supabase';

/**
 * Antelación por defecto de los avisos: replica el `coalesce(s.lead_days, 15)`
 * del RPC `generate_birthday_reminders` y el default de la columna.
 * La UI y el validador comparten esta única fuente de verdad.
 */
export const DEFAULT_REMINDER_LEAD_DAYS = 15;

/** Límites válidos de `lead_days`: replican el CHECK `group_reminder_settings_lead_days_check`. */
export const MIN_REMINDER_LEAD_DAYS = 1;
export const MAX_REMINDER_LEAD_DAYS = 365;

/**
 * Lee la antelación configurada por el usuario para un grupo. Si no hay fila se
 * resuelve con el valor por defecto (15), igual que hace el RPC en el servidor.
 */
export async function getGroupReminderLeadDays(userId: string, groupId: string): Promise<number> {
    const { data, error } = await supabase
        .from('group_reminder_settings')
        .select('lead_days')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .maybeSingle();

    if (error) throw error;

    return data?.lead_days ?? DEFAULT_REMINDER_LEAD_DAYS;
}

/**
 * Guarda la antelación del usuario en un grupo (upsert por la clave compuesta
 * `(user_id, group_id)`). La validación se hace antes de tocar la red: el CHECK
 * de la base rechazaría el valor con 23514 y la UI solo podría mostrar un error
 * genérico. No se recorta en silencio: la UI valida y la capa de datos falla rápido.
 */
export async function setGroupReminderLeadDays(
    userId: string,
    groupId: string,
    leadDays: number
): Promise<void> {
    if (
        !Number.isInteger(leadDays) ||
        leadDays < MIN_REMINDER_LEAD_DAYS ||
        leadDays > MAX_REMINDER_LEAD_DAYS
    ) {
        throw new Error(
            `leadDays must be an integer between ${MIN_REMINDER_LEAD_DAYS} and ${MAX_REMINDER_LEAD_DAYS}`
        );
    }

    const { error } = await supabase
        .from('group_reminder_settings')
        .upsert(
            {
                user_id: userId,
                group_id: groupId,
                lead_days: leadDays,
                // No hay trigger en la tabla: `updated_at` se fija en cliente.
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,group_id' }
        );

    if (error) throw error;
}

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
