import { Linking } from 'react-native';

export function normalizeWishLink(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

export function normalizeWishLinks(links: string[]): string[] {
    const normalized: string[] = [];
    for (const link of links) {
        const value = normalizeWishLink(link);
        if (value && !normalized.includes(value)) {
            normalized.push(value);
        }
    }
    return normalized;
}

/**
 * El **dominio** de un enlace, sin esquema ni `www`.
 *
 * Es lo que se pinta en la tarjeta, donde el ancho es escaso: `amazon.es` cabe y
 * se lee, mientras que la ruta completa (hasta 36 caracteres) se recortaba. El
 * enlace real **no se muestra nunca**; este es el nombre visible y la base del
 * nombre que se anuncia a quien usa un lector de pantalla.
 */
export function wishLinkHost(url: string): string {
    try {
        const normalized = url.startsWith('http') ? url : `https://${url}`;
        return new URL(normalized).hostname.replace(/^www\./, '') || url;
    } catch {
        return url;
    }
}

export function truncateWishLink(url: string, maxLength = 36): string {
    try {
        const normalized = url.startsWith('http') ? url : `https://${url}`;
        const parsed = new URL(normalized);
        const host = parsed.hostname.replace(/^www\./, '');
        const path = parsed.pathname === '/' ? '' : parsed.pathname;
        const display = path ? `${host}${path}` : host;
        if (display.length <= maxLength) return display;
        return `${display.slice(0, maxLength - 1)}…`;
    } catch {
        if (url.length <= maxLength) return url;
        return `${url.slice(0, maxLength - 1)}…`;
    }
}

// Resultado discriminado: el módulo no puede mostrar UI (no hay hooks aquí),
// así que informa al llamador y la vista decide cómo avisar (p. ej. un toast).
export type WishLinkOpenResult = { ok: true } | { ok: false; message: string };

export async function openWishLink(url: string): Promise<WishLinkOpenResult> {
    const normalized = normalizeWishLink(url);
    if (!normalized) {
        return { ok: false, message: 'No se pudo abrir este enlace.' };
    }

    try {
        const canOpen = await Linking.canOpenURL(normalized);
        if (!canOpen) {
            return { ok: false, message: 'No se pudo abrir este enlace.' };
        }
        await Linking.openURL(normalized);
        return { ok: true };
    } catch {
        return { ok: false, message: 'No se pudo abrir el enlace.' };
    }
}
