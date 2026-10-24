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
 * - **Segundo intento directo para Amazon**: cuando el camino propio topa con un muro o con una
 *   página sin precio ni imagen y la URL es una ficha de Amazon con ASIN, se pide **una vez** la
 *   ficha móvil (`/gp/aw/d/<ASIN>`) por el mismo `safeFetch` y se fusiona. No consume cuota ni
 *   créditos de Firecrawl, y si la móvil trae la página el respaldo ya no tiene nada que rescatar.
 *   La decisión y la construcción de la URL viven en `_shared/.../mobile/decision.ts`.
 * - **Siempre `200` para una petición válida**, con un cuerpo discriminado: `{ ok: true, draft }`
 *   cuando se pudo pedir la página y `{ ok: false, reason }` cuando el transporte la bloqueó o
 *   falló. Un deseo sin datos es mejor que un fallo al compartir (S2). Los `reason` que puede
 *   devolver el transporte son los de `safe-fetch.ts`: `blocked-by-site` (un muro anti-bot: header
 *   `cf-mitigated`, firma de Cloudflare/DataDome/interstitial de Amazon, `403` o `429`),
 *   `http-error` (cualquier otro `>= 400`, o sea una página rota y no un muro), `dns-failed`,
 *   `timeout`, `fetch-failed` y los `blocked-ip-*` de la guarda SSRF. Un muro **no** se cachea,
 *   porque no es un borrador.
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
import {
    FALLBACK_WINDOW_SECONDS,
    fallbackNote,
    mergeFallbackDraft,
    needsFallback,
    type FallbackTrigger,
} from '../_shared/product-extraction/fallback/decision.ts';
import { consumirRespaldo } from '../_shared/product-extraction/fallback/postgrest.ts';
import { scrapeWithFirecrawl } from '../_shared/product-extraction/fallback/scrape.ts';
import { extractProduct } from '../_shared/product-extraction/extract/index.ts';
import { intentarFichaMovil } from '../_shared/product-extraction/mobile/attempt.ts';
import { createResolveHost } from '../_shared/product-extraction/net/resolve-host.ts';
import { safeFetch } from '../_shared/product-extraction/net/safe-fetch.ts';
import { guardUrl } from '../_shared/product-extraction/net/url-guard.ts';
import { decideQuota } from '../_shared/product-extraction/quota/decision.ts';
import { consumirCuota } from '../_shared/product-extraction/quota/postgrest.ts';

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
    fallbackLimite: number;
    firecrawlKey: string;
    supabaseUrl: string;
    serviceRoleKey: string;
};

/**
 * La lectura del entorno vive en `_shared/.../config/env.ts`, que sí es probable: acá solo se le
 * inyecta `Deno.env.get`. Ver el porqué de cada valor por defecto en ese módulo.
 */
function configuracion(): Configuracion {
    const { limite, ventanaSegundos, ttlSegundos, fallbackLimite } = readExtractionConfig((nombre) =>
        Deno.env.get(nombre)
    );

    return {
        limite,
        ventanaSegundos,
        ttlSegundos,
        fallbackLimite,
        firecrawlKey: Deno.env.get('FIRECRAWL_API_KEY') ?? '',
        supabaseUrl: (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, ''),
        serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    };
}

/**
 * Intenta el rescate con Firecrawl. Devuelve el HTML renderizado o una nota con el motivo por el
 * que no se pudo, para que el usuario sepa por qué le falta el precio.
 *
 * Reglas: **sin presupuesto legible no se gasta** (el SQL decide, y un `null` se lee como «no»),
 * sin clave ni límite el respaldo está apagado, y cualquier fallo del proveedor devuelve nota en
 * vez de tumbar el borrador que ya existe.
 */
async function intentarRespaldo(params: {
    url: string;
    userId: string;
    conf: Configuracion;
    disparo: FallbackTrigger;
    ahoraMs: number;
}): Promise<
    { usado: true; html: string; finalUrl: string | null } | { usado: false; nota: string | null }
> {
    const { url, userId, conf, ahoraMs } = params;

    if (conf.fallbackLimite <= 0 || conf.firecrawlKey === '') return { usado: false, nota: null };

    const presupuesto = await consumirRespaldo({
        supabaseUrl: conf.supabaseUrl,
        serviceRoleKey: conf.serviceRoleKey,
        userId,
        limite: conf.fallbackLimite,
        ventanaSegundos: FALLBACK_WINDOW_SECONDS,
        ahoraMs,
    });
    if (!presupuesto) {
        return { usado: false, nota: 'No se pudo consultar el presupuesto del respaldo, así que no se usó.' };
    }
    if (!presupuesto.allowed) {
        return { usado: false, nota: 'El respaldo automático llegó a su límite de este mes.' };
    }

    const scrape = await scrapeWithFirecrawl({ url, apiKey: conf.firecrawlKey });
    if (!scrape.ok) return { usado: false, nota: fallbackNote(scrape.reason) };

    return { usado: true, html: scrape.html, finalUrl: scrape.finalUrl };
}

