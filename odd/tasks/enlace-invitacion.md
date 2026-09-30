# Enlace de invitación a grupo sin base path (fix/enlace-invitacion)

**Abierta:** 2026-09-29 · **Rama:** `fix/enlace-invitacion` (desde `main`) · **Estado:** implementada, verificada y revisada (aprobada). Pendiente de entrega (push/PR decisión del usuario)

## Objetivo

Que los enlaces de invitación a grupo incluyan la ruta base de GitHub Pages
(`/murodeseos`) y apunten a la URL canónica del sitio. Segunda de las tres
unidades de la auditoría PWA/móvil (memoria: «Auditoría PWA/móvil», 2026-09-29).

## Hallazgos que la motivan

- `lib/group-utils.ts:168-169` — `generateShareMessage` construye el enlace como
  `window.location.origin + '/groups/join?code=' + groupCode`. En producción
  (`https://jmoredev.github.io/murodeseos`) el enlace queda
  `https://jmoredev.github.io/groups/join?code=…`, **sin** `/murodeseos`. Lo usa
  el botón de compartir del detalle de grupo (`app/groups/[id]/index.tsx:105`
  → `shareGroup`).
- `components/GroupsTab.tsx:184` — `shareNative` (Web Share) construye
  `url: window.location.origin + '/groups/join?code=' + selectedGroupId` con el
  mismo defecto, ignorando la utilidad que ya resuelve la ruta base.

## Decisiones

- **Una sola fuente de verdad de URL:** usar `getSiteBaseUrl()` de
  `lib/site-url.ts` en ambos sitios. Esa función ya resuelve en orden
  `EXPO_PUBLIC_SITE_URL` → `window.location.origin + getGithubPagesBasePath()` →
  `http://localhost:8081` (SSR/dev), y es la misma que usan el login y el signup
  para `redirectTo`. No se duplica lógica de base path.
- **`generateShareMessage`** pasa a construir `deepLink` con `getSiteBaseUrl()`;
  en SSR el enlace queda `http://localhost:8081/groups/join?code=…` (antes vacío).
- **`shareNative`** pasa a `url: `${getSiteBaseUrl()}/groups/join?code=${selectedGroupId}``.
- El campo `text` («Usa el código: …») no cambia: el código sigue siendo válido
  por sí solo; solo se corrige la URL del enlace.

## Tareas

| # | Tarea | Estado |
| --- | --- | --- |
| 1 | `lib/group-utils.ts`: `generateShareMessage` usa `getSiteBaseUrl()` para el deep link | **hecho** | `deepLink = `${getSiteBaseUrl()}/groups/join?code=${groupCode}``; eliminado el cálculo `window.location.origin` |
| 2 | `components/GroupsTab.tsx`: `shareNative` usa `getSiteBaseUrl()` para el `url` | **hecho** | `url: `${getSiteBaseUrl()}/groups/join?code=${selectedGroupId}`` |
| 3 | Tests: `__tests__/group-utils.test.ts` y cobertura del modal | **hecho** | casos nuevos: ruta base en `github.io`, host no-GitHub sin ruta base, SSR; `GroupsTab.test.tsx` con mock de `getSiteBaseUrl` verificando el `url` del share |
| 4 | Documentar en `docs/DEVELOPMENT.md` | **hecho** | bullet en «Detalle de grupo»: los enlaces usan `getSiteBaseUrl()` para conservar `/murodeseos` |

## Verificación

- Writer (autoverificación): `pnpm run test:unit` 17 archivos / 161 tests + 1 todo en verde; `pnpm run typecheck` y `pnpm run lint` limpios.
- Verificador independiente (solo lectura): PASS en los 5 puntos; confirma los 4 entornos (GitHub Pages con base path, host no-GitHub sin base path, `EXPO_PUBLIC_SITE_URL`, SSR), sin doble barra, ningún constructor de enlace restante con `location.origin` crudo. Notas no bloqueantes: discriminación débil entre la rama `served-repo` y el fallback de `app.json` (ambos dan `/murodeseos`); test de `GroupsTab` atado al mock (cubierto por `site-url.test.ts`); límite pre-existente: dominio personalizado + subpath no detectaría la ruta base (`getGithubPagesBasePath` solo opera en `*.github.io`).

## Revisión nativa (RDD)

- Lineaje `review-ea7b292a1e21e649`, tier medio, lente fiabilidad, candidato
  `sha256:f04cc4d3…2dc` (6 rutas, 114 líneas). **Aprobada** sin corrección;
  autoridad quemada (`gentle-ai.review-acknowledged/v1`).
- Hallazgo informativo no bloqueante: **R3-001** (`lib/group-utils.ts:169`,
  sugerencia).
- Nota operativa: el primer START caducó su sobre de consentimiento a los 10
  minutos sin respuesta (`consent-binding-stale`, sin linaje); un segundo START
  con idempotency key fresca lo resolvió.

## Commits

- `453fefd` — fix(share): keep the group invite link base path on GitHub Pages (unidad completa).
- (commit documental de este registro, sin revisar por disposición explícita del usuario).
