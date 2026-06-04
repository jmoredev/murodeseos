import { Alert, Linking } from 'react-native';

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

export async function openWishLink(url: string): Promise<void> {
    const normalized = normalizeWishLink(url);
    if (!normalized) {
        Alert.alert('Enlace no válido', 'No se pudo abrir este enlace.');
        return;
    }

    try {
        const canOpen = await Linking.canOpenURL(normalized);
        if (!canOpen) {
            Alert.alert('Enlace no válido', 'No se pudo abrir este enlace.');
            return;
        }
        await Linking.openURL(normalized);
    } catch {
        Alert.alert('Error', 'No se pudo abrir el enlace.');
    }
}
