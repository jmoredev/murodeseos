import { Linking } from 'react-native';

/** Lo máximo que se pinta de un dominio en la tarjeta; por encima, se recorta con `…`. */
const DOMINIO_MAXIMO = 24;

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
 * El **dominio** de un enlace, sin esquema ni `www`, recortado con puntos suspensivos si
 * pasa de `maxLength`.
 *
 * Es lo que se pinta en la tarjeta, donde el ancho es escaso: `amazon.es` cabe y se lee,
 * mientras que la ruta completa (hasta 36 caracteres) se recortaba. El enlace real **no
 * se muestra nunca**; el nombre accesible del botón sí lleva el dominio entero.
 *
 * El recorte se hace **aquí y no en el CSS** a propósito: así el texto visible es
 * determinista y se puede probar, en vez de depender de la elipsis del navegador.
 *
 * La normalización se delega en `normalizeWishLink`, que ya vive en este módulo, en vez
 * de repetir un `startsWith('http')` que además es sensible a mayúsculas (`HTTP://x`
 * acababa convertido en `https://HTTP://x`).
 */
export function wishLinkHost(url: string, maxLength = DOMINIO_MAXIMO): string {
    const normalized = normalizeWishLink(url);
    if (!normalized) return '';

    try {
        const host = new URL(normalized).hostname.replace(/^www\./, '');
        if (!host) return url;
        return host.length <= maxLength ? host : `${host.slice(0, maxLength - 1)}…`;
    } catch {
        return url;
    }
}

export function truncateWishLink(url: string, maxLength = 36): string {
    const normalized = normalizeWishLink(url);
    if (!normalized) return '';

    try {
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
