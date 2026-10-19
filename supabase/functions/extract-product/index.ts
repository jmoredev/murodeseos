/**
 * Edge Function `extract-product`: recibe la URL de un producto y devuelve el borrador leído de
 * esa página, con cuota por usuario y caché por URL normalizada (T5 de
 * `odd/tasks/compartir-producto.md`).
 *
 * Contrato:
 *
 * - `POST` con JSON `{ "url": "<url del producto>" }`. Otros métodos → `405`; `url` ausente o no
 *   parseable → `400` con el motivo.
 * - El runtime valida el JWT **antes** de invocar el handler (`verify_jwt` en
 *   `supabase/config.toml`). Acá no se verifica ninguna firma a mano: solo se decodifica el `sub`
 *   del token ya verificado (ver `auth/jwt.ts`). Si no se puede leer → `401`.
 * - Flujo: leer el `sub` → normalizar la URL → **buscar en la caché**. Si hay acierto vigente se
 *   devuelve el borrador cacheado sin pedir la página y **sin consumir cuota**, marcado con
 *   `cached: true` y `cachedAt`. Si no hay acierto, se consume cuota; agotada → `429` con
 *   `{ ok: false, reason: 'quota-exceeded', retryAfterSeconds }`. Recién entonces se pide la
 *   página y, si el transporte fue exitoso (`ok: true`, aunque el borrador venga parcial con sus
 *   `notes`), se guarda en la caché. Un fallo de transporte (`ok: false`) **no** se cachea: es
 *   transitorio y cachearlo impediría reintentar durante el TTL.
 * - **Siempre `200` para una petición válida**, con un cuerpo discriminado: `{ ok: true, draft }`
 *   cuando se pudo pedir la página y `{ ok: false, reason }` cuando el transporte la bloqueó o
 *   falló. Un deseo sin datos es mejor que un fallo al compartir (S2).
 * - Un error inesperado tampoco tumba la petición: `{ ok: false, reason: 'unexpected' }`.
 *
 * Variables de entorno (todas con valor por defecto, para poder medirlas sin tocar el código):
 *
 * - `PRODUCT_EXTRACTION_QUOTA_LIMIT` — extracciones permitidas por usuario y ventana (por defecto
 *   `30`). Configurable para medir y para la prueba de `429`.
 * - `PRODUCT_EXTRACTION_QUOTA_WINDOW_SECONDS` — tamaño de la ventana fija, alineada a época (por
 *   defecto `3600`, una hora).
 * - `PRODUCT_EXTRACTION_CACHE_TTL_SECONDS` — vida del borrador cacheado (por defecto `3600`, una
 *   hora). El precio es el dato que más duele si está viejo, así que la caché absorbe ráfagas y
 *   reintentos de la misma URL y nada más; una antigüedad mayor se sube a propósito con esta
 *   variable.
 *
 * Persistencia: dos tablas (`product_extraction_cache` y `product_extraction_quota`) con RLS
 * activo y **sin políticas**, solo accesibles con la `service_role` key. Se hablan por PostgREST
 * con `fetch` —sin cliente de Supabase— para no sumar dependencias (S8). La migración es parte
 * del despliegue: si la tabla de cuota todavía no existe, la petición responde `503`
 * (`quota-unavailable`) en vez de saltarse la cuota; si la de caché no existe, el lector la trata
 * como fallo de caché (miss) y el escritor ignora el error, así que la extracción sigue
 * funcionando sin caché. **Este archivo usa APIs de `Deno` y por eso queda fuera del `tsc` de la
 * app** (`tsconfig.json`); el comportamiento puro vive en `_shared/`, que sí pasa por `tsc`.
 */
import { readJwtSub } from '../_shared/product-extraction/auth/jwt.ts';
import { normalizeCacheKey } from '../_shared/product-extraction/cache/normalize-url.ts';
import { guardarEnCache, leerDeCache } from '../_shared/product-extraction/cache/postgrest.ts';
import { isCacheEnabled, readExtractionConfig } from '../_shared/product-extraction/config/env.ts';
import { extractProduct } from '../_shared/product-extraction/extract/index.ts';
import { createResolveHost } from '../_shared/product-extraction/net/resolve-host.ts';
import { safeFetch } from '../_shared/product-extraction/net/safe-fetch.ts';
import { computeQuotaWindow, decideQuota } from '../_shared/product-extraction/quota/decision.ts';

/**
 * Orígenes de desarrollo que el repo ya contempla: `supabase/config.toml` lista ambos en
 * `additional_redirect_urls`.
 */
const ORIGENES_DE_DESARROLLO = ['http://localhost:8081', 'http://127.0.0.1:8081'];

/**
 * Decide si un origen puede recibir la respuesta. La fuente única del origen público es
 * `lib/site-url.ts`: `EXPO_PUBLIC_SITE_URL` cuando está configurada y, si no, el propio navegador
 * cuando el host termina en `github.io`. El runtime no ve ese navegador, así que acá se reconoce
 * `EXPO_PUBLIC_SITE_URL` y el host de GitHub Pages.
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

type Configuracion = {
    limite: number;
    ventanaSegundos: number;
    ttlSegundos: number;
    supabaseUrl: string;
    serviceRoleKey: string;
};

/**
 * La lectura del entorno vive en `_shared/.../config/env.ts`, que sí es probable: acá solo se le
 * inyecta `Deno.env.get`. Ver el porqué de cada valor por defecto en ese módulo.
 */
