/**
 * Edge Function `extract-product`: recibe la URL de un producto y devuelve el borrador leído de
 * esa página.
 *
 * Es la primera mitad de T5 (T5a): endpoint autenticado con extracción. La cuota por usuario y la
 * caché por URL normalizada llegan después (T5b), con su propia migración de esquema.
 *
 * Contrato:
 *
 * - `POST` con JSON `{ "url": "<url del producto>" }`. Otros métodos → `405`; `url` ausente o no
 *   parseable → `400` con el motivo.
 * - El runtime valida el JWT **antes** de invocar el handler (`verify_jwt` en
 *   `supabase/config.toml`). Sin cabecera `Authorization` la petición ni siquiera llega acá: el
 *   identificador de usuario para T5b sale del claim `sub` de ese token ya verificado. Acá no se
 *   verifica ninguna firma a mano (sería una segunda fuente de verdad y una dependencia de más).
 * - **Siempre `200` para una petición válida**, con un cuerpo discriminado: `{ ok: true, draft }`
 *   cuando se pudo pedir la página (aunque el borrador venga parcial, con sus `notes`) y
 *   `{ ok: false, reason }` cuando el transporte la bloqueó o falló. Un deseo sin datos es mejor
 *   que un fallo al compartir (S2).
 * - Un error inesperado tampoco tumba la petición: `{ ok: false, reason: 'unexpected' }`.
 *
 * Este archivo usa APIs de `Deno` y por eso queda **fuera del `tsc` de la app** (`tsconfig.json`);
 * el comportamiento puro vive en `_shared/`, que sí pasa por `tsc`.
 */
import { extractProduct } from '../_shared/product-extraction/extract/index.ts';
import { createResolveHost } from '../_shared/product-extraction/net/resolve-host.ts';
import { safeFetch } from '../_shared/product-extraction/net/safe-fetch.ts';

/**
 * Orígenes de desarrollo que el repo ya contempla: `supabase/config.toml` lista ambos en
 * `additional_redirect_urls`.
 */
const ORIGENES_DE_DESARROLLO = ['http://localhost:8081', 'http://127.0.0.1:8081'];

/**
 * Decide si un origen puede recibir la respuesta. La fuente única del origen público es
 * `lib/site-url.ts`: `EXPO_PUBLIC_SITE_URL` cuando está configurada y, si no, el propio
 * navegador cuando el host termina en `github.io`. El runtime no ve ese navegador, así que acá se
 * reconoce `EXPO_PUBLIC_SITE_URL` y el host de GitHub Pages.
 */
function origenPermitido(origen: string): boolean {
    if (ORIGENES_DE_DESARROLLO.includes(origen)) return true;

    const configurado = Deno.env.get('EXPO_PUBLIC_SITE_URL')?.trim();
    if (configurado) {
        try {
            if (new URL(configurado).origin === origen) return true;
        } catch {
            // Una variable mal formada no habilita ningún origen.
        }
    }

    try {
        return new URL(origen).hostname.endsWith('github.io');
    } catch {
        return false;
    }
}

/**
 * CORS para una petición. La app manda `Authorization` y `Content-Type`, no cookies, así que no
 * se habilita `Access-Control-Allow-Credentials` (innecesario y amplía el riesgo).
 */
function corsHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = {
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        Vary: 'Origin',
    };

    const origen = request.headers.get('origin');
    if (origen && origenPermitido(origen)) {
        headers['Access-Control-Allow-Origin'] = origen;
    }

    return headers;
}

function respuesta(body: unknown, status: number, request: Request): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders(request), 'content-type': 'application/json; charset=utf-8' },
    });
}

/** El resolvedor cierra el SSRF por DNS: `safeFetch` contrasta cada dirección resuelta. */
const resolveHost = createResolveHost((host, tipo) => Deno.resolveDns(host, tipo));

Deno.serve(async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== 'POST') {
        return respuesta({ error: 'Método no permitido: usá POST.' }, 405, request);
    }

    let cuerpo: unknown;
    try {
        cuerpo = await request.json();
    } catch {
        return respuesta({ error: 'El cuerpo no es un JSON válido.' }, 400, request);
    }

    const url = (cuerpo as { url?: unknown } | null)?.url;
    if (typeof url !== 'string' || url.trim() === '') {
        return respuesta(
            { error: 'Falta el campo «url»: hace falta la URL del producto.' },
            400,
            request
        );
    }

    try {
        new URL(url);
    } catch {
        return respuesta({ error: `El campo «url» no es una URL válida: «${url}».` }, 400, request);
    }

    try {
        const resultado = await safeFetch(url, { resolveHost });
        if (!resultado.ok) {
            return respuesta({ ok: false, reason: resultado.reason }, 200, request);
        }

        const draft = extractProduct({ html: resultado.body, url: resultado.finalUrl });
        return respuesta({ ok: true, draft }, 200, request);
    } catch {
        return respuesta({ ok: false, reason: 'unexpected' }, 200, request);
    }
});
