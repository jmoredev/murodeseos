# Guía de Desarrollo - Muro de Deseos

> **Última revisión de contenido:** 2026-05-13

Esta guía proporciona instrucciones detalladas sobre cómo configurar, desarrollar y mantener el proyecto "Muro de Deseos".

## 🚀 Configuración del Proyecto

### Requisitos Previos
- [Bun](https://bun.sh/) (Runtime y gestor de paquetes)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (Opcional, para desarrollo local de DB)

### Instalación
1. Clona el repositorio:
   ```bash
   git clone <repo-url>
   cd murodeseos
   ```
2. Instala las dependencias:
   ```bash
   bun install
   ```
3. Configura las variables de entorno:
   - **Desarrollo local:** crea `.env.local` (no lo subas a Git) con las claves públicas de tu proyecto:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=tu_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   EXPO_PUBLIC_SITE_URL=http://localhost:8081
   ```
   - **Deploy (GitHub Pages):** crea `.env.production` en la raíz con los mismos nombres de variable y los valores del **proyecto Supabase de producción** y la URL pública del sitio. Los scripts `deploy`, `deploy:test` y `deploy:prod` ejecutan `build:deploy`, que **solo** carga `.env.production` (se desactiva la carga automática de `.env` de Expo y no se usa `.env.local`), así el build no hereda tu base local.

### Comandos de build
- `bun run build` / `npm run build`: export web con la carga habitual de `.env` (útil en local; suele usar `.env.local`).
- `bun run build:deploy` / `npm run build:deploy`: export para publicar, **forzando** variables desde `.env.production`.

### Cómo se publica

`main` es la **línea de desarrollo**: cada merge la actualiza, y el gate corre en cada pull request y en cada merge. **Publicar es un acto deliberado**: el despliegue se dispara al empujar una etiqueta, no en cada merge, porque cada publicación empuja un bundle nuevo a las PWA instaladas y el service worker lo activa de inmediato.

```bash
git switch main && git pull
git tag -a v2026.09.28 -m "Publicar el estado de main del 2026-09-28"
git push origin v2026.09.28
```

El workflow comprueba que la etiqueta apunta a un commit de `main`, ejecuta el build y el gate de extremo a extremo, y solo entonces publica. Para republicar o revertir sin mover etiquetas, se lanza el workflow a mano (`workflow_dispatch`) desde `main`.

La etiqueta marca **cuándo se publicó**, no la versión del producto: esa vive en `app.json` y no se repite aquí, para no tener el mismo dato en dos sitios.

Para saber qué está publicado ahora mismo: `git tag --sort=-creatordate | head -1`. **El registro empieza con la primera etiqueta**: las publicaciones anteriores a este cambio se hicieron sin ninguna, así que hasta que se empuje la primera no habrá nada que consultar.

**Volver atrás.** Hay dos caminos y no son equivalentes. Si el problema es del código y el arreglo está cerca, lo correcto es **arreglar hacia adelante**: un PR a `main` y una etiqueta nueva. Es el único camino que deja `main` y lo publicado contando la misma historia.

Si hay que sacar de producción algo roto **ya**, se vuelve a publicar el último estado bueno etiquetando ese commit:

```bash
git switch main && git pull
git log --oneline -10                          # localizar el último commit bueno
git tag -a v2026.09.29-rollback <commit> -m "Volver al estado bueno del 2026-09-28"
git push origin v2026.09.29-rollback
```

La etiqueta tiene que apuntar a un commit **de `main`**, o el workflow no construye nada. Y viene con una advertencia que importa más que el comando: **`main` y lo publicado divergen** hasta que entre el arreglo, así que la etiqueta siguiente tiene que incluirlo. Si no, el fallo vuelve tal cual.

**Lo que una vuelta atrás no revierte.** No revierte datos ni migraciones, y el bundle antiguo puede no entender un esquema nuevo. Antes de republicar, mira si en el medio se aplicó alguna:

```bash
git log --oneline -- supabase/migrations/
```

Si la hubo, aplica el orden operativo de la sección de la migración de reservas: el código que tolera las dos formas va antes que la migración que las cambia. Y nunca muevas una etiqueta ya publicada: publica una nueva, porque moverla reescribe lo que el registro dice que se publicó.

### Cómo comprobar qué valores usó el build de deploy
1. Pon en `.env.production` un valor distintivo (por ejemplo una URL de Supabase que solo exista en producción).
2. Ejecuta `npm run build:deploy` (o `bun run build:deploy`).
3. En el bundle generado, busca ese valor en archivos bajo `dist/` (por ejemplo `grep` o búsqueda en el IDE sobre la carpeta `dist`). Debe aparecer la URL de producción, no la de `.env.local`.
4. Para desarrollo, ejecuta `bun run dev` y confirma en la app o en la consola de red que sigue apuntando a tu instancia local.

## 🛠️ Desarrollo

### Ejecutar la aplicación
Para iniciar el servidor de desarrollo (Next.js/Expo Web):
```bash
bun run dev
```

### Comandos Útiles
- `bun run lint`: Ejecuta el linter.
- `bun run test:unit`: Ejecuta Vitest (tests unitarios / componentes).
- `bun run test:watch`: Vitest en modo watch.
- `bun run test`: Playwright E2E (requiere `test:e2e:prepare` vía script; ver `package.json`).

## Móvil, PWA y depuración

### Caché del bundle (Expo / Metro / navegador)
Si la UI en web o en el cliente de desarrollo **no refleja** los cambios (clases Tailwind antiguas, `font-display` donde ya no debería aparecer, etc.), suele ser **caché**: recarga forzada del navegador, reinicio de `expo start` con caché limpia (`npx expo start -c`) o reinstalación del build en el dispositivo.

### Service Worker (PWA en producción / GitHub Pages)
`public/sw.js` se copia a `dist/` en el postbuild. Historia corta del SW: la **v3** puso las peticiones **que no son navegación** (bundles JS, chunks, CSS…) en **red primero** (antes eran caché primero y, tras un deploy, el navegador podía seguir sirviendo **JS antiguo**); la **v4** añade la restricción de **same-origin**: el handler de `fetch` solo interviene en peticiones cuyo origen coincide con el del SW (`self.location.origin`) y hace `return` para todo lo demás, así que las GET a la REST/Storage de Supabase (datos privados de deseos y grupos) **nunca entran en Cache Storage** y el navegador las gestiona con normalidad.

Además, el cierre de sesión pasó por un único camino: `lib/sign-out.ts` hace `supabase.auth.signOut()` y, en web, borra todas las caches cuyo nombre empieza por `murodeseos-` (no todas: el origen de GitHub Pages se comparte entre repositorios y las caches de otros proyectos deben sobrevivir). Todos los botones de salir (`app/index.tsx`, `app/wishlist/[id]`, `app/groups/[id]` y `ProfileTab`) usan ese helper.

Al cambiar la estrategia del SW, **sube `VERSION`** en `sw.js` (p. ej. `v3` → `v4`) para que el evento `activate` borre caches con el nombre antiguo (`murodeseos-v3`, etc.); el salto a **v4** purga así cualquier dato privado que bundles anteriores guardaran en `murodeseos-v3`. El registro del SW está en `app/_layout.tsx`.

**Local (`bun run web`, Metro):** no se registra el SW: `hostname` no es `github.io`, `getGithubPagesBasePath()` devuelve `''` y se llama a `unregister()` por si quedó un SW de una prueba anterior. Así HMR y recargas normales no compiten con Cache Storage.

### Cabecera estática de la PWA (`+html.tsx` + postbuild)

La cabecera del HTML estático está partida en dos por capacidad:

- **Meta tags** — `app/+html.tsx` (web-only, se usa en export estático y en `expo start --web`): `lang="es"`, `viewport` con `viewport-fit=cover` (pantallas con notch) y las meta de Apple (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`). No lleva ningún `<link href>`: los href dependen de la ruta base de despliegue y aquí los romperían.
- **Links con href** — `scripts/postbuild.cjs`: tras el export, inyecta un bloque idempotente (`data-murodeseos-pwa="1"`) con favicon, `apple-touch-icon` y manifest en **`dist/index.html` y `dist/404.html`**, leyendo la base de `app.json` (`expo.experiments.baseUrl`, hoy `/murodeseos`) y generando hrefs absolutos. Es necesario en `404.html` porque GitHub Pages la sirve para rutas profundas, donde los href relativos (`./favicon.ico`) resuelven mal. El atributo `lang` ya no se toca en el postbuild: viene de `+html.tsx`.
- **Runtime** — `ensureWebHead()` (`app/_layout.tsx`) solo completa lo que falta tras la hidratación (título, `theme-color`, icono/manifest con la base detectada en el navegador); con los checks de existencia no duplica etiquetas que ya trae el HTML estático. En `expo start --web` (donde el postbuild no corre) es quien aporta los links.

