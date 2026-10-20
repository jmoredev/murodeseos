/**
 * El juego **canónico** de headers de navegador para pedir una página de producto.
 *
 * No es cosmética: medido el 2026-10-18 con `curl` sobre páginas reales, El Corte Inglés
 * responde **403** a un `User-Agent` suelto y **200** con el juego completo (`Accept`,
 * `Accept-Language`, `sec-ch-ua*` y `Sec-Fetch-*`). La misma URL, distinto resultado, por los
 * headers.
 *
 * Vive acá y no en `scripts/lib/fixture-capture.ts` porque hay **una sola** fuente de verdad:
 * la captura de fixtures y la capa de red (T4) tienen que mandar exactamente lo mismo, o el
 * fixture deja de representar lo que la Edge Function va a recibir. El script reexporta esta
 * función tal cual.
 */

/**
 * Devuelve una copia nueva del juego de headers medido. Se devuelve un objeto nuevo en cada
 * llamada para que quien lo reciba pueda tocarlo sin alterar el original.
 */
export function buildBrowserHeaders(): Record<string, string> {
    return {
        'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
        'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'cache-control': 'max-age=0',
    };
}
