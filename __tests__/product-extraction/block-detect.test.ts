import { describe, expect, it } from 'vitest';
import {
    detectBlock,
    type BlockVerdict,
} from '../../supabase/functions/_shared/product-extraction/net/detect-block.ts';
import {
    safeFetch,
    type FetchLike,
    type FetchResponseLike,
    type ResponseBodyLike,
} from '../../supabase/functions/_shared/product-extraction/net/safe-fetch.ts';
import { loadFixtureHtml, loadManifest, fixtureUrl } from './fixture-loader';

/**
 * Una tienda que contesta con un challenge anti-bot no entrega el producto: entrega su página de
 * rechazo. Medido el 2026-10-21, PcComponentes devuelve `403` + `cf-mitigated: challenge` +
 * `<title>Just a moment...</title>`, y el extractor convertía eso en un deseo titulado
 * «Just a moment...». Estos tests fijan que el transporte lo nombre como fallo antes de parsear.
 *
 * Las firmas no se inventaron: salen de los fixtures reales (`pccomponentes-es`, `decathlon-es`
 * para Cloudflare y `fnac-es` para DataDome). Ningún test sale a la red.
 */

const PRODUCTO_NORMAL = `<!DOCTYPE html><html><head>
<title>Consola PlayStation 5 · Tienda X</title>
<meta property="og:title" content="Consola PlayStation 5" />
<script type="application/ld+json">{"@type":"Product","name":"Consola PlayStation 5"}</script>
</head><body>Esperá un momento, estamos cargando la ficha.</body></html>`;

function cuerpoDe(texto: string): ResponseBodyLike {
    let leido = false;
    return {
        getReader() {
            return {
                async read() {
                    if (leido) return { done: true, value: undefined };
                    leido = true;
                    return { done: false, value: new TextEncoder().encode(texto) };
                },
                cancel() {
                    /* no hay nada que liberar en un cuerpo falso */
                },
            };
        },
    };
}

function respuesta(opciones: {
    status: number;
    body: string;
    headers?: Record<string, string>;
}): FetchResponseLike {
    const mapa: Record<string, string> = {
        'content-type': 'text/html; charset=utf-8',
        ...opciones.headers,
    };
    return {
        status: opciones.status,
        headers: { get: (nombre: string) => mapa[nombre.toLowerCase()] ?? null },
        body: cuerpoDe(opciones.body),
    };
}

const CLOUDFLARE = loadFixtureHtml('pccomponentes-es');
const DATADOME = loadFixtureHtml('fnac-es');
/** Interstitial de Amazon: 200, ~3,7 KB, `<title>Amazon.com</title>`, sin `cf-mitigated`. */
const INTERSTITIAL_AMAZON = loadFixtureHtml('amazon-interstitial');
/** La ficha real de Amazon, para probar que la firma no se come una página buena. */
const PRODUCTO_AMAZON = loadFixtureHtml('amazon-es');

/**
 * Fixtures capturados con **200** que no son una página: Amazon contesta el interstitial con un
 * status de éxito, así que el filtro por status no los ve y hay que nombrarlos.
 */
const DOSCIENTOS_QUE_NO_SON_PAGINA = ['amazon-interstitial'];

