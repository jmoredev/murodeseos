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

## Verificación (2026-10-08)

| Comprobación | Resultado |
| --- | --- |
| `node --check public/sw.js` | OK |
| `pnpm run typecheck` | limpio |
| `pnpm run lint` (`--max-warnings 0`) | limpio |
| `pnpm run test:unit` | **246 passed + 1 todo** (antes 242+1: los 4 tests nuevos), con los 4 del SW que fallaban en rojo ahora verdes |
| E2E chromium, **resiembra y `--workers=1`** | **52 passed / 1 skipped**, la misma línea base |

### Demostración en navegador, contra los artefactos reales

Se sirvió el `dist/` bajo `/murodeseos/` con un servidor que imita a Pages (404 con el cuerpo de `404.html`), y se comparó el **SW de producción** (`git show 6057b6a:public/sw.js`) contra el arreglado, con el bundle retirado de la caché para reproducir el estado real del fallo — la cáscara queda cacheada al instalar (`CORE_ASSETS`) pero **el bundle no está en `CORE_ASSETS`** — y un fallo de red de verdad:

| | **VIEJO** (SW en producción) | **NUEVO** (arreglado) |
| --- | --- | --- |
| Respuesta a la petición de navegación | 200 | 200 |
| Tamaño | **17 991 bytes** | **835 bytes** |
| Referencia al bundle | **`entry-0d7e7fbe….js`**, el que ya no existe | **ninguna** |
| ¿Es la página de sin conexión? | no | **sí** |

El viejo entrega la cáscara que apunta a un bundle muerto: el navegador lo pide, falta y **nada se monta**. El nuevo entrega una página autocontenida que no puede fallar.

**Lo que esta demostración NO prueba, dicho sin adornos** (lo señaló la verificación independiente y tiene razón):

- **No es reproducible**: el arnés no está commiteado, así que las cifras no se pueden volver a obtener sin escribirlo.
- **Mezclé unidades**: el «835 bytes» son **835 caracteres / 840 bytes en UTF-8**. El 17 991 sí era bytes.
- **No muestra el negro**: la cáscara «vieja» de la prueba es el `dist/index.html` **posterior al arreglo**, que ya pinta el fondo de marca. Es fiel en el **mecanismo** (bytes que referencian un bundle inexistente), **no en el aspecto**.
- **Aísla el service worker**: usa la misma petición que hace una navegación, así que no observa el efecto posterior en el documento ni en sus subrecursos; ese camino lo cubren los unitarios.

**Limitación del arnés**: en este entorno una **navegación real** de Playwright **no consulta al service worker** (devuelve `ERR_EMPTY_RESPONSE`/`ERR_INTERNET_DISCONNECTED` sin pasar por él), así que se usa **la misma petición que hace una navegación** (`accept: text/html`), que es el discriminante exacto del SW. Dos vías se descartaron antes: `context.setOffline` y la navegación real con el servidor tumbado.

**Un obstáculo que conviene saber**: la app **no registra el SW fuera de `github.io`** (`lib/site-url.ts:29`), a propósito, para que en desarrollo no sirva JS viejo. Por eso la demostración registra el SW a mano; es el mismo fichero que sirve Pages.

**Lo que sigue sin probarse**: cuál de los dos caminos disparó en el móvil del propietario. La clase de fallo y el mecanismo están demostrados; el disparo concreto necesita registros del dispositivo.

## La verificación independiente encontró una regresión MÍA (F1)

**Y era bloqueante.** La primera versión convertía **cualquier** navegación no-ok en la página de sin conexión. **El dato del despliegue que tenía delante y no conecté**: GitHub Pages sirve las **rutas dinámicas** (`/groups/<uuid>`, `/wishlist/<id>`) con su **fallback 404**, y ese cuerpo **es una copia byte a byte del `index.html` actual** (está en `scripts/postbuild.cjs` y en el propio `docs/DEVELOPMENT.md`; la verificación lo comprobó en vivo: `curl` a una ruta dinámica → 404 con la cáscara de 17 906 B). Así que un 404 de navegación **no es un fallo**: es la app, y arranca y enruta bien.

Convertirlo en «Sin conexión» rompía **enlaces profundos y recargas estando en línea**, y el botón de reintentar pide lo mismo, así que volvía a la misma página: **callejón sin salida**.

**El razonamiento que se me pasó**: el negro lo producía servir la cáscara **cacheada** cuando la red **fallaba**. Una respuesta 404 **fresca** trae la cáscara **actual**, con el hash vigente. El arreglo sólo tenía que tocar el `catch`.