**Iconos de instalación:** `public/manifest.json` declara los iconos `any` (192/512/1024) más `public/AppIcons/maskable-icon-512.png` con `"purpose": "maskable"` — glifo escalado al ~60% central sobre fondo `#fff4f4` (zona segura de ~40% que exige la spec maskable). `public/apple-touch-icon.png` (180x180) es el icono que usa iOS al instalar. El manifest además declara `lang: "es"` y `orientation: "portrait"`.

### `ScrollView` principal (`ResponsiveLayout`)
`contentContainerStyle` usa `alignItems: 'center'`, lo que en React Native **no estira** los hijos al ancho del viewport. El `View` que envuelve `{children}` lleva **`self-stretch`** y **`max-w-full`** en móvil para que pestañas como la lista de deseos ocupen todo el ancho (p. ej. filtros en fila con `flex: 1`).

### Punto de ruptura escritorio (`> 768`)
La convención única de la app para separar escritorio de móvil es **`width > 768`** (Tailwind `md:`), leída con `useWindowDimensions` (`ResponsiveLayout`, `WishListTab`, `WishDetailModal`, etc.). `NotificationMenu` la sigue con `isDesktopViewport` (`useSyncExternalStore` sobre el mismo umbral): en la banda de 641–768 px se muestra la variante móvil de pantalla completa, no el bocadillo flotante.