describe('detectBlock · firma del challenge', () => {
    it('marca bloqueo cuando Cloudflare declara cf-mitigated', () => {
        const veredicto = detectBlock({
            status: 403,
            mitigated: 'challenge',
            body: '<html><title>Producto</title></html>',
        });

        expect(veredicto).toEqual({ blocked: true, reason: 'blocked-by-site' });
    });

    it('marca bloqueo con el cuerpo real de Cloudflare aunque el status sea 200', () => {
        const veredicto = detectBlock({ status: 200, body: CLOUDFLARE });

        expect(veredicto).toEqual({ blocked: true, reason: 'blocked-by-site' });
    });

    it('marca bloqueo con el cuerpo real de DataDome (Fnac) aunque el status sea 200', () => {
        const veredicto = detectBlock({ status: 200, body: DATADOME });

        expect(veredicto).toEqual({ blocked: true, reason: 'blocked-by-site' });
    });

    it('no marca una página de producto que solo dice «esperá un momento» sin firma de challenge', () => {
        const veredicto = detectBlock({ status: 200, body: PRODUCTO_NORMAL });

        expect(veredicto).toEqual({ blocked: false });
    });

    it('marca bloqueo con el interstitial real de Amazon, servido con 200 y sin cf-mitigated', () => {
        // Medido el 2026-10-24: Amazon contesta la ficha con un interstitial de ~3,7 KB que pide
        // «click the button below to continue shopping» y postea a `errors_page/validateCaptcha`.
        const veredicto = detectBlock({ status: 200, mitigated: null, body: INTERSTITIAL_AMAZON });

        expect(veredicto).toEqual({ blocked: true, reason: 'blocked-by-site' });
    });

    it('no marca la ficha real de Amazon (amazon-es), que llega con el mismo 200 y sin header', () => {
        const veredicto = detectBlock({ status: 200, body: PRODUCTO_AMAZON });

        expect(veredicto).toEqual({ blocked: false });
    });
});

describe('detectBlock · status', () => {
    it('trata 403 y 429 sin firma conocida como bloqueo de la tienda', () => {
        for (const status of [403, 429]) {
            expect(detectBlock({ status, body: '<html><title>Producto</title></html>' })).toEqual({
                blocked: true,
                reason: 'blocked-by-site',
            });
        }
    });

    it('trata cualquier otro status de error como error de la página, no como bloqueo', () => {
        for (const status of [400, 404, 410, 500, 503]) {
            expect(detectBlock({ status, body: '<html><title>No encontrado</title></html>' })).toEqual({
                blocked: true,
                reason: 'http-error',
            });
        }
    });

    it('no marca una respuesta 2xx de una página de producto', () => {
        const veredicto = detectBlock({ status: 200, body: PRODUCTO_NORMAL });

        expect(veredicto).toEqual({ blocked: false });
    });
});

describe('safeFetch · el challenge no llega al parser', () => {
    it('devuelve fallo blocked-by-site con el cuerpo real de PcComponentes y su header', async () => {
        const fetchFalso: FetchLike = async () =>
            respuesta({
                status: 403,
                body: CLOUDFLARE,
                headers: { 'cf-mitigated': 'challenge' },
            });

        const resultado = await safeFetch('https://www.pccomponentes.com/grand-theft-auto-vi', {
            fetchImpl: fetchFalso,
        });

        expect(resultado).toEqual({
            ok: false,
            reason: 'blocked-by-site',
            finalUrl: 'https://www.pccomponentes.com/grand-theft-auto-vi',
            status: 403,
        });
    });

    it('devuelve fallo blocked-by-site con el cuerpo real de Fnac sin ningún header de aviso', async () => {
        const fetchFalso: FetchLike = async () => respuesta({ status: 200, body: DATADOME });

        const resultado = await safeFetch('https://www.fnac.es/a1234/producto', { fetchImpl: fetchFalso });

        expect(resultado).toEqual({
            ok: false,
            reason: 'blocked-by-site',
            finalUrl: 'https://www.fnac.es/a1234/producto',
            status: 200,
        });
    });

    it('devuelve fallo http-error con una página de «no encontrado»', async () => {
        const fetchFalso: FetchLike = async () =>
            respuesta({ status: 404, body: '<html><title>Página no encontrada</title></html>' });

        const resultado = await safeFetch('https://shop.example/borrado', { fetchImpl: fetchFalso });

        expect(resultado).toEqual({
            ok: false,
            reason: 'http-error',
            finalUrl: 'https://shop.example/borrado',
            status: 404,
        });
    });

    it('devuelve fallo blocked-by-site con el interstitial real de Amazon y ningún header de aviso', async () => {
        const fetchFalso: FetchLike = async () => respuesta({ status: 200, body: INTERSTITIAL_AMAZON });

        const resultado = await safeFetch('https://www.amazon.com/dp/B0D1XD1ZV3', { fetchImpl: fetchFalso });

        expect(resultado).toEqual({
            ok: false,
            reason: 'blocked-by-site',
            finalUrl: 'https://www.amazon.com/dp/B0D1XD1ZV3',
            status: 200,
        });
    });

    it('sigue devolviendo el cuerpo de una página de producto normal', async () => {
        const fetchFalso: FetchLike = async () => respuesta({ status: 200, body: PRODUCTO_NORMAL });

        const resultado = await safeFetch('https://shop.example/producto', { fetchImpl: fetchFalso });

        expect(resultado.ok).toBe(true);
        if (resultado.ok) expect(resultado.body).toBe(PRODUCTO_NORMAL);
    });
});

