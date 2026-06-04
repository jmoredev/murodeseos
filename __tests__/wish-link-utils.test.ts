import { describe, it, expect } from 'vitest';
import { normalizeWishLink, normalizeWishLinks, truncateWishLink } from '@/lib/wish-link-utils';

describe('wish-link-utils', () => {
    it('adds https when missing', () => {
        expect(normalizeWishLink('tienda.com/item')).toBe('https://tienda.com/item');
    });

    it('keeps existing scheme', () => {
        expect(normalizeWishLink('https://example.com/a')).toBe('https://example.com/a');
    });

    it('deduplicates normalized links', () => {
        expect(normalizeWishLinks(['https://a.com', 'a.com', ''])).toEqual(['https://a.com']);
    });

    it('truncates long URLs for display', () => {
        const short = truncateWishLink('https://www.amazon.es/dp/very-long-product-path', 20);
        expect(short.length).toBeLessThanOrEqual(20);
        expect(short).toContain('…');
    });
});
