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
   EXPO_PUBLIC_SITE_URL=http://localhost:3000
   ```
   - **Deploy (GitHub Pages):** crea `.env.production` en la raíz con los mismos nombres de variable y los valores del **proyecto Supabase de producción** y la URL pública del sitio. Los scripts `deploy`, `deploy:test` y `deploy:prod` ejecutan `build:deploy`, que **solo** carga `.env.production` (se desactiva la carga automática de `.env` de Expo y no se usa `.env.local`), así el build no hereda tu base local.

### Comandos de build
- `bun run build` / `npm run build`: export web con la carga habitual de `.env` (útil en local; suele usar `.env.local`).
- `bun run build:deploy` / `npm run build:deploy`: export para publicar, **forzando** variables desde `.env.production`.

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
`public/sw.js` se copia a `dist/` en el postbuild. A partir de la **v3** del SW, las peticiones **que no son navegación** (bundles JS, chunks, CSS…) usan **red primero** y solo caen en `Cache Storage` si la red falla (modo offline). Las versiones anteriores usaban **caché primero** para esos recursos: tras un deploy el navegador podía seguir sirviendo **JS antiguo** hasta vaciar caché o recargar de forma que invalidara el SW.

Al cambiar la estrategia del SW, **sube `VERSION`** en `sw.js` (p. ej. `v3` → `v4`) para que el evento `activate` borre caches con el nombre antiguo (`murodeseos-v3`, etc.). El registro del SW está en `app/_layout.tsx`.

**Local (`bun run web`, Metro):** no se registra el SW: `hostname` no es `github.io`, `getGithubPagesBasePath()` devuelve `''` y se llama a `unregister()` por si quedó un SW de una prueba anterior. Así HMR y recargas normales no compiten con Cache Storage.

### `ScrollView` principal (`ResponsiveLayout`)
`contentContainerStyle` usa `alignItems: 'center'`, lo que en React Native **no estira** los hijos al ancho del viewport. El `View` que envuelve `{children}` lleva **`self-stretch`** y **`max-w-full`** en móvil para que pestañas como la lista de deseos ocupen todo el ancho (p. ej. filtros en fila con `flex: 1`).

### Lista de deseos (`WishListTab`)
- **Filtros de ordenación:** fila `width: '100%'`, cada chip con `style={{ flex: 1, minWidth: 0 }}`; en pantalla estrecha las etiquetas son **Nombre / Precio / Prioridad**; en escritorio se mantienen **Por nombre / …**. Los `accessibilityLabel` siguen siendo “Ordenar por …”.
- **Modal nuevo/editar deseo:** `KeyboardAvoidingView`, `ScrollView` con `flex-1` / `min-h-0`, `min-w-0` en inputs y filas, área segura inferior (`useSafeAreaInsets`). **Enlace (opcional):** campo propio que persiste en `wishlist_items.links` (no en `notes`). **Imagen:** URL de foto o **“Elegir de la galería”** → Supabase Storage (`wishlist-images`); plugin `expo-image-picker` en `app.json`. En tarjetas y detalle, el enlace se muestra recortado con `WishLinkChip` (`lib/wish-link-utils.ts`).
- **Subida de imagen (`lib/wish-image-upload.ts`):** en **web/PWA móvil** el botón abre un `<input type="file" accept="image/*">` oculto de forma síncrona con el clic (los navegadores bloquean el selector si hay `await` antes). En **iOS/Android** se pide permiso de galería y se usa `expo-image-picker` con `base64` para evitar `fetch` sobre URIs locales. La utilidad normaliza `File`, `asset.file` (web) o `base64` (nativo) antes del `upload` a Storage.

### Lista de deseos de otro usuario (`app/wishlist/[id]/index.tsx`)
- Al pulsar una tarjeta se abre **`WishDetailModal`**: imagen, prioridad, precio, notas, enlaces y acciones de reserva/cancelar. El estado del modal se sincroniza si el usuario reserva desde la tarjeta o desde el detalle.
- E2E: `responsive-wishlist.spec.ts` incluye el caso “debe abrir el detalle al hacer clic en un deseo” (`wish-detail-modal`, `wish-detail-title`).

### Botón icono “+” (`PrimaryButton`, variante `icon`)
Cuando el hijo es solo el carácter `+`, se renderiza con **estilos propios** (`font-sans-bold`, métricas en `lib/circle-glyph-styles`) y **no** se reutiliza `textClassName` del sitio de uso, para evitar mezclas con `font-display` / `leading-none` que desplazan el glifo. El gradiente rellena el botón con posicionamiento absoluto y un `View` intermedio con `flex: 1`.

### Iconos y emojis en círculos
Utilidades en `lib/circle-glyph-styles.ts` (`circleGlyphTextBase`, `emojiInCircle`) para centrar texto/emoji en Android/iOS (p. ej. barra inferior en `ResponsiveLayout`, avatares en `GroupCard`).

### Detalle de grupo (`app/groups/[id]/index.tsx`)
Código del grupo en chip con `ellipsizeMode="middle"`; contador de participantes **debajo** del chip; avatares con `Image` si la URL es http(s).

### TypeScript (`tsconfig.json`)
En `compilerOptions.types` se usa **`vitest/globals`** en lugar de `jest`, alineado con Vitest.

## 🧪 Testing

El proyecto utiliza **Vitest** como framework de pruebas unitarias y de componentes.

### Estructura de pruebas
Los tests se encuentran en el directorio `__tests__`.
- `wish-image-upload.test.ts`: utilidades de extensión MIME, base64 y rutas de Storage para imágenes de deseos.
- `wish-link-utils.test.ts`: normalización, truncado y deduplicación de enlaces de deseos.
- Nombramiento: `Componente.test.tsx` o `utilidad.test.ts`.

## ♿ Checklist de Accesibilidad (antes de publicar)

- **Teclado (web)**: puedes navegar por toda la UI con Tab/Shift+Tab y activar con Enter/Espacio.
- **Foco visible**: el elemento enfocado se distingue claramente (especialmente en inputs y botones).
- **Modales/overlays**:
  - Al abrir, el foco cae dentro del modal.
  - Con `Escape` se cierra (web).
  - Al cerrar, el foco vuelve al elemento que lo abrió.
- **Mensajes dinámicos**: errores/éxitos (login/registro) se anuncian sin tener que “buscar” el texto.
- **Zoom 200%**: el contenido sigue siendo usable sin solaparse.
- **Idioma**: el documento web está en español (`lang="es"` en `app/_layout.tsx`, función `ensureWebHead`).

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
