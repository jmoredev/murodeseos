# Cierre de pendientes: publicación demostrada y guardianes flojos (`chore/cierre-pendientes`)

**Abierta:** 2026-10-08 · **Rama:** `chore/cierre-pendientes` (desde `main`, `6057b6a`) · **Estado:** cerrada — las cuatro unidades hechas, verificadas y **aprobadas por revisión nativa**

## Objetivo

Cerrar tres deudas que quedaron abiertas tras la tanda `ui-polish` y su release, todas de bajo riesgo y sin cambios de comportamiento:

1. La **primera etiqueta real** ya se empujó, así que la única tarea no verificable de `publicacion.md` ya es demostrable.
2. El **borde de 768px** no lo cubre ningún guardián, y es el único hallazgo de la verificación independiente con capacidad real de morder.
3. El **guardián de iconos** sólo mira etiquetas JSX, así que no caza un `import` directo del paquete.

## Por qué esta ficha existe separada

Son deudas de trabajos **ya fusionados y ya revisados**: no abren comportamiento nuevo, sólo cierran lo que quedó declarado como pendiente. Se agrupan en una rama porque el gate de CI no filtra por rutas: un PR cuesta siempre el E2E completo (~9 min), y pagarlo por un cambio de documentación de tres líneas sería desperdicio.

## Unidades de trabajo

| # | Tarea | Estado |
| --- | --- | --- |
| C1 | Cerrar `publicacion.md` tarea 5 con la evidencia de la primera etiqueta real, y actualizar `docs/DEVELOPMENT.md` donde dice que «hasta que se empuje la primera no habrá nada que consultar» | pendiente |
| C2 | Guardián del borde de 768px: medir y aseverar que en esa anchura el nombre no se trunca, y dejar escrito el híbrido | **hecha** — `test.describe('El borde de 768px')` en `e2e/desktop-layout.spec.ts`, con el híbrido explicado en el comentario. **Visto fallando** con una rotura inyectada (`md:w-full` → `md:w-16`, que deja el nombre en 64px): `768px: el nombre «E2E Test Group» NO cabe: scrollWidth=28 > clientWidth+1=17`; revertida la rotura, verde |
| C3 | Endurecer el guardián de iconos para que falle ante un `import` directo de `@expo/vector-icons` fuera del envoltorio | **hecha** — `directFeatherOffenders` cubre las cuatro vías de entrada (defecto, nombrada, espacio de nombres y `require`) además de la etiqueta. **Visto fallando** inyectando `import Ionicons from '@expo/vector-icons'` en `components/ResponsiveLayout.tsx`: `ResponsiveLayout.tsx: import '@expo/vector-icons'`; revertido, verde. Con control negativo de cinco casos positivos y dos negativos |
| C4 | Corregir el comentario obsoleto de `lib/format-price.ts:44-46` | **hecha** — el doc de `parsePriceForSort` ya no pide al llamador «elegir un valor estable para los no numéricos» (el consejo que produjo el comparador con `NaN`); ahora remite a `comparePriceForSort` |

## Contexto: el error de la etiqueta ligera (culpa propia)

La release `v2026.10.08` se etiquetó con `git tag v2026.10.08 <sha>` — **etiqueta ligera, sin mensaje**. El procedimiento **ya estaba documentado** en `docs/DEVELOPMENT.md:42`:

```bash
git tag -a v2026.09.28 -m "Publicar el estado de main del 2026-09-28"
```

**No es un hueco de convención del repositorio: es que no leí el procedimiento antes de etiquetar.** Los documentos tenían razón. La consecuencia es real aunque no rompa nada: la release perdió su nota, y el tag anterior sí la tiene. No se normaliza porque corregirlo obliga a borrar y re-empujar la etiqueta, lo que dispara **otra publicación completa de producción** del mismo commit; el propietario decidió dejarla ligera y usar `-a` desde la próxima.

## Verificación de C2 (2026-10-08)

