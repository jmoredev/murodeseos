/**
 * Las pestañas de la pantalla principal y el parámetro de la URL que puede pedir una.
 *
 * El tipo se deriva de la lista para que no haya dos declaraciones que se separen: añadir
 * una pestaña aquí es añadirla en todas partes.
 */
export const TABS = ['groups', 'wishlist', 'profile'] as const;

export type Tab = (typeof TABS)[number];

/**
 * La pestaña que pide la URL, o `null` si no es una de las reales. Un `?tab=` vacío, un
 * valor desconocido o un parámetro repetido no pueden dejar la pantalla sin pestaña activa.
 */
export function parseTabParam(value: string | string[] | undefined): Tab | null {
    const candidate = typeof value === 'string' ? value : '';

    return (TABS as readonly string[]).includes(candidate) ? (candidate as Tab) : null;
}
