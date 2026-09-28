/**
 * URL base del sitio, para construir enlaces absolutos que Supabase envía por
 * correo (hoy, la confirmación del alta). Es la variable documentada en
 * `env.example`, que hasta ahora no se usaba en ningún sitio.
 *
 * Orden de resolución:
 * 1. `EXPO_PUBLIC_SITE_URL`, que es lo que se configura en el despliegue.
 * 2. El origen actual más la ruta base del sitio: GitHub Pages sirve la app bajo
 *    `/<repo>/`, así que el origen solo no basta.
 * 3. `http://localhost:8081`, el servidor de desarrollo de Expo, para cualquier
 *    ejecución fuera del navegador.
 */

const LOCAL_DEV_SITE_URL = 'http://localhost:8081';

/** Ruta bajo la que se sirve la app en GitHub Pages; vacía en cualquier otro host. */
export function getGithubPagesBasePath(): string {
    if (typeof window === 'undefined') return '';

    const isGithubPages = window.location.hostname.endsWith('github.io');
    if (!isGithubPages) return '';

    const pathname = window.location.pathname || '/';
    const maybeRepoBase = pathname.split('/').filter(Boolean)[0];

    const fallbackRepo = 'murodeseos';
    return `/${maybeRepoBase || fallbackRepo}`;
}

export function getSiteBaseUrl(): string {
    const configured = process.env.EXPO_PUBLIC_SITE_URL?.trim();
    if (configured) return configured.replace(/\/+$/, '');

    if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${getGithubPagesBasePath()}`;
    }

    return LOCAL_DEV_SITE_URL;
}