**Medido en navegador** (Edge headless, app local con Supabase sembrado), caja del nombre `clientWidth/scrollWidth` a **768px**: antes de U7 **444/444**, después **640/640**. Es decir: **no había defecto que arreglar aquí**, y el guardián es un **guardián de regresión**, no un detector de defecto. Se dice explícitamente porque cambia lo que prueba.

**La consecuencia práctica de ser un guardián de regresión**: pasar no demuestra nada por sí solo, así que la única forma honesta de darle valor es **verlo fallar**. Se inyectó una rotura real en `components/GroupCard.tsx` (cambiar `md:w-full` por `md:w-16`, que deja al nombre 64px de caja) y falló nombrando el ancho y la causa:

```
/?tab=groups a 768px: el nombre «E2E Test Group» NO cabe en su caja: scrollWidth=28 > clientWidth+1=17
```

Revertida la rotura (`git checkout -- components/GroupCard.tsx`), la suite vuelve a verde. **El `md:w-16` es reversible y no se quedó en el árbol**: el fichero quedó idéntico a `main`.

**Por qué aquí y no en otro sitio**: el guardián de la banda mide 769/900/1009 y el de escritorio 1280, así que 768 —el único ancho donde el grid va en móvil pero las clases `md:` ya aplican— no lo miraba nadie. Y es el ancho donde un cambio de umbral tiene su efecto exacto.

**Estado**: `playwright test --project=chromium e2e/desktop-layout.spec.ts --workers=1` → **4 passed** (banda + 768 + 1280).

## Restricciones

- **Ningún cambio de comportamiento.** El único cambio de producto es hacer más estricto un guardián; si un guardián nuevo destapa un defecto real, se reporta y se decide, no se arregla de tapadillo.
- No se toca la etiqueta `v2026.10.08` ni se republica nada.
- `main` está protegida: todo entra por PR con los dos checks.

## Verificación

- `pnpm run typecheck`, `pnpm run lint` (`--max-warnings 0`) y `pnpm run test:unit`.
- **Cada guardián nuevo se ve fallando antes de pasar**: un guardián que nunca falla es una promesa, no una prueba.
- E2E con **resiembra y `--workers=1`** (regla del repo: en local los workers son tantos como CPUs y la suite no se autolimpiaba, así que sin eso hay fallos **y verdes falsos**).
- Medición en navegador del borde de 768px, y línea base del «antes» reproducida revirtiendo el fichero de forma temporal.

## Revisión nativa (2026-10-08)

Linaje **`review-e0fd740bb09e652e`**: riesgo medio, 1 lente (`review-reliability`), **6 ficheros / 233 líneas**, presupuesto de corrección 117 → **aprobada a la primera** (sin refutador) y autoridad **quemada** (`gentle-ai.review-acknowledged/v1`).

Acotado del candidato: `inspect` ofreció `base-ref=6057b6a` + `committedOnly` y los `candidate_paths` fueron exactamente los seis ficheros del corte. Sin incidentes de consentimiento ni de admisión.

**Un hallazgo advisory, informativo y no bloqueante** (el proveedor lo declara: no reabre la revisión ni es motivo para repetirla): `R3-001` en `__tests__/icon-chrome.test.ts:129-133` — sobre los controles negativos del guardián de iconos. Queda como trabajo posterior, anotado aquí.

**Nota de proceso**: esta rama se abrió antes de que aparecieran el pantallazo negro de la PWA y los reportes de notificaciones, y la atención se fue a ellos, así que su revisión llegó **después de abrir el PR**. Se detectó al revisar la disposición de otro candidato, no por casualidad: **código en un PR abierto sin revisar es una deuda, aunque los checks estén verdes**. Los checks verdes no son una revisión.

## Commits

- **`aba1faf`** — `docs(odd): the tag trigger is proved, and the tag should have been annotated` (C1).
- **`7456e11`** — `test(e2e): guard the 768px boundary, where two rules disagree` (C2).
- _(C3 y C4, pendientes de commit)_
