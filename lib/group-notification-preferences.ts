import { supabase } from './supabase'

/**
 * Preferencias de aviso por grupo y por usuario.
 *
 * Cada miembro decide, grupo a grupo, qué avisos quiere recibir. La ausencia de
 * fila en la base significa "activado", así que el cliente solo escribe cuando
 * alguien desactiva (o reactiva) un tipo concreto.
 */
export type GroupNotificationType =
    | 'wish_reserved'
    | 'wish_added'
    | 'wish_deleted_by_owner'
    | 'draw_performed'
    | 'birthday'
    | 'name_day';

export interface GroupNotificationOption {
    type: GroupNotificationType;
    label: string;
    description: string;
}

export const GROUP_NOTIFICATION_OPTIONS: GroupNotificationOption[] = [
    {
        type: 'wish_reserved',
        label: 'Se reserva un deseo',
        description: 'Cuando alguien reserva un deseo de otra persona del grupo.',
    },
    {
        type: 'wish_added',
        label: 'Se añade un deseo nuevo',
        description: 'Cuando un miembro del grupo añade un deseo a su lista.',
    },
    {
        type: 'wish_deleted_by_owner',
        label: 'Se borra un deseo',
        description: 'Cuando el dueño elimina un deseo que tenías reservado.',
    },
    {
        type: 'draw_performed',
        label: 'Se realiza el sorteo',
        description: 'Cuando el administrador sortea el Amigo Invisible del grupo.',
    },
    {
        type: 'birthday',
        label: 'Cumpleaños',
        description: 'Cuando se acerca el cumpleaños de otro miembro del grupo.',
    },
    {
        type: 'name_day',
        label: 'Onomástico',
        description: 'Cuando llega el día del santo (onomástico) de otro miembro del grupo.',
    },
];

export type GroupNotificationPreferences = Record<GroupNotificationType, boolean>;

/** Por defecto todo está activado: así es también en la base, donde "sin fila" = activado. */
export function defaultGroupNotificationPreferences(): GroupNotificationPreferences {
    return {
        wish_reserved: true,
        wish_added: true,
        wish_deleted_by_owner: true,
        draw_performed: true,
        birthday: true,
        name_day: true,
    };
}

function isKnownType(value: string): value is GroupNotificationType {
    return GROUP_NOTIFICATION_OPTIONS.some((option) => option.type === value);
}

/** Carga las preferencias del usuario en un grupo, aplicándolas sobre los valores por defecto. */
export async function getGroupNotificationPreferences(
    userId: string,
    groupId: string
): Promise<GroupNotificationPreferences> {
    const preferences = defaultGroupNotificationPreferences();

    const { data, error } = await supabase
        .from('group_notification_preferences')
        .select('notification_type, enabled')
        .eq('user_id', userId)
        .eq('group_id', groupId);

    if (error) throw error;

    for (const row of data ?? []) {
        if (isKnownType(row.notification_type)) {
            preferences[row.notification_type] = row.enabled;
        }
        // Los tipos desconocidos se ignoran: pueden llegar de una build antigua
        // o de una futura migración y no deben romper la carga.
    }

    return preferences;
}

/** Guarda una preferencia concreta. Inserta o actualiza según lo que ya exista. */
export async function setGroupNotificationPreference(
    userId: string,
    groupId: string,
    type: GroupNotificationType,
    enabled: boolean
): Promise<void> {
    const { error } = await supabase
        .from('group_notification_preferences')
        .upsert(
            {
                user_id: userId,
                group_id: groupId,
                notification_type: type,
                enabled,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,group_id,notification_type' }
        );

    if (error) throw error;
}