### Lista de deseos (`WishListTab`)
- **Filtros de ordenación:** fila `width: '100%'`, cada chip con `style={{ flex: 1, minWidth: 0 }}`; en pantalla estrecha las etiquetas son **Nombre / Precio / Prioridad**; en escritorio se mantienen **Por nombre / …**. Los `accessibilityLabel` siguen siendo “Ordenar por …”.
- **Modal nuevo/editar deseo:** `KeyboardAvoidingView`, `ScrollView` con `flex-1` / `min-h-0`, `min-w-0` en inputs y filas, área segura inferior (`useSafeAreaInsets`). **Enlace (opcional):** campo propio que persiste en `wishlist_items.links` (no en `notes`). **Imagen:** URL de foto o **“Elegir de la galería”** → Supabase Storage (`wishlist-images`); plugin `expo-image-picker` en `app.json`. En tarjetas y detalle, el enlace se muestra recortado con `WishLinkChip` (`lib/wish-link-utils.ts`).
- **Subida de imagen (`lib/wish-image-upload.ts`):** en **web/PWA móvil** el botón abre un `<input type="file" accept="image/*">` oculto de forma síncrona con el clic (los navegadores bloquean el selector si hay `await` antes). En **iOS/Android** se pide permiso de galería y se usa `expo-image-picker` con `base64` para evitar `fetch` sobre URIs locales. La utilidad normaliza `File`, `asset.file` (web) o `base64` (nativo) antes del `upload` a Storage.

### Lista de deseos de otro usuario (`app/wishlist/[id]/index.tsx`)
- Al pulsar una tarjeta se abre **`WishDetailModal`**: imagen, prioridad, precio, notas, enlaces y acciones de reserva/cancelar. El estado del modal se sincroniza si el usuario reserva desde la tarjeta o desde el detalle.
- **Reservar regalo ajeno:** botones de acción fuera del área clicable de la tarjeta (evita conflictos en móvil/web). La mutación usa `lib/wish-reservation.ts`, que escribe en `public.wishlist_reservations`: la clave primaria de `item_id` garantiza una sola reserva por deseo y ya existe `reserved_at`. El estado se lee por la función `get_wishlist_reservation_states`, que devuelve solo `item_id` y si la reserva es mía, así que la autoría nunca llega al cliente; el dueño no recibe estado de sus propios deseos. La visibilidad de la lista —grupo compartido y exclusiones— la aplica la política RLS de `wishlist_items` y no se reimplementa en el cliente. Feedback con toast.
- **Migración de reservas, en dos fases ya completadas:** la reserva vive en `public.wishlist_reservations` y ya **no** existe `wishlist_items.reserved_by`. La fase 1 (`20260925120000`) movió los datos y conservó la columna como espejo del bundle ya desplegado, con un puente de disparadores; la fase 2 (`20260928120000`) retiró la columna, su índice, su clave foránea, el puente y la política de compatibilidad, y devolvió el trigger de permisos a su forma estricta. Con la columna fuera, la identidad de quien reserva no está en `wishlist_items`. Un bundle anterior a este cambio falla al reservar o cancelar con `42703` y necesita recargar, y la recarga sí trae el código nuevo porque el service worker sirve JS/CSS con red primero. Documentado en `odd/tasks/reservas.md`. **Orden operativo:** el código que tolera las dos formas del esquema se publica **antes** que la migración que lo cambia, y la retirada va después; migrar primero deja a los bundles en vuelo sin nada que los entienda. Las dos fases de esta migración siguieron ese orden.
- E2E: `responsive-wishlist.spec.ts` incluye el caso “debe abrir el detalle al hacer clic en un deseo” (`wish-detail-modal`, `wish-detail-title`).

