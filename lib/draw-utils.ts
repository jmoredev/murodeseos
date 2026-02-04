import { supabase } from './supabase';
import { notifySecretSantaDraw } from './notification-utils';

export interface Exclusion {
    user_a_id: string;
    user_b_id: string;
}

/**
 * Realiza el sorteo del Amigo Invisible para un grupo
 */
export async function performDraw(groupId: string, adminId: string) {
    try {
        // 1. Verificar si el usuario es administrador
        const { data: adminCheck, error: adminError } = await supabase
            .from('group_members')
            .select('role')
            .eq('group_id', groupId)
            .eq('user_id', adminId)
            .single();

        if (adminError || adminCheck?.role !== 'admin') {
            throw new Error('Solo el administrador puede realizar el sorteo');
        }

        // 2. Obtener miembros del grupo
        const { data: members, error: membersError } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId);

        if (membersError || !members || members.length < 2) {
            throw new Error('Se necesitan al menos 2 miembros para el sorteo');
        }

        const memberIds = members.map(m => m.user_id);

        // 3. Obtener exclusiones
        const { data: exclusions, error: exclusionsError } = await supabase
            .from('draw_exclusions')
            .select('user_a_id, user_b_id')
            .eq('group_id', groupId);

        if (exclusionsError) throw exclusionsError;

        // 4. Algoritmo de sorteo (Derangement con restricciones)
        const assignments = shuffleAndAssign(memberIds, exclusions || []);

        if (!assignments) {
            throw new Error('No se ha podido encontrar una combinación válida con estas exclusiones');
        }

        // 5. Guardar resultados
        // Primero limpiamos sorteos anteriores del grupo si existen
        await supabase.from('draw_assignments').delete().eq('group_id', groupId);

        const insertData = assignments.map(a => ({
            group_id: groupId,
            giver_id: a.giver,
            receiver_id: a.receiver,
            is_revealed: false
        }));

        const { error: insertError } = await supabase
            .from('draw_assignments')
            .insert(insertData);

        if (insertError) throw insertError;

        // 6. Activar estado de sorteo en el grupo
        await supabase
            .from('groups')
            .update({ is_draw_active: true })
            .eq('id', groupId);

        // 7. Notificar a los miembros
        // Implementaremos esta función en notification-utils
        await notifySecretSantaDraw(groupId, memberIds);

        return true;
    } catch (error) {
        console.error('Error en performDraw:', error);
        throw error;
    }
}

/**
 * Finaliza el Amigo Invisible del grupo
 */
export async function endDraw(groupId: string, adminId: string) {
    try {
        // Verificar admin
        const { data: adminCheck } = await supabase
            .from('group_members')
            .select('role')
            .eq('group_id', groupId)
            .eq('user_id', adminId)
            .single();

        if (adminCheck?.role !== 'admin') {
            throw new Error('Solo el administrador puede finalizar el sorteo');
        }

        // Limpiar asignaciones y desactivar estado
        await supabase.from('draw_assignments').delete().eq('group_id', groupId);
        await supabase.from('groups').update({ is_draw_active: false }).eq('id', groupId);

        return true;
    } catch (error) {
        console.error('Error en endDraw:', error);
        throw error;
    }
}

/**
 * Obtiene todas las asignaciones actuales para un usuario en todos sus grupos
 */
export async function getMyAssignments(userId: string) {
    const { data, error } = await supabase
        .from('draw_assignments')
        .select(`
            id,
            group_id,
            is_revealed,
            receiver:profiles!receiver_id (id, display_name, avatar_url),
            group:groups (name, is_draw_active)
        `)
        .eq('giver_id', userId);

    if (error) throw error;

    // Filtramos para asegurar que solo devolvemos asignaciones de grupos donde el sorteo sigue marcado como activo
    return (data || []).filter((a: any) => a.group.is_draw_active);
}

/**
 * Obtiene la asignación de un usuario en un grupo específico
 */
export async function getMyAssignmentInGroup(userId: string, groupId: string) {
    const { data, error } = await supabase
        .from('draw_assignments')
        .select(`
            id,
            group_id,
            is_revealed,
            receiver:profiles!receiver_id (id, display_name, avatar_url),
            group:groups (name, is_draw_active)
        `)
        .eq('giver_id', userId)
        .eq('group_id', groupId)
        .maybeSingle();

    if (error) throw error;
    if (data && !(data as any).group.is_draw_active) return null;
    return data as any;
}

/**
 * Marca la asignación como revelada (para que no vuelva a saltar el pop-up)
 */
export async function markAsRevealed(assignmentId: string) {
    const { error } = await supabase
        .from('draw_assignments')
        .update({ is_revealed: true })
        .eq('id', assignmentId);

    if (error) throw error;
}

/**
 * Funciones de gestión de exclusiones
 */
export async function getExclusions(groupId: string) {
    const { data, error } = await supabase
        .from('draw_exclusions')
        .select('*')
        .eq('group_id', groupId);

    if (error) throw error;
    return data;
}

export async function addExclusion(groupId: string, userA: string, userB: string) {
    // Ordenamos IDs para evitar duplicados invertidos si fuera necesario, 
    // aunque la lógica bidireccional la manejamos en la comprobación
    const [u1, u2] = [userA, userB].sort();

    const { error } = await supabase
        .from('draw_exclusions')
        .insert({
            group_id: groupId,
            user_a_id: u1,
            user_b_id: u2
        });

    if (error) throw error;
}

export async function removeExclusion(exclusionId: string) {
    const { error } = await supabase
        .from('draw_exclusions')
        .delete()
        .eq('id', exclusionId);

    if (error) throw error;
}

/**
 * Algoritmo de barajado y asignación con restricciones
 * Usa backtrack si es necesario (para grupos pequeños es instantáneo)
 */
function shuffleAndAssign(members: string[], exclusions: Exclusion[]) {
    const receivers = [...members];
    const n = members.length;

    // Función para comprobar si una pareja es válida
    const isValid = (giver: string, receiver: string) => {
        if (giver === receiver) return false;
        return !exclusions.some(e =>
            (e.user_a_id === giver && e.user_b_id === receiver) ||
            (e.user_a_id === receiver && e.user_b_id === giver)
        );
    };

    // Intentamos barajar aleatoriamente unas cuantas veces antes de ir a fuerza bruta/backtrack
    for (let attempt = 0; attempt < 100; attempt++) {
        // Fisher-Yates shuffle
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
        }

        let possible = true;
        for (let i = 0; i < n; i++) {
            if (!isValid(members[i], receivers[i])) {
                possible = false;
                break;
            }
        }

        if (possible) {
            return members.map((m, i) => ({ giver: m, receiver: receivers[i] }));
        }
    }

    // Si llegamos aquí, usamos una aproximación más sistemática (backtrack simple)
    const result: { giver: string, receiver: string }[] = [];
    const used = new Set<string>();

    function solve(index: number): boolean {
        if (index === n) return true;

        const giver = members[index];
        // Barajar opciones disponibles para mantener aleatoriedad
        const options = members.filter(m => !used.has(m));
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        for (const receiver of options) {
            if (isValid(giver, receiver)) {
                result.push({ giver, receiver });
                used.add(receiver);
                if (solve(index + 1)) return true;
                used.delete(receiver);
                result.pop();
            }
        }
        return false;
    }

    if (solve(0)) return result;
    return null;
}
