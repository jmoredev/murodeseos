import { supabase } from '@/lib/supabase';

const CACHE_PREFIX = 'murodeseos-';

/**
 * Cierra la sesión del usuario y, en web, vacía las caches del PWA
 * (`murodeseos-*`). Así nada que el service worker pudiera haber guardado
 * sobrevive a la sesión. Solo se tocan las caches con nuestro prefijo: el
 * origen de GitHub Pages se comparte entre repositorios y las caches de otros
 * proyectos no deben enterarse.
 */
export async function signOut(): Promise<void> {
    await supabase.auth.signOut();

    try {
        if (typeof window === 'undefined' || !window.caches) return;
        const names = await caches.keys();
        await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name)));
    } catch {
        /* La sesión ya está cerrada: si la limpieza de caché falla, no romper el flujo */
    }
}
