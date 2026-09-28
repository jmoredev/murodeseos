import { describe, expect, it } from 'vitest';
import { parseTabParam, TABS } from '@/lib/tabs';

describe('parseTabParam', () => {
    it('acepta cada una de las pestañas reales', () => {
        for (const tab of TABS) {
            expect(parseTabParam(tab)).toBe(tab);
        }
    });

    it('descarta el parámetro vacío', () => {
        expect(parseTabParam('')).toBeNull();
    });

    it('descarta un valor desconocido', () => {
        expect(parseTabParam('basura')).toBeNull();
    });

    it('descarta el parámetro ausente y el repetido', () => {
        expect(parseTabParam(undefined)).toBeNull();
        expect(parseTabParam(['groups', 'wishlist'])).toBeNull();
    });
});
