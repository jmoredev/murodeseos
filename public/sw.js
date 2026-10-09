/* PWA service worker — GitHub Pages bajo /<repo>/. v5: la cáscara NO se cachea (una cáscara guardada puede referenciar chunks que el despliegue siguiente ya borró, y eso dejaba la pantalla en negro sin recuperación: se sirve una página de sin conexión autocontenida), las respuestas no-ok de un recurso no se entregan como si fueran el recurso, y siguen sin entrar en caché las peticiones a otros orígenes (los datos privados de Supabase nunca se guardan). Activos red-primero. */

const VERSION = 'v5';
const CACHE_NAME = `murodeseos-${VERSION}`;
// El origen de GitHub Pages se comparte entre repositorios: solo tocamos las
// caches con nuestro prefijo, nunca las de otros proyectos alojados ahí.
const CACHE_PREFIX = 'murodeseos-';

const NAV_FETCH_MS = 14_000;

const CORE_ASSETS = [
  // La cáscara (`'./'`) NO está aquí a propósito: ver `offlinePage()`.
  './manifest.json',
  './AppIcons/android/mipmap-xxxhdpi/app_icon.png',
  './AppIcons/Assets.xcassets/AppIcon.appiconset/_/512.png',
];

/**
 * Página de sin conexión **autocontenida**: sin CSS ni JS externos, así que no
 * puede fallar por un activo que ya no exista.
 *
 * Es la respuesta cuando una navegación no se puede servir, y sustituye a la
 * cáscara cacheada que se servía antes. Aquella cáscara era el problema: el
 * bundle es un único `entry-<hash>.js` cuyo nombre ES el hash, así que publicar
 * una versión **borra** el anterior del servidor, y una cáscara guardada en
 * caché puede estar apuntando a un chunk que ya no existe. El `<script>` recibía
 * entonces el HTML del 404 y la aplicación no llegaba a montarse: pantalla
 * negra, sin texto y sin más salida que reiniciar.
 */
function offlinePage() {
  return new Response(
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Sin conexión</title></head>' +
      '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff4f4;color:#4c212b;font-family:system-ui,-apple-system,sans-serif">' +
      '<main style="text-align:center;padding:2rem;max-width:26rem">' +
      '<h1 style="font-size:1.25rem;margin:0 0 0.5rem">Sin conexión</h1>' +
      '<p style="margin:0 0 1.5rem;line-height:1.5;opacity:0.8">No se ha podido cargar la aplicación. Comprueba tu conexión e inténtalo de nuevo.</p>' +
      '<button onclick="location.reload()" style="min-height:44px;padding:0.75rem 1.5rem;border:0;border-radius:9999px;background:#aa2c32;color:#fff4f4;font-size:1rem;font-weight:700;cursor:pointer">Reintentar</button>' +
      '</main></body></html>',
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}

function fetchWithTimeout(request, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(request, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(CORE_ASSETS);
      } catch {
        /* Red lenta o addAll parcial: no impedir la activación del SW */
      } finally {
        await self.skipWaiting();
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // El origen de GitHub Pages se comparte entre proyectos: las peticiones a otros
  // orígenes (p. ej. la REST/Storage de Supabase con datos privados) no pasan por
  // la caché del SW; el navegador las gestiona con normalidad.
  if (new URL(request.url).origin !== self.location.origin) return;

  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetchWithTimeout(request, NAV_FETCH_MS);
          // Se devuelve la respuesta **fresca tal cual, también si es un 404**, y
          // nunca se cachea. Un 404 aquí NO es un fallo de red: Pages sirve las
          // rutas dinámicas (`/groups/<uuid>`, `/wishlist/<id>`) con el cuerpo del
          // `index.html` **actual**, así que la app arranca y enruta con
          // normalidad. Convertirlo en la página de sin conexión rompía enlaces
          // profundos y recargas **estando en línea**, y como el botón de
          // reintentar pide lo mismo, dejaba un callejón sin salida.
          //
          // El negro se arregla en el `catch`: ahí es donde antes se servía una
          // cáscara **cacheada**, que podía apuntar a chunks ya borrados.
          return fresh;
        } catch {
          // Fallo de red o tiempo agotado: no se sirve ninguna cáscara cacheada
          // (puede referenciar chunks que el despliegue siguiente ya borró), sino
          // una página autocontenida que no depende de ningún activo.
          return offlinePage();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      // Red primero: tras un deploy los bundles tienen otro hash; así no se sirve JS/CSS obsoleto
      // desde Cache Storage (antes: cache-first y la UI quedaba “pegada” a una versión antigua).
      try {
        const fresh = await fetchWithTimeout(request, NAV_FETCH_MS);
        if (fresh.ok) {
          try {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, fresh.clone());
          } catch {
            /* no-op */
          }
          return fresh;
        }
        // Respuesta no-ok: entregarla sería darle a un `<script>` el HTML de un
        // 404 de Pages, que el navegador intentaría ejecutar como JavaScript.
        // El fallo se declara como fallo.
        const cached = await caches.match(request);
        return cached ?? Response.error();
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return Response.error();
      }
    })()
  );
});
