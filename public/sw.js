/* PWA service worker — GitHub Pages bajo /<repo>/. v6: recibe el **share target** (`POST` de la hoja de compartir de Android) y lo entrega a la app. Mantiene lo de la v5: la cáscara NO se cachea (una cáscara guardada puede referenciar chunks que el despliegue siguiente ya borró, y eso dejaba la pantalla en negro sin recuperación: se sirve una página de sin conexión autocontenida), las respuestas no-ok de un recurso no se entregan como si fueran el recurso, y siguen sin entrar en caché las peticiones a otros orígenes (los datos privados de Supabase nunca se guardan). Activos red-primero. */

const VERSION = 'v6';
const CACHE_NAME = `murodeseos-${VERSION}`;
// El origen de GitHub Pages se comparte entre repositorios: solo tocamos las
// caches con nuestro prefijo, nunca las de otros proyectos alojados ahí.
const CACHE_PREFIX = 'murodeseos-';

/**
 * Caché del share target, **aparte** de la de activos y sin versión propia.
 *
 * Aparte porque un compartir pendiente no es un activo: no se refresca ni se invalida con un
 * despliegue, y vive minutos, no días. Y sin versión (`murodeseos-share`, no `murodeseos-share-v1`)
 * para que el barrido de `activate` no pueda borrar un compartir a medio abrir.
 */
const SHARE_CACHE = 'murodeseos-share';
/** Prefijo de la clave con la que la app encuentra el compartir (`lib/share-target.ts`). */
const SHARE_KEY_PREFIX = 'share-payload/';
/** Mismo destino que `share_target.action` del manifest (`./compartir`). */
const SHARE_TARGET_PATH = 'compartir';

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
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME && k !== SHARE_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

/**
 * Ámbito del SW como URL absoluta. Es lo que permite que el mismo `sw.js` funcione en
 * `/<repo>/` y en la raíz sin escribir la base en el código.
 */
function shareScope() {
  try {
    return new URL(self.registration.scope);
  } catch {
    return new URL('.', self.location.href);
  }
}

/**
 * ¿Es el POST de la hoja de compartir? Se compara **origen y ruta exacta**: el `action` del
 * manifest es `./compartir`, así que cualquier otro POST del sitio (o de otro origen) sigue su
 * camino y no se intercepta.
 */
function isShareTargetRequest(request) {
  try {
    const action = new URL(SHARE_TARGET_PATH, shareScope());
    const target = new URL(request.url);
    return target.origin === action.origin && target.pathname === action.pathname;
  } catch {
    return false;
  }
}

/**
 * El primer `http(s)` que aparezca en el texto compartido.
 *
 * Muchas apps de compras no rellenan el campo `url` del share: mandan todo junto en `text`
 * («Mira esto https://…»). Sin esto, compartir desde esas apps abriría un deseo sin enlace y sin
 * extracción, que es justo el caso que el feature existe para resolver.
 */
function firstUrlInText(text) {
  const match = /https?:\/\/[^\s<>"']+/i.exec(text || '');
  return match ? match[0] : null;
}

/**
 * Guarda el compartir y devuelve el id con el que la app lo va a buscar, o `null` si el cuerpo
 * no era un formulario o no traía nada. Nunca tira: un share ilegible tiene que terminar en la
 * app, no en un error del navegador.
 */
async function storeShare(request) {
  let fields;
  try {
    const form = await request.formData();
    const read = (name) => {
      const value = form.get(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    fields = { title: read('title'), text: read('text'), url: read('url') };
  } catch {
    return null;
  }

  const payload = {
    url: fields.url || firstUrlInText(fields.text),
    title: fields.title,
    text: fields.text,
    createdAt: Date.now(),
  };

  if (!payload.url && !payload.title && !payload.text) return null;

  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const cache = await caches.open(SHARE_CACHE);
    await cache.put(
      new URL(`${SHARE_KEY_PREFIX}${id}`, shareScope()).href,
      new Response(JSON.stringify(payload), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      })
    );
  } catch {
    // Sin Cache Storage no hay dónde dejar el compartir; igual se abre la app.
    return null;
  }

  return id;
}

/**
 * El `POST` de la hoja de compartir: guarda el payload y contesta un `303` (ver-otro) al
 * formulario, que es un `GET` normal y lo sirve la página estática con normalidad.
 */
async function handleShareTarget(request) {
  const action = new URL(SHARE_TARGET_PATH, shareScope());
  const id = await storeShare(request);
  if (id) action.searchParams.set('share', id);

  return new Response(null, { status: 303, headers: { location: action.href } });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    // La hoja de compartir de Android entrega un POST que ninguna página estática puede
    // atender: se guarda acá y se responde un 303 al formulario. Cualquier otro método o ruta
    // sigue sin tocarse.
    if (request.method === 'POST' && isShareTargetRequest(request)) {
      event.respondWith(handleShareTarget(request));
    }
    return;
  }

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
