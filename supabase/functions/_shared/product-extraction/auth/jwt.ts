/**
 * Lectura del `sub` de un JWT **ya verificado por la plataforma**.
 *
 * El runtime de Supabase valida la firma antes de invocar el handler (`verify_jwt` en
 * `supabase/config.toml`), así que acá no se verifica nada a mano: sería una segunda fuente de
 * verdad y una dependencia de más. Lo único que se hace es decodificar el segmento de payload en
 * base64url y leer `sub`.
 *
 * El `sub` tiene que ser un identificador de usuario de Supabase, que es un UUID: es el valor que
 * se usa como `auth.users.id` en la cuota. Un `sub` ausente o con otra forma no identifica a
 * nadie, así que se devuelve `null` y el handler responde `401` en vez de mandar basura al SQL.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Devuelve el `sub` del token, o `null` si no se puede leer o no es un identificador de usuario.
 * Nunca tira ni valida la firma.
 */
export function readJwtSub(token: unknown): string | null {
    if (typeof token !== 'string') return null;

    const partes = token.split('.');
    if (partes.length !== 3) return null;

    const payload = decodificarBase64Url(partes[1]);
    if (payload === null) return null;

    let datos: unknown;
    try {
        datos = JSON.parse(payload);
    } catch {
        return null;
    }

    if (typeof datos !== 'object' || datos === null) return null;

    const sub = (datos as { sub?: unknown }).sub;
    if (typeof sub !== 'string' || !UUID_RE.test(sub)) return null;

    return sub;
}

/** Decodifica base64url (con o sin relleno) a texto UTF-8, o `null` si no es base64 válido. */
function decodificarBase64Url(segmento: string): string | null {
    if (segmento === '') return null;

    const normalizado = segmento.replace(/-/g, '+').replace(/_/g, '/');
    const relleno = normalizado + '='.repeat((4 - (normalizado.length % 4)) % 4);

    try {
        const binario = atob(relleno);
        const bytes = Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}
