import { describe, it, expect } from 'vitest';
import { base64ToUint8Array, extensionFromMime, buildWishImageStoragePath } from '@/lib/wish-image-upload';

describe('wish-image-upload', () => {
    it('decodes base64 to bytes', () => {
        const encoded = btoa('hi');
        const bytes = base64ToUint8Array(encoded);
        expect(Array.from(bytes)).toEqual([104, 105]);
    });

    it('resolves extension from mime type', () => {
        expect(extensionFromMime('image/png', null)).toBe('png');
        expect(extensionFromMime('image/jpeg', 'photo.JPG')).toBe('jpg');
    });

    it('builds a storage path under the user folder', () => {
        const path = buildWishImageStoragePath('user-1', 'png');
        expect(path.startsWith('user-1/')).toBe(true);
        expect(path.endsWith('.png')).toBe(true);
    });
});