### Botón icono “+” (`PrimaryButton`, variante `icon`)
Cuando el hijo es solo el carácter `+`, se renderiza con **estilos propios** (`font-sans-bold`, métricas en `lib/circle-glyph-styles`) y **no** se reutiliza `textClassName` del sitio de uso, para evitar mezclas con `font-display` / `leading-none` que desplazan el glifo. El gradiente rellena el botón con posicionamiento absoluto y un `View` intermedio con `flex: 1`.

### Iconos y emojis en círculos
Utilidades en `lib/circle-glyph-styles.ts` (`circleGlyphTextBase`, `emojiInCircle`) para centrar texto/emoji en Android/iOS (p. ej. barra inferior en `ResponsiveLayout`, avatares en `GroupCard`).

### Detalle de grupo (`app/groups/[id]/index.tsx`)
Código del grupo en chip con `ellipsizeMode="middle"`; contador de participantes **debajo** del chip; avatares con `Image` si la URL es http(s).

- **Enlace de invitación:** tanto `generateShareMessage` (`lib/group-utils.ts`) como el botón "Compartir enlace" de `GroupsTab` construyen la URL con `getSiteBaseUrl()` (`lib/site-url.ts`), de modo que el enlace de invitación conserva la ruta base `/murodeseos` en GitHub Pages (el origen solo no basta porque la app se sirve bajo `/<repo>/`).

### TypeScript (`tsconfig.json`)
En `compilerOptions.types` se usa **`vitest/globals`** en lugar de `jest`, alineado con Vitest.

## 🧪 Testing

El proyecto utiliza **Vitest** como framework de pruebas unitarias y de componentes.

### Estructura de pruebas
Los tests se encuentran en el directorio `__tests__`.
- `wish-image-upload.test.ts`: utilidades de extensión MIME, base64 y rutas de Storage para imágenes de deseos.
- `wish-link-utils.test.ts`: normalización, truncado y deduplicación de enlaces de deseos.
- `wish-reservation.test.ts`: reserva y cancelación en listas ajenas vía Supabase.
- Nombramiento: `Componente.test.tsx` o `utilidad.test.ts`.

### E2E (Playwright en CI)
`playwright.config.ts` define 5 proyectos (`chromium`, `firefox`, `webkit`, `Mobile Chrome`, `Mobile Safari`), pero CI (`.github/workflows/e2e.yml`) ejecuta solo dos:

1. **`chromium`** (escritorio) — contra la base sembrada por `test:e2e:prepare`.
2. **`Mobile Chrome`** (Pixel 5) — tras **re-sembrar** con `test:e2e:prepare` de nuevo y lanzar una invocación Playwright separada.

Por qué así:
- **Re-siembra por proyecto (defecto abierto E-10):** la suite no es auto-limpiante y deja grupos de prueba en la base. Dos proyectos sobre la misma siembra equivalen a correr la suite dos veces contra un solo fixture, con riesgo de contaminación cruzada. Re-sembrar antes de Mobile Chrome le da un fixture limpio.
- **Mobile Chrome usa el motor Chromium** ya instalado con `playwright install --with-deps chromium`; no requiere instalación adicional.
- **Firefox, WebKit y Mobile Safari quedan fuera de CI** deliberadamente: cada uno exigiría una descarga de navegador nueva en el runner (`playwright install firefox` / `webkit`), alargando el job. Se pueden correr localmente con `pnpm exec playwright test --project=<nombre>`.

