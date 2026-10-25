# Tour: velo, tarjeta legible y textos sin scroll

Arreglos sobre el tour de primer inicio ya publicado (`odd/tasks/tour-tutorial.md`): el velo no
oscurece, la tarjeta no tiene fondo y las páginas largas obligan a desplazar. Tres defectos de
presentación; ni el motor ni la política de arranque cambian.

**Cerrada:** 2026-10-26 · **Rama:** `fix/tour-legibilidad` · **Estado:** cerrada la implementación,
medida en Chromium: el velo calcula `rgba(76, 33, 43, 0.75)`, la tarjeta es opaca con relleno y
esquinas, y las doce páginas dan `sobra = 0`. Cuatro commits, **903 pruebas + 1 todo**, `tsc` y
`eslint` limpios y las **5 pruebas de navegador** del tour en verde. La **entrega** —PR y merge— es
decisión del propietario. La revisión nativa de este candidato la declinó el proveedor
(`declined_this_candidate`, sin linaje creado), así que no hay autoridad abierta.

## Specs

S1 — Oscurecer todo lo que no es el objetivo, para que el foco se lea solo:

> «Aunque el cuadro negro rodea en lo que se debe de enfocar, lo ideal es que se oscurezca todo lo
> demás para facilitar el foco.»

S2 — La tarjeta del diálogo tiene que tener fondo propio y legible:

> «Si el cuadro de texto no tiene fondo el texto puede no poder leerse al solaparse con lo que hay
> abajo.»

S3 — Ninguna página puede obligar a desplazar: el texto largo se reparte en más páginas:

> «En algunas instrucciones hay tanto texto que sale para hacer scroll. Eso hay que evitarlo, en
> todo caso se ponen varias páginas.»

S4 — Evaluar una librería de tours antes de seguir con la implementación propia, e introducirla
sólo si mejora el trabajo:

> «Si crees que puedes hacerlo mejor con ayuda de alguna librería de tutoriales como Reac Joyride,
> driver.js etc evalua lo que aporta y si facilita y mejora el trabajo podemos introducirla»

## Decisiones

D1 — **No se introduce ninguna librería de tours** (S4). Un `driver.js` o un `react-joyride`
resuelven velo y posicionamiento, pero son DOM puro: no existen en React Native, y este proyecto
compila también para Android e iOS (`app.json`, `pnpm run android|ios`, y el tour tiene ramas
nativas: `accessibilityViewIsModal`, ausencia de `inert`, `Platform.OS`). Introducirlos dejaría dos
tours que mantener, uno de ellos sin poder verificar. Las alternativas para RN (`rn-tourguide`,
`react-native-onboarding-swiper`) no cubren lo que este tour ya necesita y la app no puede delegar:
navegación entre sub-rutas (`/wishlist/add`, `/groups/join`) con vuelta a la portada, cambio de
pestaña por estado, datos de demostración inyectados (D1 del tour original), página inerte y foco
atrapado, movimiento reducido y copy en español de España. Y lo que el usuario pide no es una
carencia del motor: es un color que no se aplicaba y una altura que no se recalculaba (L2).

D2 — **Los colores del overlay viven en `style`, no en `className`**. `className` se pierde en el
`Animated.View` de `reanimated`: es la causa de S1 y S2 y no es opinable (L2). Los demás nodos del
overlay (`View`, `Text`, `Pressable`) siguen con clases, que sí funcionan.

D3 — **La tarjeta se mide por página**, no por parada. Congelar el alto en la primera página de una
parada es lo que obligaba a desplazar en la segunda (L2).

D4 — **La tarjeta toma su alto del contenido, y cuando el hueco no deja banda la hoja se apoya
abajo**. Medido en Chromium a 390×844 con `scrollHeight − clientHeight` de `tour-card-content`:
página 2 de `lista-deseos`, tarjeta de 152 px para un contenido de 190 (38 px de más), y página 6,
`grupos`, 190 para 214 (24 px). Son dos causas. (a) El alto se leía del `onLayout` de la tarjeta,
que devuelve el alto que la propia colocación le impuso: la medida era circular y sólo confirmaba la
estimación. Pasa a leerse del `onContentSizeChange` del `ScrollView`, que da el alto natural del
texto independiente del alto de la tarjeta, y la tarjeta mide ese alto más su relleno y su filo
arriba y abajo (`CARD_PADDING` y `CARD_BORDER`, que también come alto porque el `box-sizing` es
`border-box`: contarlos de menos dejaba el mismo defecto en 2 px). (b) `lista-deseos` resalta la
lista entera (184..990 en 844): no queda banda ni encima ni debajo y la
hoja se recortaba a los 152 px libres. Ahora se apoya en el borde inferior con el alto que necesita
—hasta el viewport menos los dos márgenes— aunque pise la parte baja del hueco: un hueco más alto que
la pantalla no puede dejar sitio, una hoja inferior maciza sobre una lista es el patrón normal del
móvil y el anillo sigue viéndose por encima.

