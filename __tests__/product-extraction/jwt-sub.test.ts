import { describe, expect, it } from 'vitest';
import { readJwtSub } from '../../supabase/functions/_shared/product-extraction/auth/jwt.ts';

/**
 * El runtime de Supabase valida la firma del JWT **antes** de invocar el handler, así que acá no
 * se verifica nada a mano: solo se decodifica el segmento de payload para leer la identidad que la
 * plataforma ya garantizó. Estos tests fijan que un token sin `sub` legible devuelve `null`, que
 * es lo que el handler traduce a `401`.
 */

/** Arma un JWT de mentira: la firma no se mira, solo importa que el payload sea base64url. */
function tokenConPayload(payload: unknown): string {
    const cabecera = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const cuerpo = base64url(JSON.stringify(payload));
    return `${cabecera}.${cuerpo}.firma-que-no-se-mira`;
}

function base64url(texto: string): string {
    return Buffer.from(texto, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

const UUID = '7f9c2ba4-2c1e-4c0e-9f47-2f0d3a1b5c6d';

describe('readJwtSub', () => {
    it('devuelve el sub de un token con payload válido', () => {
        expect(readJwtSub(tokenConPayload({ sub: UUID, role: 'authenticated' }))).toBe(UUID);
    });

    it('devuelve null cuando falta el sub', () => {
        expect(readJwtSub(tokenConPayload({ role: 'authenticated' }))).toBeNull();
    });

    it('devuelve null cuando el sub no es un identificador de usuario', () => {
        expect(readJwtSub(tokenConPayload({ sub: '' }))).toBeNull();
        expect(readJwtSub(tokenConPayload({ sub: 'no-es-un-uuid' }))).toBeNull();
        expect(readJwtSub(tokenConPayload({ sub: 42 }))).toBeNull();
    });

    it('devuelve null para un token mal formado', () => {
        expect(readJwtSub('no-es-un-token')).toBeNull();
        expect(readJwtSub('')).toBeNull();
        expect(readJwtSub(null)).toBeNull();
        expect(readJwtSub(undefined)).toBeNull();
    });

    it('devuelve null cuando el payload no es base64 ni JSON', () => {
        expect(readJwtSub('cabecera.%%%no-base64%%%.firma')).toBeNull();
        expect(readJwtSub(`cabecera.${base64url('{no es json')}.firma`)).toBeNull();
    });
});
