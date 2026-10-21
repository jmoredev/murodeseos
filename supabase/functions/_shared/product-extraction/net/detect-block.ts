/**
 * Detección de páginas de bloqueo: decide si lo que llegó de una tienda es la página del producto
 * o un muro anti-bot disfrazado de página.
 *
 * El problema que resuelve, medido el 2026-10-21: PcComponentes contesta a cualquier cliente que
 * no ejecute JavaScript con `403`, el header `cf-mitigated: challenge` y un cuerpo de ~3 KB cuyo
 * `<title>` es «Just a moment...». Un 403 **trae cuerpo**, así que un transporte que solo mira el
 * status entrega ese cuerpo como si fuera la ficha y el extractor convierte el challenge en un
 * deseo titulado «Just a moment...» sin precio ni imagen. Eso no es «no se pudo leer»: es un deseo
 * equivocado, y el usuario no lo nota hasta que lo abre.
 *
 * Por eso la decisión vive en la capa de red y no en el parser: lo que no es una página no llega
 * al parser.
 *
 * Las firmas de abajo **no son adivinadas**: salen de los fixtures reales del repo —
 * `pccomponentes-es` y `decathlon-es` para Cloudflare, `fnac-es` para DataDome— y cada una se
 * exige con **dos** marcas para no marcar como bloqueo una página legítima que mencione la frase
 * en un texto cualquiera.
 *
 * Lo que **no** cubre, a propósito: un muro que sirva la página del challenge con **status 200 y
 * sin ninguna de estas firmas**. Sin señal, esto no adivina; el desenlace sería el de antes.
 */

/** Motivo del veredicto. `safeFetch` los suma a sus propios motivos de fallo. */
export type BlockReason = 'blocked-by-site' | 'http-error';

/** Veredicto discriminado: el motivo solo existe cuando hay bloqueo. */
export type BlockVerdict = { blocked: false } | { blocked: true; reason: BlockReason };

/** Evidencia disponible después de pedir y leer la respuesta. */
export type BlockEvidence = {
    /** Status del último salto. */
    status: number;
    /**
     * Valor del header `cf-mitigated`. Cloudflare lo pone en sus challenges (`challenge`,
     * `managed`, `deny`); cualquier valor no vacío ya significa que no se sirvió el producto.
     */
    mitigated?: string | null;
    /** Cuerpo ya decodificado. Se mira en minúsculas. */
    body: string;
};

/**
 * Firmas de challenge medidas en los fixtures. Cada una pide dos marcas: la frase característica
 * **y** un resto propio del muro, para que un producto que hable de «wait a moment» no se marque.
 */
const FIRMAS_DE_CHALLENGE: readonly ((cuerpo: string) => boolean)[] = [
    // Cloudflare: el título del challenge y el script de su CSP (o su objeto `cf_chl_opt`).
    (cuerpo) =>
        cuerpo.includes('just a moment...') &&
        (cuerpo.includes('cf_chl_opt') || cuerpo.includes('challenges.cloudflare.com')),
    // DataDome (Fnac): el aviso de JS con su captcha o su objeto `dd`.
    (cuerpo) =>
        cuerpo.includes('captcha-delivery.com') &&
        (cuerpo.includes('var dd=') || cuerpo.includes('please enable js')),
];

/**
 * Decide si la respuesta es una página o un muro. **Nunca tira**: con `body` que no sea texto
 * devuelve «no bloqueado» y sigue el camino de siempre.
 *
 * Orden de las reglas: header → firmas → status. Es el orden de fuerza de la evidencia: el header
 * lo pone el CDN, las firmas están medidas, y el status es lo más genérico (un 403 de una tienda
 * sin challenge sigue siendo un rechazo).
 */
export function detectBlock(evidence: BlockEvidence): BlockVerdict {
    const { status, mitigated, body } = evidence;

    // El header lo pone el CDN, no la tienda: es la evidencia más fuerte de que hubo un muro.
    if (typeof mitigated === 'string' && mitigated.trim() !== '') {
        return { blocked: true, reason: 'blocked-by-site' };
    }

    const cuerpo = typeof body === 'string' ? body.toLowerCase() : '';
    if (FIRMAS_DE_CHALLENGE.some((firma) => firma(cuerpo))) {
        return { blocked: true, reason: 'blocked-by-site' };
    }

    // Sin firma, el status sigue decidiendo. 403 y 429 son la tienda negándose a servirte; el
    // resto de los 4xx/5xx es una página rota, y llamarlo «bloqueo» sería mentirle al usuario.
    if (status === 403 || status === 429) return { blocked: true, reason: 'blocked-by-site' };
    if (status >= 400) return { blocked: true, reason: 'http-error' };

    return { blocked: false };
}
