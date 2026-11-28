/**
 * ¿El fallo es de red y no de credenciales?
 *
 * `@supabase/supabase-js` devuelve el fallo de `fetch` como
 * `AuthRetryableFetchError` («Failed to fetch») y, cuando el navegador corta
 * antes de responder, la llamada lanza un `TypeError`. Los dos casos son el
 * mismo para quien usa la pantalla: no se ha podido conectar, y lo escrito
 * sigue ahí (`11-acceso.html`, P5).
 */
export function isOfflineError(error: unknown): boolean {
    const message =
        error && typeof error === 'object' && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';

    const text = `${message} ${error instanceof Error ? error.name : ''}`.toLowerCase();

    return (
        text.includes('fetch') ||
        text.includes('network') ||
        text.includes('networkerror') ||
        text.includes('offline') ||
        text.includes('sin conexion') ||
        text.includes('sin conexión')
    );
}
