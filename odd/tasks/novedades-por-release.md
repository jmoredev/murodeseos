# Novedades en cada release

**Abierta:** 2026-10-21 · **Rama:** `feat/novedades-por-release` (desde `main`) · **Estado:** en curso
**Decisión del propietario (2026-10-21):** D1(a) — cada entrada de novedades lleva su propio id y el modal gatea por ese id, sin tocar el workflow de entrega ni sincronizar `package.json`.

## Specs

- **S1 — petición del propietario, literal:**

> Vale, ahora hay que retomar una funcionalidad que ya existe pero que no se está utilizando y no sé si hay
> que hacerle adaptaciones. Consiste en la funcionalidad de Novedades. Cada vez que hay una release se debe de
> mostrar una ventana flotante con las novedades de cara a los usuarios. Hay que revisar como está implementada
> y empezar a utililzarla en cada release

- **S2 — decisión del propietario, literal:** «Perfecto pues vamos con D1 (a) + arreglar el gate + una entrada
  para lo que hay pendiente».

  Consecuencia fijada: **la identidad de una novedad es su propio `id`**, no la versión de la app. El modal
  muestra la entrada más nueva cuando el `id` guardado en el dispositivo es distinto del suyo, y al cerrarse
  guarda **ese `id`**. Ningún número tiene que sincronizarse entre archivos, y `deploy.yml` no se toca.

- **S3 — alcance: el mínimo de S2.** Nada de abrir «Novedades» a mano desde el perfil, y nada de mover el «ya lo
  vi» de `localStorage` a la base por usuario: el estado sigue siendo **por dispositivo**.

- **S4 — los textos siguen escribiéndose a mano** en `lib/updates.ts` (con emojis, como hasta hoy). No se generan
  desde `CHANGELOG.md`.

- **S5 — la regla tiene que quedar escrita donde vive el proceso de publicación** (`docs/DEVELOPMENT.md`,
  «Cómo se publica»), porque «empezar a utilizarla en cada release» es un paso de operación, no un cambio de
  código: si el cambio se ve para el usuario, lleva entrada; si no, no.

- **S6 — ninguna entrada se puede inventar.** Cada viñeta de la entrada nueva se apoya en un commit publicado
  posterior al `1.4.0` (`b0d9d45`, 2026-05-12), citado en el Log.

## Tasks

| # | Tarea | Specs | Commit |
| --- | --- | --- | --- |
| T1 | Inventario de lo publicado desde `1.4.0` y redacción de la entrada pendiente | S4, S6 | `d0fedff` |
| T2 | `lib/updates.ts`: `id` por entrada, `release` como etiqueta visible, predicado puro `shouldAnnounceUpdate` y `getLatestUpdate` que no mienta con el array vacío | S2 | `d0fedff` |
| T3 | `components/WhatsNewModal.tsx`: gatear por `id`, guardar `id`, chip con la `release` de la entrada | S2 | `d0fedff` |
| T4 | Tests: unitarios del predicado y del cableado, y actualización de los tres e2e que hoy dependen de `lastSeenVersion` | S2, S3 | `d0fedff` |
| T5 | Regla de publicación en `docs/DEVELOPMENT.md` | S5 | `d0fedff` |
| T6 | Verificación: suite, `tsc`, `eslint`; e2e actualizado pero **no ejecutado** acá (el stack local está apagado) | S1 | `d0fedff` |

## Log

- **L1 (2026-10-21) — petición del propietario:** la de S1, textual.

- **L2 (2026-10-21) — decisión del propietario:** la de S2, textual. Se le presentaron tres mecanismos
  (entrada con id propio · semver manual en `package.json`+`app.json` · tag inyectado en el build) y eligió el
  primero. D2 y D3 quedaron en su mínimum: sin reapertura manual, sin estado por usuario, textos a mano.

