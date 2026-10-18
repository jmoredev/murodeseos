import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El endpoint `extract-product` **no verifica firmas por su cuenta**: decodifica el claim `sub` de
 * un token que la plataforma ya validó (`_shared/product-extraction/auth/jwt.ts`). Toda su
 * corrección descansa en una línea de `supabase/config.toml`, así que esa línea se vigila acá.
 *
 * Motivo medido: con `supabase functions serve --no-verify-jwt` —o con un despliegue al que se le
 * pierda la configuración— un token **inventado** cuyo `sub` copiaba el de otra persona fue
 * aceptado y gastó su cuota. La identidad deja de ser verificada y pasa a ser declarada.
 */
const RAIZ = join(__dirname, '..', '..');

/** El contenido de la sección `[functions.<nombre>]`, o `null` si no está. */
function bloqueDeFuncion(nombre: string): string | null {
    const config = readFileSync(join(RAIZ, 'supabase', 'config.toml'), 'utf8');
    const bloque = config.match(new RegExp(`\\[functions\\.${nombre}\\]([\\s\\S]*?)(?:\\n\\[|$)`));
    return bloque ? bloque[1] : null;
}

describe('extract-product: la verificación de JWT no puede perderse', () => {
    it('config.toml fija verify_jwt = true para la función', () => {
        const bloque = bloqueDeFuncion('extract-product');

        expect(bloque, 'falta la sección [functions.extract-product] en supabase/config.toml').not.toBeNull();
        expect(bloque).toMatch(/^\s*verify_jwt\s*=\s*true\s*$/m);
    });

    it('ningún workflow despliega funciones con --no-verify-jwt', () => {
        const workflows = ['ci.yml', 'deploy.yml', 'e2e.yml']
            .map((nombre) => join(RAIZ, '.github', 'workflows', nombre))
            .filter((ruta) => existsSync(ruta))
            .map((ruta) => readFileSync(ruta, 'utf8'))
            .join('\n');

        expect(workflows).not.toMatch(/--no-verify-jwt/);
    });
});