## Tasks

| ID | Specs | Qué | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | S4, D1 | Comprobar en un navegador de verdad de dónde viene cada defecto y decidir librería | — | sí |
| T2 | S1, S2, D2 | Velo, anillo y tarjeta con colores en `style`: velo oscuro, tarjeta opaca con relleno y esquinas | `components/tour/TourOverlay.tsx` | sí |
| T3 | S3, D3 | La medida de la tarjeta se reinicia con cada página del guion | `lib/tour/use-card-size.ts` | sí |
| T4 | S3 | Páginas partidas y acortadas, con presupuesto de longitud vigilado por prueba | `lib/tour/steps.ts` | sí |
| T5 | S1, S2, S3 | Guardia de extremo a extremo: velo oscuro, tarjeta opaca y ninguna página desplazable | `e2e/tour.spec.ts` | sí |
| T6 | S3, D4 | La tarjeta mide su alto por el contenido y, si el hueco no deja banda, la hoja se apoya abajo | `lib/tour/geometry.ts`, `lib/tour/use-card-size.ts`, `components/tour/TourOverlay.tsx` | sí |

Commits por tarea (evidencia):

| Tarea | Commit |
| --- | --- |
| T1, T2, T3, T6 | `85cadc8` |
| T4 | `5b40515` |
| T5 | `66e315e` |

## Log

L1 — Pedido del usuario, verbatim:

> «Varias cosas que hay que arreglar que no me gustan del tutorial:
> - Aunque el cuadro negro rodea en lo que se debe de enfocar, lo ideal es que se oscurezca todo lo
>   demás para facilitar el foco.
> - Si el cuadro de texto no tiene fondo el texto puede no poder leerse al solaparse con lo que hay
>   abajo.
> - En algunas instrucciones hay tanto texto que sale para hacer scroll. Eso hay que evitarlo, en
>   todo caso se ponen varias páginas.
> Si crees que puedes hacerlo mejor con ayuda de alguna librería de tutoriales como Reac Joyride,
> driver.js etc evalua lo que aporta y si facilita y mejora el trabajo podemos introducirla»

L2 — Diagnóstico medido en Chromium sobre la app en local (cuenta nueva, viewport 390×844), leyendo
estilos calculados y no el código:

- `tour-scrim-top` → `background-color: rgba(0, 0, 0, 0)`; `tour-card` → `rgba(0, 0, 0, 0)`, con
  `padding: 0px` y `border-radius: 0px`; `tour-ring` → `border-color: rgb(0, 0, 0)`. Es decir: **ni
  velo, ni fondo, ni anillo de marca**. El «cuadro negro» que ve el usuario es el borde por defecto,
  no `primary-container`.
- La causa no es la hoja de estilos: `bg-on-surface/70`, `bg-surface` y `border-primary-container`
  están generadas en el CSS. El nodo del DOM sale con `class="css-view-g5y9jx"` y sin las clases de
  Tailwind: el `className` se pierde en el `Animated.View` de `reanimated`, que no pasa por el
  `cssInterop` de NativeWind. Los `View`, `Text` y `Pressable` de dentro de la tarjeta sí conservan
  sus clases (se comprobó `color`, `font-size` y `background` calculados).
- La tarjeta mide 190 px en casi todas las paradas: `useTamanoTarjeta` acepta **una** medida por
  parada, así que la segunda página de una parada se queda con el alto de la primera. Medido:
  paso 6 página 2 con `scrollHeight` 228 y `clientHeight` 190 → 38 px de desplazamiento. El paso 3
  recorta 4 px por lo mismo.
- El bug del `className` está contenido: es el único `Animated.View` de la app con `className`.

L3 — Cierre. Los tres defectos arreglados y medidos en el navegador, no sólo en jsdom: el velo
calcula `rgba(76, 33, 43, 0.75)`, la tarjeta `rgb(255, 244, 244)` con 16 px de relleno y 16 de radio,
el anillo `rgb(255, 117, 116)`, y las doce páginas del recorrido dan `sobra = 0` con
`scrollHeight − clientHeight` de `tour-card-content` (antes: 2 px en seis de ellas y hasta 38 px en la
segunda página de `lista-deseos`). Verificado: `npx vitest run` **903 passed | 1 todo**,
`npx tsc --noEmit` y `npx eslint --max-warnings 0 .` limpios, y
`npx playwright test e2e/tour.spec.ts --project=chromium` **5 passed**.

Dos avisos honestos. (1) En una de las pasadas de la suite completa falló **una** prueba y no se
identificó: mi propia tubería se comió el detalle (`tail -6`) y la pasada siguiente salió entera en
verde, igual que la del worker. Queda como flake sin nombre hasta que vuelva a aparecer. (2) T1-T3 y
T6 comparten commit: el color del overlay y el tamaño de la tarjeta viven en la misma definición de
estilos, así que separarlos pedía un estado intermedio artificial del fichero.
