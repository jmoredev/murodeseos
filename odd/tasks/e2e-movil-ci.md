# E2E móvil verde: PR #33 (`fix/pwa-instalacion`)

**Abierta:** 2026-09-30 · **Rama:** `fix/pwa-instalacion` · **Estado:** abierta — corregido y revisado (pendiente push y validación en CI)

## Objetivo

Dejar verde el job **«E2E gate / Chromium suite»** de la PR #33: el proyecto `Mobile Chrome` (Pixel 5), añadido por la Unidad C de `pwa-instalacion`, falla **2 de 42** tests de forma consistente (los 2 reintentos también fallan). El proyecto `chromium` pasa 42/42 y «Types and unit tests» está verde.

## Diagnóstico (scout de solo lectura, run CI 36691857143)

**Fallo 1 — `e2e/already-have-it.spec.ts:40`** (`Element is outside of the viewport`):
`page.getByText('Guardar', { exact: true }).last().click({ force: true })` se pulsa **dentro de los 250 ms** de la animación de entrada del modal móvil. React Native Web implementa `animationType="slide"` como keyframes CSS `translateY(100%) → 0%` sobre el contenedor `position: fixed` del modal, así que durante ese lapso el botón está fuera del viewport y **ningún scroll lo arregla** (es una transform). `force: true` elimina la espera de estabilidad que normalmente absorbería la animación. El escritorio usa `fade` (opacidad), por eso Chromium pasa. Evidencia de que **no** es defecto de la app: el mismo botón, con click normal, funciona en el mismo run y viewport (`e2e/wishlist.spec.ts:87`, `:113`, `:196`), y el pie del formulario es un `shrink-0` de un contenedor flex de altura definida (`components/WishListTab.tsx:591`).

**Fallo 2 — `e2e/wishlist.spec.ts:123`, y también `:137` y `:149`** (timeout de 60 s esperando el locator):
las etiquetas `Por Nombre` / `Por Precio` / `Por Prioridad` **solo existen en escritorio**; en pantalla estrecha el copy renderizado es `Nombre` / `Precio` / `Prioridad` (`components/WishListTab.tsx:330-343`, `const isDesktop = width > 768`), comportamiento documentado en `docs/DEVELOPMENT.md:122`. El control **sí** está renderizado y visible en móvil (`components/WishListTab.tsx:303`): el test es el que quedó desactualizado. Hook estable y agnóstico de viewport ya existente: `accessibilityLabel` (`components/WishListTab.tsx:322`) → `getByLabel('Ordenar por nombre' | ...)`.

**Veredicto**: ambos son defectos de **robustez de test**, no defectos de la app. No hay cambio de código de producto prescrito.

## Unidad única

| # | Tarea | Estado |
| --- | --- | --- |
| U1 | `e2e/already-have-it.spec.ts:40`: eliminar `{ force: true }` y apuntar al Pressable etiquetado (`getByLabel('Guardar deseo')`), para que la acción espere la estabilidad fuera de la animación | hecha |
| U2 | `e2e/wishlist.spec.ts:123,137,149`: sustituir `getByText(/Por …/i).first()` por `getByLabel('Ordenar por nombre'/'Ordenar por precio'/'Ordenar por prioridad')`; no tocar las aserciones de orden relativo (usan `[data-testid^="wishlist-card-"]`, agnósticas de viewport) | hecha |
| U3 | Verificación: typecheck/lint/vitest + verificador independiente; los E2E móviles solo se pueden validar en CI (sin Supabase CLI ni Docker en local) | hecha (estática; CI pendiente) |
| U4 | Revisión nativa RDD del work-unit y quema de autoridad | hecha |

## Verificación

- Writer self-verification: `pnpm run typecheck` (0 errores), `pnpm run lint` (limpio), `pnpm run test:unit` (176 pasan, 1 todo); `grep` sin residuos de `Por Nombre|Por Precio|Por Prioridad`.
- Verificador independiente: **PASS**, 0 bloqueantes. Comprobó el diff mínimo, la validez de los localizadores (`aria-label` en RNW, precedente `getByLabel('Eliminar deseo')`), la unicidad (un solo `WishListTab` montado: `app/index.tsx:77`), la suficiencia de quitar `force`, y que ningún otro `force: true` está dentro de un modal animado.
- Revisión nativa RDD: **aprobada**, linaje `review-89f845e002b7808d`, tier alto, 4 lentes (`risk`, `resilience`, `readability`, `reliability`), candidato `sha256:851c6e69…` (577 líneas, 16 rutas), sin corrección; autoridad quemada (`gentle-ai.review-acknowledged/v1`, `consumed_revision sha256:387b1b1c…`). 8 hallazgos advisory NO bloqueantes (R1-001, R2-001/002, R3-001/002, R4-001/002/003) sobre `scripts/postbuild.cjs`, `.github/workflows/e2e.yml`, `components/NotificationMenu.tsx` y `odd/tasks/pwa-instalacion.md` = trabajo posterior.
- **Limitación de entorno**: `docker` y `supabase` CLI no disponibles → `test:e2e:prepare` (`supabase start`) no puede correr y los specs tampoco se pueden recolectar (`e2e/supabase-admin.ts` exige las claves en `.env.local`, ausente). La validación real del proyecto `Mobile Chrome` es **solo en CI**.
- Operativa RDD: el grupo materialize de 4 lentes admitió 3; la lente `review-reliability` devolvió un payload JSON incompleto y el proveedor rechazó el envío sin consumir el slot (payload en `.git/gentle-ai/rejected-results/review-89f845e002b7808d/`); STATUS reofreció el slot exacto y el reenvío un-slot cerró la revisión.

## Commits

- `3c53c02` `test(e2e): make the Mobile Chrome project pass (mobile-safe locators)` (2 ficheros, +9/−4).
- `docs(odd)` con este registro.
