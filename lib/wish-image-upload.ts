import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export function extensionFromMime(mimeType: string | undefined, fileName?: string | null): string {
    const fromName = fileName?.split('.').pop()?.split('?')[0]?.toLowerCase();
    if (fromName && ALLOWED_EXTENSIONS.has(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;

    const mime = (mimeType || '').toLowerCase();
    if (mime.includes('png')) return 'png';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('gif')) return 'gif';
    return 'jpg';
}

export function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export type WishImageUploadPayload = {
    body: Blob | File | Uint8Array;
    contentType: string;
    extension: string;
};

export async function resolveWishImageUploadPayload(
    source: ImagePickerAsset | File
): Promise<WishImageUploadPayload> {
    if (source instanceof File) {
        const contentType = source.type || 'image/jpeg';
        return {
            body: source,
            contentType,
            extension: extensionFromMime(contentType, source.name),
        };
    }

    const asset = source;
    if (asset.file) {
        const contentType = asset.mimeType || asset.file.type || 'image/jpeg';
        return {
            body: asset.file,
            contentType,
            extension: extensionFromMime(contentType, asset.fileName),
        };
    }

    if (asset.base64) {
        const contentType = asset.mimeType || 'image/jpeg';
        return {
            body: base64ToUint8Array(asset.base64),
            contentType,
            extension: extensionFromMime(contentType, asset.fileName),
        };
    }

    const res = await fetch(asset.uri);
    if (!res.ok) {
        throw new Error('No se pudo leer la imagen seleccionada.');
    }
    const blob = await res.blob();
    const contentType = asset.mimeType || blob.type || 'image/jpeg';
    return {
        body: blob,
        contentType,
        extension: extensionFromMime(contentType, asset.fileName),
    };
}

export type PickWishImageResult =
    | { status: 'ok'; asset: ImagePickerAsset }
    | { status: 'canceled' }
    | { status: 'denied' };

export async function pickWishImageAsset(): Promise<PickWishImageResult> {
    if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            return { status: 'denied' };
        }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        base64: Platform.OS !== 'web',
    });

    if (result.canceled || !result.assets[0]) return { status: 'canceled' };
    return { status: 'ok', asset: result.assets[0] };
}

export function buildWishImageStoragePath(userId: string, extension: string): string {
    const safeExt = ALLOWED_EXTENSIONS.has(extension) ? extension : 'jpg';
    return `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${safeExt}`;
}
