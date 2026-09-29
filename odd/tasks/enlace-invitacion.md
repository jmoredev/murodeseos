# Enlace de invitación a grupo sin base path (fix/enlace-invitacion)

**Abierta:** 2026-09-29 · **Rama:** `fix/enlace-invitacion` (desde `main`) · **Estado:** en curso

## Objetivo

Que los enlaces de invitación a grupo incluyan la ruta base de GitHub Pages
(`/murodeseos`) y apunten a la URL canónica del sitio. Segunda de las tres
unidades de la auditoría PWA/móvil (memoria: «Auditoría PWA/móvil», 2026-09-29).

## Hallazgos que la motivan

- `lib/group-utils.ts:168-169` — `generateShareMessage` construye el enlace como
  `window.location.origin + '/groups/join?code=' + groupCode`. En producción
  (`https://jmoredev.github.io/murodeseos`) el enlace queda
  `https://jmoredev.github.io/groups/join?code=…`, **sin** `/murodeseos`. Lo usa
  el botón de compartir del detalle de grupo (`app/groups/[id]/index.tsx:106`
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
