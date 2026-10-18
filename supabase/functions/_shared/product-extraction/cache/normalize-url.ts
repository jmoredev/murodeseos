/**
 * Normalización de la URL para la **clave de caché** del extractor.
 *
 * No es una identidad del producto ni una canónica: es solo la forma bajo la que dos peticiones
 * que piden **lo mismo** comparten una fila de caché. Por eso la canonización es deliberadamente
 * mínima y **no adivina**:
 *
 * - No sigue redirecciones. Adivinarlas exigiría pedir la página, que es exactamente lo que la
 *   caché evita. La URL final real la resuelve la capa de red y viaja en `final_url` de la fila.
 * - No aplica reglas de canónica de ninguna tienda (`rel=canonical`, `/producto/123` vs
 *   `/producto/123-nombre`): cada tienda decide la suya, y asumirla movería la clave bajo los pies.
 * - No toca el camino: `/Producto` y `/producto` son claves distintas, porque hay servidores que
 *   los sirven distinto.
 *
 * Lo que sí hace, que es lo que el parser de URL ya canoniza o se puede decidir sin ambigüedad:
 * quita el fragmento (nunca viaja al servidor), baja a minúsculas esquema y host, descarta el
 * puerto por defecto del esquema y ordena los parámetros de la query.
 *
 * Decisión sobre los **parámetros vacíos** (`?color=`): se **conservan**. Descartarlos sería
 * suponer que el servidor los ignora; si no los ignora, dos URLs distintas colisionarían en la
 * misma fila y el usuario recibiría el borrador de otra variante. El coste de conservarlos es que
 * `?color=` y sin `?color` no comparten fila, que es el lado seguro del error.
 */

/**
 * Devuelve la clave de caché de una URL de producto, o `null` si la URL no es un http(s) que la
 * capa de red pueda pedir (texto inválido, esquema `mailto:`, `ftp:`…). Nunca tira.
 */
export function normalizeCacheKey(rawUrl: unknown): string | null {
    let url: URL;
    try {
        if (rawUrl instanceof URL) {
            url = new URL(rawUrl.href);
        } else if (typeof rawUrl === 'string') {
            url = new URL(rawUrl);
        } else {
            return null;
        }
    } catch {
        return null;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    // El parser ya bajó esquema y host a minúsculas y ya dejó el puerto en `''` cuando es el del
    // esquema (443 para https, 80 para http). No hace falta tocarlos a mano.
    url.hash = '';

    const parametros = [...url.searchParams.entries()];
    parametros.sort((a, b) => {
        if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
        if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
        return 0;
    });

    url.search = '';
    for (const [clave, valor] of parametros) url.searchParams.append(clave, valor);

    return url.href;
}