/**
 * El veredicto es un tipo discriminado: sin `blocked: true` no hay `reason`. Este test existe para
 * que el `switch` que lo consuma no tenga que adivinar, y para que `BlockVerdict` no se vuelva un
 * `{ blocked: boolean; reason?: string }`.
 */
describe('detectBlock · contrato del veredicto', () => {
    it('nunca devuelve un motivo cuando no hay bloqueo', () => {
        const veredicto: BlockVerdict = detectBlock({ status: 200, body: PRODUCTO_NORMAL });

        expect(veredicto).not.toHaveProperty('reason');
    });
});

/**
 * Diferencial sobre los fixtures reales, que es lo que decide si esta guarda cuesta tiendas: cada
 * captura se reentrega con **el status con el que se capturó**. Las de 200 tienen que seguir
 * pasando enteras —el cambio no puede comerse una página buena— y las de 4xx ya no.
 */
describe('safeFetch · los fixtures reales siguen el status con el que se capturaron', () => {
    const fixtures = loadManifest().fixtures;

    it('deja pasar enteros los fixtures capturados con 200', async () => {
        // Los 200 que no son una página se prueban aparte, en el bloque de abajo: acá se afirma que
        // el cambio no se comió ninguna página buena.
        const buenos = fixtures.filter(
            (fixture) => fixture.status === 200 && !DOSCIENTOS_QUE_NO_SON_PAGINA.includes(fixture.id)
        );
        expect(buenos.map((fixture) => fixture.id)).toContain('mediamarkt-es');

        for (const entrada of buenos) {
            const html = loadFixtureHtml(entrada.id);
            const fetchFalso: FetchLike = async () => respuesta({ status: 200, body: html });

            const resultado = await safeFetch(fixtureUrl(entrada), { fetchImpl: fetchFalso });

            expect(resultado.ok, `${entrada.id}: ${JSON.stringify(resultado)}`).toBe(true);
            if (resultado.ok) expect(resultado.body).toBe(html);
        }
    });

    it('rechaza los 200 que no son una página, como el interstitial de Amazon', async () => {
        for (const id of DOSCIENTOS_QUE_NO_SON_PAGINA) {
            const entrada = fixtures.find((fixture) => fixture.id === id);
            expect(entrada, `${id} tiene que estar en el manifiesto`).toBeDefined();
            expect(entrada?.status).toBe(200);

            const html = loadFixtureHtml(id);
            const fetchFalso: FetchLike = async () => respuesta({ status: 200, body: html });

            const resultado = await safeFetch(fixtureUrl(entrada!), { fetchImpl: fetchFalso });

            expect(resultado.ok, id).toBe(false);
            if (!resultado.ok) expect(resultado.reason, id).toBe('blocked-by-site');
        }
    });

    it('rechaza los fixtures capturados con 4xx, con un motivo que los nombra', async () => {
        const bloqueados = fixtures.filter(
            (fixture) => fixture.status !== null && fixture.status >= 400
        );
        expect(bloqueados.map((fixture) => fixture.id)).toEqual(
            expect.arrayContaining(['pccomponentes-es', 'decathlon-es', 'fnac-es'])
        );

        for (const entrada of bloqueados) {
            const html = loadFixtureHtml(entrada.id);
            const fetchFalso: FetchLike = async () =>
                respuesta({ status: entrada.status as number, body: html });

            const resultado = await safeFetch(fixtureUrl(entrada), { fetchImpl: fetchFalso });

            expect(resultado.ok, `${entrada.id}: ${JSON.stringify(resultado)}`).toBe(false);
            if (!resultado.ok) {
                expect(['blocked-by-site', 'http-error'], entrada.id).toContain(resultado.reason);
            }
        }
    });
});
