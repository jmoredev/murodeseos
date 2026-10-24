/**
 * El **segundo intento directo**: pedir la ficha móvil de Amazon cuando la de escritorio no sirvió.
 *
 * Es `safeFetch` otra vez, no un atajo: la URL móvil que se construye acá pasa por la misma guarda
 * SSRF, los mismos headers de navegador y los mismos topes de tiempo y bytes. El HTML vuelve a
 * entrar por `extractProduct`, así que el adaptador de Amazon lee el precio en los dos caminos y no
 * hay un segundo lector de precios escondido.
 *
 * La red se inyecta (`safeFetchImpl`) por la misma razón que en el respaldo de Firecrawl: el
 * endpoint usa `Deno` y queda fuera del runner, así que la petición tiene que poder probarse con un
 * doble. **Nunca tira**: cualquier fallo es `null`, y el llamador sigue con lo que ya tenía.
 */

import { extractProduct } from '../extract/index.ts';
import { safeFetch, type SafeFetchOptions, type SafeFetchResult } from '../net/safe-fetch.ts';
import type { ProductDraft } from '../types.ts';
import { debeIntentarFichaMovil, urlDeFichaMovil, type EvidenciaFichaMovil } from './decision.ts';

/** Lo que se pudo leer de la ficha móvil, o `null` si no se intentó o no sirvió. */
export type IntentoFichaMovil = { draft: ProductDraft; finalUrl: string } | null;

/** Firma de `safeFetch`, para poder doblarla en las pruebas. */
export type SafeFetchLike = (url: string, options?: SafeFetchOptions) => Promise<SafeFetchResult>;

export async function intentarFichaMovil({
    url,
    failureReason,
    draft,
    safeFetchImpl = safeFetch,
}: EvidenciaFichaMovil & { safeFetchImpl?: SafeFetchLike }): Promise<IntentoFichaMovil> {
    if (!debeIntentarFichaMovil({ url, failureReason, draft })) return null;

    const destino = urlDeFichaMovil(url);
    if (destino === null) return null;

    const resultado = await safeFetchImpl(destino);
    if (!resultado.ok) return null;

    // El borrador conserva la URL móvil: es la página que se leyó de verdad y la base contra la que
    // se resuelven sus imágenes relativas. El llamador decide qué URL acaba guardando.
    return {
        draft: extractProduct({ html: resultado.body, url: resultado.finalUrl }),
        finalUrl: resultado.finalUrl,
    };
}