function configuracion(): Configuracion {
    const { limite, ventanaSegundos, ttlSegundos } = readExtractionConfig((nombre) => Deno.env.get(nombre));

    return {
        limite,
        ventanaSegundos,
        ttlSegundos,
        supabaseUrl: (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, ''),
        serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    };
}

function cabecerasServicio(clave: string): Record<string, string> {
    return { apikey: clave, authorization: `Bearer ${clave}` };
}

/** Fila de caché vigente: el borrador guardado y cuándo se guardó. */
type ConsumoCuota = { allowed: boolean; used: number; windowEndMs: number };

/**
 * Consume cuota de forma atómica en el SQL (upsert con incremento y `returning`). Devuelve `null`
 * si el RPC no está disponible: el handler lo traduce a `503` y **no** se salta la cuota.
 */
async function consumirCuota(userId: string, conf: Configuracion): Promise<ConsumoCuota | null> {
    try {
        const respuestaHttp = await fetch(
            `${conf.supabaseUrl}/rest/v1/rpc/consume_product_extraction_quota`,
            {
                method: 'POST',
                headers: {
                    ...cabecerasServicio(conf.serviceRoleKey),
                    'content-type': 'application/json',
                    accept: 'application/json',
                },
                body: JSON.stringify({
                    p_user_id: userId,
                    p_limit: conf.limite,
                    p_window_seconds: conf.ventanaSegundos,
                }),
            }
        );
        if (!respuestaHttp.ok) return null;

        const datos: unknown = await respuestaHttp.json();
        const fila = (Array.isArray(datos) ? datos[0] : datos) as
            | { allowed?: unknown; used?: unknown; window_end?: unknown }
            | null;
        if (fila === null || typeof fila !== 'object' || typeof fila.allowed !== 'boolean') {
            return null;
        }

        const ventanaFin = Date.parse(String(fila.window_end));
        const finRespaldo = computeQuotaWindow(Date.now(), conf.ventanaSegundos).endMs;

        return {
            allowed: fila.allowed,
            used: typeof fila.used === 'number' ? fila.used : 0,
            windowEndMs: Number.isFinite(ventanaFin) ? ventanaFin : finRespaldo,
        };
    } catch {
        return null;
    }
}

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

    // La firma la validó el runtime; acá solo se lee el identificador que ya garantizó.
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
    const userId = readJwtSub(token);
    if (!userId) {
        return respuesta(
            { error: 'No se pudo identificar al usuario: el token no trae un «sub» legible.' },
            401,
            request
        );
    }

    // Clave de caché de la URL. Si no es cacheable (esquema que no sea http/https), seguimos sin
    // caché: el rechazo del esquema lo decide la capa de red y devuelve su `reason` de siempre.
    const clave = normalizeCacheKey(url);

    const conf = configuracion();
    const ahoraMs = Date.now();

    // La caché apagada se pregunta antes de **leer y de escribir**: con TTL 0 las filas viejas
    // siguen vigentes hasta su vencimiento, así que un simple filtro por fecha las serviría igual.
    const cacheActiva = isCacheEnabled(conf);

    if (clave && cacheActiva) {
        const cache = await leerDeCache({
            supabaseUrl: conf.supabaseUrl,
            serviceRoleKey: conf.serviceRoleKey,
            cacheKey: clave,
            ahoraMs,
        });
        if (cache) {
            return respuesta(
                { ok: true, draft: cache.draft, cached: true, cachedAt: cache.cachedAt },
                200,
                request
            );
        }
    }

    const cuota = await consumirCuota(userId, conf);
    if (!cuota) {
        return respuesta({ ok: false, reason: 'quota-unavailable' }, 503, request);
    }
    if (!cuota.allowed) {
        const { retryAfterSeconds } = decideQuota({
            count: cuota.used,
            limit: conf.limite,
            nowMs: ahoraMs,
            windowEndMs: cuota.windowEndMs,
        });
        return respuesta(
            { ok: false, reason: 'quota-exceeded', retryAfterSeconds },
            429,
            request
        );
    }

    try {
        const resultado = await safeFetch(url, { resolveHost });
        if (!resultado.ok) {
            return respuesta({ ok: false, reason: resultado.reason }, 200, request);
        }

        const draft = extractProduct({ html: resultado.body, url: resultado.finalUrl });
        if (clave && cacheActiva) {
            await guardarEnCache({
                supabaseUrl: conf.supabaseUrl,
                serviceRoleKey: conf.serviceRoleKey,
                cacheKey: clave,
                draft,
                finalUrl: resultado.finalUrl,
                ttlSegundos: conf.ttlSegundos,
                ahoraMs: Date.now(),
            });
        }
        return respuesta({ ok: true, draft }, 200, request);
    } catch {
        return respuesta({ ok: false, reason: 'unexpected' }, 200, request);
    }
});
