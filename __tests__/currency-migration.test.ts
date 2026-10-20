import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const sql = () =>
    readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261020170000_wishlist_items_currency.sql'), 'utf8');

describe('migración de currency (T7 · S6)', () => {
    it('es aditiva: columna nullable, sin DEFAULT ni backfill', () => {
        const s = sql();
        expect(s).toMatch(/add column if not exists currency text/i);
        expect(s).not.toMatch(/currency\s+text[^;]*not null/i);
        expect(s).not.toMatch(/currency\s+text[^;]*default/i);
        expect(s).not.toMatch(/^\s*update\s+public\.wishlist_items/im);
        expect(s).not.toMatch(/set\s+currency\s*=/i);
    });

    it('el CHECK acepta todo lo que la app puede escribir', () => {
        const compacto = sql().replace(/\s+/g, ' ');
        const m = /currency !~ '([^']+)'/.exec(compacto);
        const re = new RegExp(m ? m[1] : '^[A-Z]{3}$');
        for (const code of ['EUR', 'USD', 'GBP', 'ARS', 'MXN']) expect(re.test(code)).toBe(true);
        expect(re.test('eur')).toBe(false);
        expect(re.test('EURO')).toBe(false);
    });
});
