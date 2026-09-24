/* PWA service worker — GitHub Pages bajo /<repo>/. v3: activos JS/CSS red-primero (evita UI antigua). */

const VERSION = 'v3';
const CACHE_NAME = `murodeseos-${VERSION}`;

const NAV_FETCH_MS = 14_000;

const CORE_ASSETS = [
  './',
  './manifest.json',
  './AppIcons/android/mipmap-xxxhdpi/app_icon.png',
  './AppIcons/Assets.xcassets/AppIcon.appiconset/_/512.png',
];

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
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
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

  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetchWithTimeout(request, NAV_FETCH_MS);
          if (fresh.ok) {
            try {
              const cache = await caches.open(CACHE_NAME);
              cache.put(request, fresh.clone());
            } catch {
              /* no-op */
            }
          }
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('./');
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
        }
        return fresh;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return Response.error();
      }
    })()
  );
});
