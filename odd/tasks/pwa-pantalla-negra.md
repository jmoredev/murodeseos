# Pantalla negra permanente tras un despliegue (`fix/pwa-pantalla-negra`)

**Abierta:** 2026-10-08 · **Rama:** `fix/pwa-pantalla-negra` (desde `main`, `6057b6a`) · **Estado:** en curso — diagnóstico cerrado, arreglo pendiente

## Objetivo

Que la PWA no pueda quedarse **en negro, sin texto y sin recuperación** después de publicar una versión, que es lo que ha reportado el propietario en Android con la app instalada: «hay momentos en los que se me ha quedado en negro y he tenido que reiniciar completamente la app para que cargue».

## Diagnóstico (evidencia, no suposición)

**Los tres datos del propietario que acotan el problema**, y descartan dos candidatos que también pintan negro:

| Dato | Qué descarta |
| --- | --- |
| **Negro absoluto, sin texto** | Las **dos** pantallas negras de `expo-router` pintan texto blanco: `Unmatched.js:96` («Unmatched Route») y `ErrorBoundary.js:139-143` («Something went wrong» + Retry). Si no había texto, **la app no llegó a montarse** |
| **Esperé y no se arregló** | El gate de fuentes (`app/_layout.tsx:118-119` devuelve `null` hasta que cargan, con tope de 10 s) **se rinde y sigue**: no puede ser un negro permanente |
| **Coincide con publicarse una versión** | Apunta directamente al desajuste entre la cáscara cacheada y los chunks que el despliegue nuevo ya borró |

**Hechos del artefacto, comprobados construyendo en local** (`pnpm run build`):

| Hecho | Valor medido |
| --- | --- |
| Bundle JS | **uno solo**, `entry-<hash>.js`; el nombre **es** el hash, así que publicar **elimina** el anterior del servidor |
| `dist/404.html` | **byte a byte idéntico** a `index.html` |
| Fuentes | también con hash (`Feather.ca4b48e0….ttf`) |
| `CORE_ASSETS` de `public/sw.js` | incluye `'./'` → **la cáscara se cachea en la instalación del SW** |
| `VERSION` del SW | `'v4'`, **no sube por despliegue** |

**El mecanismo**: la cáscara guardada en caché referencia `entry-<hashVIEJO>.js`. Ese fichero ya no existe en el servidor. El SW sirve esa cáscara cuando la navegación falla o supera `NAV_FETCH_MS = 14_000` (`public/sw.js:79-81`), y entonces el `<script>` recibe el HTML del 404 en vez de código → **nada se monta**: negro, sin texto, permanente. **El reinicio en frío lo arregla porque pide el documento actual**, que trae el hash vigente: es exactamente el «tuve que reiniciar» del reporte.

**Segundo hecho de código, misma clase de fallo** (`public/sw.js:99-106`): para un recurso, el SW hace `return fresh` **aunque `fresh.ok` sea falso**, así que entrega un cuerpo HTML a una petición de `.js`. Y la rama de navegación **no tiene ni un test**: el fixture de `__tests__/sw.test.ts` no lleva `accept: text/html`, así que nunca entra en ese camino.

**Honestidad sobre el alcance**: está probado que el código hace esto y que el artefacto lo permite. **No está probado cuál de las dos vías disparó en el móvil del propietario**: eso exige o registros del dispositivo o una reproducción, y por eso la unidad 1 es reproducir antes de arreglar.

## Reproducción (2026-10-08)

**Alcance acotado por un dato del build**: el export produce **un único** `entry-<hash>.js` (`ls dist/_expo/static/js/web/` → 1 fichero) y **sin code splitting**, así que los ~17,6 kB por ruta del export son HTML pre-renderizado, no bundles. Consecuencia: **ninguna navegación dentro de la app puede romper un chunk perezoso**; el negro exige una **carga de documento**, o sea el camino del service worker. Eso es lo que decide dónde arreglar.