Si CI falla, se suben como artefactos `playwright-report-chromium` / `playwright-report-mobile-chrome` con `playwright-report/` (reporte HTML) y `test-results/` (capturas y trazas de fallo).

## ♿ Checklist de Accesibilidad (antes de publicar)

- **Teclado (web)**: puedes navegar por toda la UI con Tab/Shift+Tab y activar con Enter/Espacio.
- **Foco visible**: el elemento enfocado se distingue claramente (especialmente en inputs y botones).
- **Modales/overlays**:
  - Al abrir, el foco cae dentro del modal.
  - Con `Escape` se cierra (web).
  - Al cerrar, el foco vuelve al elemento que lo abrió.
- **Mensajes dinámicos**: errores/éxitos (login/registro) se anuncian sin tener que “buscar” el texto.
- **Zoom 200%**: el contenido sigue siendo usable sin solaparse.
- **Idioma**: el documento web está en español (`lang="es"` en `app/+html.tsx`; `ensureWebHead` lo reafirma en runtime como red de seguridad).

### Implementación en código (referencia rápida)

- **Foco visible (web):** reglas `:focus-visible` en `app/global.css` (dentro de `@layer base`).
- **Saltar al contenido (solo web):** `components/ResponsiveLayout.tsx` — `Pressable` con clase `skip-to-main`; región principal `ScrollView` con `nativeID="muro-main-content"`; `scroll-margin-top` en `app/global.css` para cabecera fija.
- **Navegación principal:** escritorio usa `role="tablist"` / `role="tab"` (web); móvil: pestañas inferiores con `importantForAccessibility="no-hide-descendants"` en el contenido decorativo para no duplicar el nombre con el emoji.
- **Diálogos web (`createPortal`):** `ConfirmModal`, `UserProfileModal`, `RevealModal`, `SecretSantaModal` — `role="dialog"`, `aria-modal`, título vinculado, `Escape`, foco inicial y restauración; `NotificationItem` es `<button type="button">` con `aria-label` descriptivo.
- **`PrimaryButton`:** si no pasas `accessibilityLabel` y `children` es un string, se usa como etiqueta accesible.

### Limitaciones conocidas

- **`GroupCard`:** la tarjeta entera es un `Pressable` que contiene otros controles (compartir, menú, filas de miembros). Es un patrón de “interactivo anidado” imperfecto para algunos lectores de pantalla; los controles internos siguen siendo alcanzables por teclado en web.
- **Focus trap completo** (ciclo de tab solo dentro del modal) no está implementado en todos los diálogos; sí hay Escape y retorno de foco básico.

### Mocks Globales
Si necesitas añadir mocks globales para nuevos módulos de terceros, edita `vitest.setup.ts`.

## ⚡ Estándares de Rendimiento

Para mantener la aplicación rápida y fluida:

1. **Peticiones en Paralelo**: Usa `Promise.all` para peticiones de Supabase en el mismo nivel lógico.
2. **Memoización**: Usa `React.memo` para componentes de lista pesados (ej. `GroupCard`).
3. **Joins vs consultas separadas**: Un `select` anidado tipo `group_members(..., profiles(...))` puede fallar o devolver vacío con PostgREST/RLS. Para la **lista de grupos** se replica el patrón de detalle: filas en `group_members` y luego `profiles` con `.in('id', userIds)`. Ver `components/GroupsTab.tsx` (aprox. 56–100 y 106–132) y `app/groups/[id]/index.tsx` (aprox. 49–73).
4. **Ternary Rendering**: Usa operadores ternarios `{cond ? <A /> : null}` en lugar de `&&` para evitar errores de renderizado en React Native Web/PWA.

## 🏗️ Arquitectura

- **Routing**: [Expo Router](https://expo.github.io/router) (File-based routing).
- **Layout**: `ResponsiveLayout.tsx` maneja la adaptación entre Desktop y Mobile.
- **Estilos**: NativeWind (Tailwind CSS para React Native).

### Grupos: contador de participantes en lista

- `GroupCard` muestra el total con `totalMemberCount` cuando existe; si no, cae en `members.length` (`components/GroupCard.tsx`, línea 120).
- `members` en la lista **excluye al usuario actual** (solo vista previa de “otros”); el total real debe venir de `totalMemberCount`, poblado con el número de filas de `group_members` por grupo (`components/GroupsTab.tsx`, líneas 106–132).

---
*Muro de Deseos - Hecho con ❤️ para organizar tus regalos.*