- **L3 (2026-10-21) — diagnóstico medido antes de tocar código.** La funcionalidad **existe y funciona**, pero
  está congelada en mayo, y el motivo es estructural:

  | Evidencia | Valor |
  | --- | --- |
  | Gate del modal (`WhatsNewModal.tsx:21`) | `latestUpdate.version === currentVersion && lastSeenVersion !== currentVersion` |
  | `package.json` / `app.json` | **`1.4.0`**, sin tocar desde **2026-05-12** (`b0d9d45`) |
  | Unidad real de release | **tag de fecha** (`v2026.09.29` … `v2026.10.20-3`), dispara `deploy.yml` |
  | Qué inyecta el build | **nada**: ni versión ni tag |
  | Tests | 4 casos e2e (`e2e/whats-new.spec.ts`), **cero unitarios** |
  | Otros consumidores de `lastSeenVersion` | `e2e/auth.setup.ts:28` y `e2e/wishlist-visibility.spec.ts:45` lo pre-siembran para esquivar el modal |

  Con `1.4.0 === 1.4.0` la condición es verdadera para siempre: un dispositivo nuevo ve **una vez** las
  novedades de mayo, y quien las cerró en mayo **no ve nunca más nada**. Desde el 1.4.0 se publicaron catorce
  etiquetas —incluida toda la extracción de producto— sin que el modal lo contara. De paso: `date` de cada
  entrada nunca se muestra, y `getLatestUpdate()` devuelve `AppUpdate` pero sería `undefined` con el array vacío.

- **L4 (2026-10-21) — inventario de T1, con la fecha de cada commit.** Posterior a `1.4.0` (`b0d9d45`,
  2026-05-12) y publicado: campo de enlace opcional y enlaces clicables (`252bb58`, 06-04); reservas privadas y
  aviso al reservar (`2e6c11b`, 09-25; `e519e30`); cerrar sesión y recuperar contraseña (`35c1880`, 09-28);
  preferencias de notificaciones por grupo (`7117ed0`, 09-29); metadatos de instalación de la PWA (`bf06024`,
  09-30); cumpleaños y onomástica, con antelación por grupo (`9567f2b`, `b4eeae9`, `b82ad1f`, 10-01);
  precio numérico con validación (`1f0b74c`, `05fa730`, 10-07/13); compartir un producto desde el móvil con
  extracción (`560a216`, `4fd6be4`, `c6ede3b`, 10-18/20) y precio con su moneda (`62a24c4`, `405ab2d`, 10-20).
  **No** se anuncian: correcciones internas, `a11y`/diseño que ya cubría el 1.4.0, ni el trabajo de e2e/CI.

- **L5 (2026-10-21) — implementado y verificado.** `d0fedff` en `feat/novedades-por-release` (desde
  `origin/main` = `09bf839`), nueve archivos, 349 líneas de las cuales ~150 son tests y ficha. **RED
  observado antes de implementar**: 6 fallos en `__tests__/updates.test.ts` (el predicado no existía y
  `getLatestUpdate()` no tenía `id`); después **63 archivos / 651 pasan + 1 todo**, `tsc` y `eslint
  --max-warnings 0` en 0 sobre esta rama.
  El test del **cableado** (`__tests__/whats-new-modal.test.tsx`) no estaba en el plan y se agregó por
  una razón medida: el e2e es la única prueba que tocaba el modal en un navegador y **no se puede
  correr acá** (el stack local de Supabase está apagado), así que sin él la regla quedaba probada pero
  el uso de la regla no. Cuesta 3 casos y 78 líneas.
  **Un detalle del entorno, para el próximo:** en este repo `localStorage` **no existe** en vitest
  (Node define un global deshabilitado sin `--localstorage-file` y `vitest.setup.ts` solo mockea
  `sessionStorage`); el test lo define en su propio ámbito en vez de tocar el setup.
  **Dos subagentes fallaron** (`gentle-ai-explore` y `gentle-ai-worker`, ambos «assistant reported an
  error») y el trabajo se hizo inline: se declara como hueco de proceso, no se reintentó.
  **Lo que sigue sin verificar:** el e2e de Playwright actualizado — lo corre el gate de CI en el PR.