**Cuatro tests RED** en `__tests__/sw.test.ts`, escritos para describir el contrato correcto y verdes tras el arreglo:

| Test | Rojo contra el SW actual |
| --- | --- |
| La navegación fallida **no** sirve la cáscara guardada | `expected '<html><script src="/murodeseos/_expo/…' not to contain 'entry-VIEJO.js'` — **es la reproducción del defecto**: el SW entrega el documento que apunta al chunk borrado |
| Una respuesta no-ok **no** se entrega como si fuera el recurso | `expected 'default' to be 'error'` — el HTML del 404 se entregaba a una petición de `.js` |
| La cáscara **no** acaba en la caché | `expected true to be false` |
| La instalación **no** cachea la cáscara | `expected [ './', './manifest.json', …(2) ] to not include './'` |

Los cuatro tests **anteriores siguen verdes** (mismo origen y red-primero para activos): el arreglo no toca lo que ya funcionaba.

**Mejora del arnés que hizo falta**: `caches.match` acepta también una **ruta relativa** (`'./'`), y el SW la usa para su respaldo de navegación. El mock resolvía sólo `request.url`, así que ese camino era **invisible** para los tests — justo el que produce el negro. Ahora se resuelve contra el scope (`resolveCacheKey`).

## Unidades de trabajo

| # | Tarea | Estado |
| --- | --- | --- |
| P1 | **Reproducir** el negro en local: fijar el comportamiento actual del SW con tests que **fallen en rojo** (cáscara obsoleta servida y respuesta no-ok entregada como recurso) y una demostración en navegador con un despliegue simulado | **hecha (tests)** — cuatro tests en `__tests__/sw.test.ts` que describen el contrato correcto y **fallan los cuatro** contra el SW actual. El primero es la reproducción literal: el SW devuelve `<html><script src="…/entry-VIEJO.js">`, el chunk que el despliegue borró. Ver «Reproducción» |
| P2 | **Arreglo del SW**: no servir una cáscara que pueda sobrevivir a sus chunks, y no entregar respuestas no-ok para recursos | **hecha** — `VERSION` a **`v5`** (cambia la estrategia: es lo que purga la caché vieja), `'./'` **fuera** de `CORE_ASSETS`, la cáscara **no se cachea nunca** en navegación, `offlinePage()` autocontenida como respuesta cuando la navegación no se puede servir, y `Response.error()` en vez de entregar una respuesta no-ok de un recurso |
| P3 | **Recuperación en la app** ante un chunk ausente (recarga en vez de negro) y `_layout` que no pinte `null` | pendiente |
| P4 | Verificación (estáticos, unitarios, E2E con resiembra y `--workers=1`), verificación independiente y revisión nativa | pendiente |

## Restricciones

- El service worker es **crítico en producción**: entrega la app a todo el mundo. Un error aquí deja la PWA inservible, así que cada cambio va con su test y su revisión.
- **No se rompe lo que ya funciona**: la regla de mismo origen (los datos privados de Supabase **nunca** se cachean) y la estrategia red-primero para activos.
- Si se sube `VERSION` del SW, hay que decirlo: es lo que purga la caché vieja (documentado en `docs/DEVELOPMENT.md`).
- Ninguna afirmación sobre la causa sin evidencia: lo que sea inferencia se etiqueta como tal.

## Verificación

- `pnpm run typecheck`, `pnpm run lint` (`--max-warnings 0`), `pnpm run test:unit`.
- **Los tests nuevos deben verse fallando antes del arreglo**: es la única prueba de que describen el defecto y no la implementación.
- E2E con **resiembra y `--workers=1`**.
- Reproducción en navegador con un despliegue simulado, con captura del negro.

## Commits

- **`dfa7a89`** — `test(pwa): pin the contract that makes the black screen impossible` (P1).
- _(P2, pendiente de commit)_
