# Cache privado del service worker (fix/sw-cache-privado)

**Abierta:** 2026-09-29 · **Rama:** `fix/sw-cache-privado` (desde `main`) · **Estado:** implementada, verificada y revisada (aprobada). Pendiente de entrega (push/PR decisión del usuario)

## Objetivo

Que el service worker de la PWA nunca guarde datos privados en `Cache Storage`, y que
los que ya se guardaron se eliminen al cerrar sesión. Primera de las tres unidades
derivadas de la auditoría PWA/móvil (memoria: «Auditoría PWA/móvil», 2026-09-29).

## Hallazgos que la motivan

- `public/sw.js:51` — el `fetch` handler filtra solo por método (`GET`), sin comprobar
  el origen: las peticiones autenticadas de Supabase (REST/Storage: deseos, grupos,
  avatares) quedan en `Cache Storage` y sobreviven al cierre de sesión. En offline el
  SW puede servir datos privados de una sesión ya cerrada.
- El cierre de sesión ocurre en 4 sitios sin pasar por ningún punto común:
  `app/index.tsx:75`, `app/wishlist/[id]/index.tsx:160`, `app/groups/[id]/index.tsx:134`
  (vía `onSignOut` de `ResponsiveLayout`) y `components/ProfileTab.tsx:226`.

## Decisiones

- **Same-origin en el SW:** el `fetch` handler ignora (sin `respondWith`) toda petición
  cuyo origen no sea `self.location.origin`. El navegador las gestiona sin caché del SW.
  Las peticiones same-origin mantienen la estrategia v3 (red primero).
- **Bump `VERSION` a `v4`:** el evento `activate` ya borra los caches con nombre
  antiguo; al subir la versión, los clientes instalados purgan el `murodeseos-v3` que
  puede contener datos privados. Es la remediación para lo ya cacheado.
- **Limpieza al cerrar sesión:** helper común (`lib/sign-out.ts`) que hace
  `supabase.auth.signOut()` y borra los caches cuyo nombre empiece por `murodeseos-`
  (no todos los del origen: `github.io` es un origen compartido entre repos del
  usuario). Los 4 sitios de cierre pasan a usarlo.
- **E2E no aplicable:** el SW solo se registra en `github.io` (`app/_layout.tsx`
  desregistra en localhost), así que la cobertura es unitaria: evaluar `public/sw.js`
  en un entorno controlado con `self`/`caches`/`fetch` simulados.

## Tareas

| # | Tarea | Estado |
| --- | --- | --- |
| 1 | SW: ignorar peticiones cross-origin en el fetch handler y subir `VERSION` a `v4` | **hecho** | guarda de origen en `public/sw.js:62`, antes de cualquier `respondWith`; `activate` acotado al prefijo `murodeseos-` (desviación necesaria: antes borraba caches ajenos del origen compartido) |
| 2 | Helper `lib/sign-out.ts` (signOut + limpieza de caches `murodeseos-*`) y reemplazar los 4 call sites | **hecho** | guarda `typeof window === 'undefined' || !window.caches` (truthiness, para que el test de rama no web sea real); `onSignOut={signOut}` en las 3 pantallas y `onPress={signOut}` en `ProfileTab` |
| 3 | Tests unitarios: comportamiento del SW y de `signOut` | **hecho** | `__tests__/sw.test.ts` ejecuta el `sw.js` real en sandbox `vm` (cross-origin sin `respondWith` ni `fetch`, same-origin red-primero, `activate` borra v2/v3 y respeta `other-project-v1`); `__tests__/sign-out.test.ts` (borra solo `murodeseos-*`, resuelve sin caches y con `delete` que falla) |
| 4 | Documentar la v4 y la limpieza al cerrar sesión en `docs/DEVELOPMENT.md` | **hecho** | sección Service Worker reescrita: historia v3→v4, same-origin, cierre único en `lib/sign-out.ts` |

## Verificación

- Writer (autoverificación, TDD RED→GREEN observado): `pnpm run test:unit` 19 archivos / 167 tests + 1 todo en verde; `pnpm run typecheck` y `pnpm run lint` limpios.
- Verificador independiente (solo lectura): PASS en los 6 puntos; confirma que ninguna vía puede guardar una respuesta cross-origin (los dos únicos `cache.put` son inalcanzables tras la guarda; el `addAll` del `install` usa URLs relativas same-origin). Sin defectos altos/medios.
- Notas del verificador cerradas: **D1** (el test «sin caches» no ejercía la guarda porque `'caches' in window` sigue siendo cierto con stub `undefined`) → guarda cambiada a truthiness `!window.caches`; **D5** (dos deslices gramaticales en docs) → corregidos. **D3** aceptado por diseño: si `auth.signOut()` falla no se limpia el caché, igual que el comportamiento previo. **D4** teórico: una redirección same-origin→cross-origin podría colarse; sin vía práctica con Supabase (peticiones directas cross-origin).
- Pendiente asumido: el `install`/`addAll` no tiene test unitario propio (verificado por lectura: URLs relativas y activos existentes).

## Commits

- `d87dc70` — fix(pwa): keep private data out of the service worker cache (unidad completa: SW v4, helper, tests, docs y este documento).
- `09c2a1a` — docs(odd): record the sw-cache-privado work-unit commit.

## Revisión nativa (RDD)

- Lineaje `review-ba12c43611e5418f`, tier medio, lente fiabilidad, candidato
  `sha256:be177b9a…a426` (10 rutas, 305 líneas). **Aprobada** sin corrección;
  autoridad quemada (`gentle-ai.review-acknowledged/v1`).
- Hallazgos informativos no bloqueantes (trabajo futuro, no reabren la revisión):
  **R3-1** (`lib/sign-out.ts:18`, sugerencia) y **R3-2** (`lib/sign-out.ts:3`,
  sugerencia).
- El candidato resultante de registrar esa revisión (`c706f55`, solo este documento,
  `sha256:bfaea4b8…5d`) también se revisó y aprobó (lineaje
  `review-654a2107c27eb80d`, tier medio, lente fiabilidad, 315 líneas). Un
  hallazgo informativo: **R3-cache-offline** (`lib/sign-out.ts:18`, aviso) — el
  borrado de caches al cerrar sesión deja la PWA sin respaldo offline hasta la
  próxima visita; aceptado como consecuencia natural del objetivo de privacidad.
- El registro de esa segunda revisión (`dea7fdf`, solo este documento,
  `sha256:a235bb45…cc`) se revisó y aprobó igualmente (lineaje
  `review-9b9ea34f57d7ab09`, tier medio, lente fiabilidad, 321 líneas; dos
  sugerencias informativas en `lib/sign-out.ts:13/18`, mismas áreas ya anotadas).
- **Disposición explícita del usuario (2026-09-29):** a partir de aquí, los
  commits puramente documentales que registren revisiones en este documento se
  dejan **sin revisar** (edición pasiva trivial). El bucle
  revisión→registro→revisión se cierra aquí; el código de la unidad está revisado
  y aprobado.