**Corrección**: la respuesta fresca se devuelve tal cual — **también si es un 404** — y sólo el `catch` (fallo de red o tiempo agotado) sirve la página de sin conexión. **Con test que lo caza**, escrito primero y fallando en rojo (`expected 200 to be 404`), porque era justo el camino **sin cobertura**: el hueco por el que se coló.

**Límite de los tests, reconocido**: el test de la página de sin conexión se conformaba con la expresión `sin conexi`, que la satisface el propio `<title>`, sin comprobar el texto visible ni la autocontención; y la rama `cached ??` de un recurso tampoco estaba cubierta. Ambas entran ahora.

## Coste asumido (F2) y decisión

Como la cáscara ya no se cachea, **abrir la app sin conexión muestra la página de sin conexión** en vez de la app (verificado: con la red caída, la v4 servía la cáscara de 17 991 B y la v5 sirve la página). Y una navegación de más de 14 s también muestra la página en vez de la app cacheada.

**Decisión del propietario (2026-10-08): se acepta el coste.** Sin red se muestra «Sin conexión», honesto y con botón de reintentar; **no** se añade la maquinaria de cachear cáscara + bundle como unidad. El matiz a favor: una app sin red tampoco puede traer datos (todo vive en Supabase), así que lo que se pierde es una cáscara que arrancaba para quedarse vacía. Está escrito aquí y en `docs/DEVELOPMENT.md` para que el día que alguien pregunte por qué la app instalada no abre sin conexión, la respuesta esté y no haya que deducirla.

## Unidades de trabajo

| # | Tarea | Estado |
| --- | --- | --- |
| P1 | **Reproducir** el negro en local: fijar el comportamiento actual del SW con tests que **fallen en rojo** (cáscara obsoleta servida y respuesta no-ok entregada como recurso) y una demostración en navegador con un despliegue simulado | **hecha (tests)** — cuatro tests en `__tests__/sw.test.ts` que describen el contrato correcto y **fallan los cuatro** contra el SW actual. El primero es la reproducción literal: el SW devuelve `<html><script src="…/entry-VIEJO.js">`, el chunk que el despliegue borró. Ver «Reproducción» |
| P2 | **Arreglo del SW**: no servir una cáscara que pueda sobrevivir a sus chunks, y no entregar respuestas no-ok para recursos | **hecha** — `VERSION` a **`v5`** (cambia la estrategia: es lo que purga la caché vieja), `'./'` **fuera** de `CORE_ASSETS`, la cáscara **no se cachea nunca** en navegación, `offlinePage()` autocontenida como respuesta cuando la navegación no se puede servir, y `Response.error()` en vez de entregar una respuesta no-ok de un recurso |
| P3 | **Recuperación en la app** ante un chunk ausente (recarga en vez de negro) y `_layout` que no pinte `null` | **parcial, y acotado con dato**: **no hay code splitting** (el export produce **un único** `entry-<hash>.js`), así que no existen chunks perezosos que puedan fallar y la recuperación de chunks **no aplica**; `app/_layout.tsx` ya no pinta `null` sino el fondo de marca. Ver «Verificación» |
| P4 | Verificación (estáticos, unitarios, E2E con resiembra y `--workers=1`), verificación independiente y revisión nativa | **verificación hecha**; revisión nativa pendiente |

## Verificación de la corrección de F1

Mismo arnés que la demostración A/B, con el `sw.js` corregido, contra una ruta dinámica cuyo 404 devuelve la cáscara actual:

| Petición de navegación | Resultado |
| --- | --- |
| **En línea** (404 de ruta dinámica) | 404 · **17 991** caracteres · referencia `entry-0d7e7fbe….js` · **no** es «Sin conexión» → **la app arranca** |
| **Fallo de red** | 200 · **835** caracteres · **sin** referencia a bundle · sí es «Sin conexión» → autocontenida |

Es la semántica correcta en las dos direcciones: el 404 se respeta porque ahí está la app, y el fallo de red sigue dando algo legible en vez de una cáscara muerta.

**Estado final de la verificación**: `node --check` OK; `typecheck` y `lint` limpios; `test:unit` **248 passed + 1 todo** (30 ficheros; +2 tests: el del 404 de navegación y el de la caché en un recurso no-ok); E2E chromium con resiembra y `--workers=1` → **52 passed / 1 skipped**.

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
- **`f06745b`** — `fix(pwa): never serve a shell that can outlive its own chunks` (P2).
- **`91c2dae`** — `fix(pwa): paint the brand surface while fonts load, never nothing` (P3).
- **`2a4b1ad`** — `docs(odd): record the black screen verification and what it does not prove`.
- **`30046a4`** — `fix(pwa): a 404 navigation is the app, not an offline page` (corrección de F1, con test que la caza).
