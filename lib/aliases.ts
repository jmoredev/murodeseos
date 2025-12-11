import { supabase } from './supabase'

export interface UserAlias {
    target_user_id: string
    alias: string
}

/**
 * Obtiene todos los apodos definidos por el usuario actual.
 * Devuelve un mapa de userId -> alias para búsqueda rápida.
 */
export async function getUserAliases(): Promise<Record<string, string>> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return {}

    const { data, error } = await supabase
        .from('user_aliases')
        .select('target_user_id, alias')
        .eq('owner_id', user.id)

    if (error) {
        console.error('Error fetching aliases:', error)
        return {}
    }

    // Convertir array a objeto mapa: { "user_id": "alias" }
    return data.reduce((acc, item) => {
        acc[item.target_user_id] = item.alias
        return acc
    }, {} as Record<string, string>)
}

/**
 * Establece un apodo para un usuario objetivo.
 * Si el alias está vacío, se podría considerar borrarlo (opcional),
 * pero aquí hacemos upsert.
 */
export async function setUserAlias(targetUserId: string, alias: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    if (!alias.trim()) {
        // Si el alias está vacío, lo borramos
        const { error } = await supabase
            .from('user_aliases')
            .delete()
            .eq('owner_id', user.id)
            .eq('target_user_id', targetUserId)

        return !error
    }

    const { error } = await supabase
        .from('user_aliases')
        .upsert({
            owner_id: user.id,
            target_user_id: targetUserId,
            alias: alias.trim(),
            updated_at: new Date().toISOString() // Force update timestamp
        }, {
            onConflict: 'owner_id, target_user_id'
        })

    if (error) {
        console.error('Error setting alias:', error)
        return false
    }

    return true
}