Deno.serve(async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== 'POST') {
        return respuesta({ error: 'Método no permitido: usa POST.' }, 405, request);
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

    // El RPC vive en `_shared` para poder probar su timeout: sin tope, un PostgREST que no
    // contesta colgaría la extracción entera, que lo espera antes de pedir la página.
    const cuota = await consumirCuota({
        supabaseUrl: conf.supabaseUrl,
        serviceRoleKey: conf.serviceRoleKey,
        userId,
        limite: conf.limite,
        ventanaSegundos: conf.ventanaSegundos,
        ahoraMs,
    });
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
        // S7 de `odd/tasks/respaldo-firecrawl.md`: si la guarda rechaza la URL, no se pide y tampoco
        // se manda a un tercero. Es la misma función pura que usa `safeFetch`, así que el motivo es
        // exactamente el mismo.
        const guarda = guardUrl(url);
        if (!guarda.ok) return respuesta({ ok: false, reason: guarda.reason }, 200, request);

        const resultado = await safeFetch(url, { resolveHost });
        const draftDirecto = resultado.ok
            ? extractProduct({ html: resultado.body, url: resultado.finalUrl })
            : null;

        // **Segundo intento directo, solo para Amazon y como mucho una vez.** El interstitial que
        // detecta `detect-block.ts` llega con status 200 y sin ningún header, así que el camino
        // propio se queda sin ficha; la móvil (`/gp/aw/d/<ASIN>`) sí es una página (medido el
        // 2026-10-24: 89,99 € en `amazon.es`). No gasta créditos: es `safeFetch` otra vez, con la
        // misma guarda. Sin ASIN en la ruta, o con un precio ya leído, no se pide nada.
        const fichaMovil = await intentarFichaMovil({
            url: guarda.url,
            failureReason: resultado.ok ? null : resultado.reason,
            draft: draftDirecto,
        });
        // El borrador móvil entra como respaldo: gana donde trae algo y el directo cubre los huecos.
        const borradorDirecto = fichaMovil ? mergeFallbackDraft(draftDirecto, fichaMovil.draft) : draftDirecto;
        const urlLeida = resultado.ok ? resultado.finalUrl : (fichaMovil?.finalUrl ?? null);

        // El respaldo salta solo cuando el camino propio no alcanzó (D1(b)). Si la ficha móvil dio
        // una página, lo que se juzga es esa página: pagar un crédito por lo que la móvil ya contó
        // sería pagar dos veces por el mismo dato.
        const disparo = needsFallback({
            failureReason: resultado.ok || fichaMovil ? null : resultado.reason,
            draft: borradorDirecto,
        });
        const respaldo = disparo
            ? await intentarRespaldo({ url: guarda.url, userId, conf, disparo, ahoraMs: Date.now() })
            : { usado: false as const, nota: null };

        if (respaldo.usado) {
            // Se corre **nuestro** extractor sobre el DOM ya renderizado (mismo baremo, un crédito) y
            // se **fusiona** con lo que el camino propio ya había leído: el respaldo rellena huecos,
            // nunca reemplaza. Ver `mergeFallbackDraft` y S8 de la ficha.
            // La base para las URLs relativas es la que el proveedor leyó de verdad: una página que
            // redirige resolvía `img/x.jpg` contra la URL pedida y la imagen salía rota.
            const base = respaldo.finalUrl ?? guarda.url;
            const draft = mergeFallbackDraft(borradorDirecto, extractProduct({ html: respaldo.html, url: base }));
            if (clave && cacheActiva) {
                await guardarEnCache({
                    supabaseUrl: conf.supabaseUrl,
                    serviceRoleKey: conf.serviceRoleKey,
                    cacheKey: clave,
                    draft,
                    finalUrl: base,
                    ttlSegundos: conf.ttlSegundos,
                    ahoraMs: Date.now(),
                });
            }
            return respuesta({ ok: true, draft, via: 'firecrawl' }, 200, request);
        }

        if (!resultado.ok && !fichaMovil) {
            // La forma del fallo se conserva: `fallback` aparece solo cuando hay algo que contar.
            return respuesta(
                respaldo.nota
                    ? { ok: false, reason: resultado.reason, fallback: respaldo.nota }
                    : { ok: false, reason: resultado.reason },
                200,
                request
            );
        }

        const draft = respaldo.nota
            ? { ...borradorDirecto!, notes: [...borradorDirecto!.notes, respaldo.nota] }
            : borradorDirecto!;

        if (clave && cacheActiva) {
            await guardarEnCache({
                supabaseUrl: conf.supabaseUrl,
                serviceRoleKey: conf.serviceRoleKey,
                cacheKey: clave,
                draft,
                finalUrl: urlLeida ?? guarda.url,
                ttlSegundos: conf.ttlSegundos,
                ahoraMs: Date.now(),
            });
        }
        return respuesta({ ok: true, draft }, 200, request);
    } catch {
        return respuesta({ ok: false, reason: 'unexpected' }, 200, request);
    }
});
