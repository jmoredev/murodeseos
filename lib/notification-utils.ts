import { supabase } from './supabase'

export type NotificationType = 'wish_added' | 'wish_reserved' | 'draw_performed';

export interface Notification {
    id: string;
    user_id: string;
    actor_id: string;
    group_id?: string;
    wish_id?: string;
    type: NotificationType;
    is_read: boolean;
    created_at: string;
    // Opcionales para join
    actor?: {
        display_name: string;
        avatar_url: string;
    };
    group?: {
        name: string;
    };
    wish?: {
        title: string;
    };
}

/**
 * Notifica a los miembros de los grupos del usuario cuando se añade un deseo
 */
export async function notifyWishAdded(actorId: string, wishId: string, excludedGroupIds: string[] = []) {
    try {
        // 1. Obtener todos los grupos a los que pertenece el autor
        const { data: authorGroups, error: groupsError } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', actorId);

        if (groupsError || !authorGroups) throw groupsError;

        const groupIds = authorGroups
            .map(g => g.group_id)
            .filter(id => !excludedGroupIds.includes(id));

        if (groupIds.length === 0) return;

        // 2. Obtener todos los miembros de esos grupos (excepto el autor)
        const { data: members, error: membersError } = await supabase
            .from('group_members')
            .select('user_id, group_id')
            .in('group_id', groupIds)
            .neq('user_id', actorId);

        if (membersError || !members) throw membersError;

        // 3. Crear notificaciones (evitando duplicados si alguien está en varios grupos)
        const uniqueRecipients = new Map<string, string>(); // userId -> groupId (para referencia)
        members.forEach(m => {
            if (!uniqueRecipients.has(m.user_id)) {
                uniqueRecipients.set(m.user_id, m.group_id);
            }
        });

        const notifications = Array.from(uniqueRecipients.entries()).map(([userId, groupId]) => ({
            user_id: userId,
            actor_id: actorId,
            group_id: groupId,
            wish_id: wishId,
            type: 'wish_added' as NotificationType
        }));

        if (notifications.length > 0) {
            const { error: notifyError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (notifyError) throw notifyError;
        }
    } catch (error) {
        console.error('Error in notifyWishAdded:', error);
    }
}

/**
 * Notifica a los miembros de grupos compartidos cuando se reserva un deseo
 */
export async function notifyWishReserved(actorId: string, wishId: string) {
    try {
        // 1. Obtener el dueño del deseo
        const { data: wish, error: wishError } = await supabase
            .from('wishlist_items')
            .select('user_id, title')
            .eq('id', wishId)
            .single();

        if (wishError || !wish) throw wishError;
        const ownerId = wish.user_id;

        // 2. Obtener grupos comunes entre el actor y el dueño
        const { data: actorGroups } = await supabase.from('group_members').select('group_id').eq('user_id', actorId);
        const { data: ownerGroups } = await supabase.from('group_members').select('group_id').eq('user_id', ownerId);

        if (!actorGroups || !ownerGroups) return;

        const commonGroupIds = actorGroups
            .map(g => g.group_id)
            .filter(id => ownerGroups.some(og => og.group_id === id));

        if (commonGroupIds.length === 0) return;

        // 3. Obtener miembros de esos grupos comunes
        // Excluimos: al actor (él ya sabe que reservó) y al dueño (SORPRESA!)
        const { data: members, error: membersError } = await supabase
            .from('group_members')
            .select('user_id, group_id')
            .in('group_id', commonGroupIds)
            .neq('user_id', actorId)
            .neq('user_id', ownerId);

        if (membersError || !members) throw membersError;

        // 4. Crear notificaciones
        const uniqueRecipients = new Map<string, string>();
        members.forEach(m => {
            if (!uniqueRecipients.has(m.user_id)) {
                uniqueRecipients.set(m.user_id, m.group_id);
            }
        });

        const notifications = Array.from(uniqueRecipients.entries()).map(([userId, groupId]) => ({
            user_id: userId,
            actor_id: actorId,
            group_id: groupId,
            wish_id: wishId,
            type: 'wish_reserved' as NotificationType
        }));

        if (notifications.length > 0) {
            const { error: notifyError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (notifyError) throw notifyError;
        }
    } catch (error) {
        console.error('Error in notifyWishReserved:', error);
    }
}

/**
 * Obtiene las notificaciones del usuario con datos relacionados
 */
export async function getNotifications(userId: string, limit = 20) {
    const { data, error } = await supabase
        .from('notifications')
        .select(`
            *,
            actor:profiles!actor_id(display_name, avatar_url),
            group:groups(name),
            wish:wishlist_items(title)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data as unknown as Notification[];
}

/**
 * Marca una notificación como leída
 */
export async function markAsRead(notificationId: string) {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

    if (error) throw error;
}

/**
 * Marca todas las notificaciones del usuario como leídas
 */
export async function markAllAsRead(userId: string) {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    if (error) throw error;
}
/**
 * Notifica a todos los miembros de un grupo que se ha realizado el sorteo del Amigo Invisible
 */
export async function notifySecretSantaDraw(groupId: string, memberIds: string[]) {
    try {
        // Obtenemos el admin (el que lanza el sorteo)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const notifications = memberIds.map(userId => ({
            user_id: userId,
            actor_id: user.id,
            group_id: groupId,
            type: 'draw_performed' as NotificationType
        }));

        if (notifications.length > 0) {
            const { error: notifyError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (notifyError) throw notifyError;
        }
    } catch (error) {
        console.error('Error in notifySecretSantaDraw:', error);
    }
}
