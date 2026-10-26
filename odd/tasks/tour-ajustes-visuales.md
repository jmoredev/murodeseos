# Tour: velo, tarjeta legible y textos sin scroll

Arreglos sobre el tour de primer inicio ya publicado (`odd/tasks/tour-tutorial.md`): el velo no
oscurece, la tarjeta no tiene fondo y las páginas largas obligan a desplazar. Tres defectos de
presentación; ni el motor ni la política de arranque cambian.

**Cerrada:** 2026-10-26 · **Rama:** `fix/tour-legibilidad` · **Estado:** cerrada la implementación,
medida en Chromium: el velo calcula `rgba(76, 33, 43, 0.75)`, la tarjeta es opaca con relleno y
esquinas, y las doce páginas dan `sobra = 0`. Los commits de la rama, **903 pruebas + 1 todo**, `tsc` y
`eslint` limpios y las **5 pruebas de navegador** del tour en verde. La **entrega** —PR y merge— es
decisión del propietario. La revisión nativa del primer candidato la declinó el proveedor
(`declined_this_candidate`, sin linaje creado); la del candidato final, `review-1a61ee82a87476df`,
quedó **aprobada** el 2026-10-26 (lentes legibilidad y confiabilidad, 27 archivos) y su autoridad está
quemada.

**Reabierta el 2026-10-26** por el tramo 6 (S10, D5), en la rama `feat/tour-grupo-simulado`: el
recorrido entra de verdad en el grupo de ejemplo y en la lista de una de sus personas para enseñar
un deseo ya reservado. El tramo está implementado y medido —913 pruebas + 1 todo, `tsc` y `eslint`
limpios y las **5 pruebas de navegador** del tour en verde—; el detalle de los tres defectos que
aparecieron al retomarlo está en L7. La **entrega** (PR y merge) sigue siendo decisión del
propietario.

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

S5 — Que se explique cómo se ven los deseos de otra persona, ya que el tour no entra en un grupo:

> «En el tour no se entra a un grupo por lo que no se puede ver como acceder a los deseos de otra
> persona, eso debe de explicarse.»

S6 — Que se note que se ha pulsado el botón de añadir, para que el salto a la pantalla siguiente no
sea un cambio inexplicado:

> «Por otro lado, del paso 3 al 4 queda extraño porque no se sabe que se ha hecho clic en el botón de
> nuevo, podría especificarse.»

S7 — Que se explique cómo se llega a unirse a un grupo, con su botón, y cómo se crea uno:

> «No se sabe como se ha llegado al paso 7. Habría que describir como se puede crear un grupo o unise
> a un grupo haciando uso del botón correspondiente.»

S8 — La página del grupo no puede prometer lo que no se ve: dentro de un grupo se ven sus miembros,
y los deseos se consultan pulsando en uno de ellos:

> «En el paso 6 indicas: "Al abrir un grupo ves los deseos de todos sus miembros: así sabes qué
> quiere otra persona sin preguntárselo." Eso no es cierto, dentro de un grupo ves a sus miembros y
> al hacer clic sobre ellos puedes consultar sus deseos.»

S9 — Cada botón se describe donde está marcado, y el de crear grupo tiene su propia parada después
de la del formulario de unirse:

> «El paso 7 no puede ser: "Y con el de al lado, «Crear grupo», abres uno nuevo y compartes su código
> para que entren los demás". Marca el botón de añadir y describelo, no tiene sentido tener marcado
> un botón y estar refiriéndonos al de al lado (e iría después del paso 8)»

S10 — Que el tour enseñe también el interior de un grupo y la lista de una de sus personas, con un
deseo ya reservado, en vez de contarlo con palabras:

> «¿No puede hacerse una simulación también dentro de un grupo y dentro de un miembro para ver como
> sale un deseo reservado?»

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

D5 — **El grupo de ejemplo y la lista de una de sus personas se abren de verdad, con datos de
demostración en el cliente y sin escribir una sola fila** (S10). D1 lo impedía por una razón
concreta: `/groups/[id]` y `/wishlist/[id]` piden el grupo, sus miembros, el perfil y los deseos
**por id** a la base de datos, y un id del tour no existe allí —la pantalla contestaría «no se
encontró» y, en el peor caso, el tour enseñaría una pantalla de error—. D5 no cambia D1 (no se
escribe nada), cambia quién responde: mientras el tour está en marcha, las dos pantallas reconocen
los identificadores de `lib/tour/demo-data.ts` (`DEMO_GROUP.id`, `DEMO_GROUP_MEMBERS[].user_id`) y
pintan lo de ese fichero **sin preguntar a Supabase** —ni el grupo, ni los miembros, ni la sesión, ni
los deseos—. Sin tour montado no hay demostración: esas rutas se comportan como siempre y con un id
inventado dan la pantalla que ya daban. Y lo que se pinta es lo que hay de verdad dentro de un
grupo: los miembros en rejilla, la lista de una persona, y **un deseo ya reservado** con el estado
de reserva que `WishlistCard` ya sabía pintar. En la lista del tour no hay «Reservar» ni «Cancelar»:
esas acciones escriben en la base de datos y esos deseos no existen allí.

## Tasks

| ID | Specs | Qué | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | S4, D1 | Comprobar en un navegador de verdad de dónde viene cada defecto y decidir librería | — | sí |
| T2 | S1, S2, D2 | Velo, anillo y tarjeta con colores en `style`: velo oscuro, tarjeta opaca con relleno y esquinas | `components/tour/TourOverlay.tsx` | sí |
| T3 | S3, D3 | La medida de la tarjeta se reinicia con cada página del guion | `lib/tour/use-card-size.ts` | sí |
| T4 | S3 | Páginas partidas y acortadas, con presupuesto de longitud vigilado por prueba | `lib/tour/steps.ts` | sí |
| T5 | S1, S2, S3 | Guardia de extremo a extremo: velo oscuro, tarjeta opaca y ninguna página desplazable | `e2e/tour.spec.ts` | sí |
| T7 | S5, S6, S7 | Más páginas en el guion: ver los deseos de los demás, nombrar el clic del botón de añadir y una parada nueva en el botón de unirse | `lib/tour/steps.ts` | `74443d9` |
| T6 | S3, D4 | La tarjeta mide su alto por el contenido y, si el hueco no deja banda, la hoja se apoya abajo | `lib/tour/geometry.ts`, `lib/tour/use-card-size.ts`, `components/tour/TourOverlay.tsx` | sí |
| T8 | S10, D5 | El grupo de ejemplo y la lista de una de sus personas se abren en el tour, con un deseo ya reservado | `lib/tour/{demo-data,steps}.ts`, `app/groups/[id]/index.tsx`, `app/wishlist/[id]/index.tsx` | `c486bd2` |
| T9 | D5 | Los objetivos `tab-*` son de la portada y el registro no borra el alta de otra pantalla | `components/ResponsiveLayout.tsx`, `app/index.tsx`, `lib/tour/targets.ts` | `e363a56` |

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

L4 — Segunda tanda, pedida por el propietario al usar el tour: el guion no explica lo que no puede
enseñar. Entra la parada `crear-o-unirse` sobre el botón «Unirse a un grupo» (S7), que hasta ahora
estaba registrado como objetivo y sin usar; la parada de la lista de grupos gana la página que cuenta
que abrir un grupo enseña los deseos de todos sus miembros (S5); y el paso del botón de añadir dice
que al pulsarlo se abre la pantalla siguiente, que es lo que faltaba para entender el salto (S6). Son
diez paradas y el tope de páginas por parada sube a cuatro.

L5 — Revisión nativa del candidato final (`a05bc7c..0d510b3`, 27 archivos, 1105 líneas): lentes de
legibilidad y confiabilidad, **aprobada**, autoridad quemada (`gentle-ai.review-acknowledged/v1`). Un
único hallazgo, y de los que no bloquean: `R2-001` (WARNING) sobre `e2e/tour.spec.ts:491-524`, con
disposición informativa — el proveedor dice expresamente que no reabre la revisión y que es trabajo
posterior. Queda anotado aquí para no perderlo. Antes, el primer candidato (`…640982b9`) quedó
**declinado** por el proveedor sin crear linaje.

L6 — Tercera tanda (correcciones al usar el tour). El guion queda en once paradas: la del grupo dice
la verdad sobre miembros y deseos (S8), la parada del botón de unirse describe **solo** ese botón, y
el botón `+` de crear grupo tiene la suya, después del formulario de unirse (S9). `PrimaryButton` no
reenvía propiedades al `Pressable` que pinta, así que el objetivo del tour se registra en un
envoltorio, cuyo rectángulo es el mismo.

L7 — Tramo 6 (S10, D5), pedido del propietario al usar el tour, verbatim:

> «¿No puede hacerse una simulación también dentro de un grupo y dentro de un miembro para ver como
> sale un deseo reservado?»

Lo implementado: `lib/tour/demo-data.ts` gana los miembros del grupo de ejemplo con la forma exacta
que consume el detalle (`user_id`, `role`, `profiles.display_name`, `profiles.avatar_url`) y la lista
de una de ellos con **un deseo ya reservado** (`reservationState: 'reserved_by_other'`, el campo que
`WishlistCard` ya pinta); `lib/tour/steps.ts` gana dos paradas, `detalle-grupo` sobre
`grupo-participantes` y `deseos-miembro` sobre `deseos-miembro`, y la parada de la lista de grupos
deja de decir que el tour no puede abrir el grupo —era cierto con D1 y deja de serlo con D5—; las dos
pantallas reconocen los ids del tour y no preguntan a Supabase.

Al retomarlo aparecieron **dos defectos que el WIP tenía y que no se habían medido**:

1. **El recorrido se quedaba dentro del grupo.** El corredor recordaba **una** ruta empujada, así que
   con dos sub-rutas seguidas (grupo → miembro) la vuelta deshacía sólo la última y, como la parada
   ya estaba marcada como atendida, el efecto no volvía a pedir el destino: la parada del botón de
   unirse se quedaba señalando un objetivo que en el detalle del grupo no existe. Rojo primero en
   `__tests__/tour/tour-runner.test.tsx` (`expected 1 to be 2`, con `/groups/tour-group` y
   `/wishlist/tour-member-1` encadenadas); arreglo: pila de rutas empujadas en `TourRunner` y la
   parada **no** se da por atendida mientras quede un `push` debajo. La prueba vieja («una vuelta por
   cada empujón») sigue pasando.
2. **`__tests__/wish-currency-shared.test.tsx` dejó de cargar** (`Cannot read properties of undefined
   (reading 'get')` en `react-native-reanimated`). Medido: pasa en `main`, falla en la rama, y falla
   **también en aislamiento**, así que no era orden de ficheros. Causa: las dos pantallas importaban
   `useTourActive` de `TourHost`, y `TourHost` monta el corredor y el velo —`reanimated`—; cualquier
   prueba que importe la pantalla arrastraba el tour entero. Arreglo: los enganches de estado del
   tour (`useTourActive`, `useTourRequestedTab`, `useTourTabReporter`) viven en
   `components/tour/TourState.tsx`, un módulo sin el velo, y `TourHost` lo alimenta. Es la misma
   regla que ya seguía el registro de objetivos: sin proveedor los enganches son inertes.

3. **El recorrido se paraba en la parada `perfil`: la tarjeta y el velo desaparecían.** Medido en
   Chromium: `npx playwright test e2e/tour.spec.ts --project=chromium` daba **3 de 5** en la rama y
   **5 de 5** en `main` (`dff8682`, 32 s), y las dos fallas caían en la misma parada —página 20 de
   22—, con la pantalla de perfil perfectamente pintada y sin velo. Causa: el registro de objetivos
   guardaba **una** entrada por id (`register` la reemplazaba, `unregister` la borraba) y **cada**
   pantalla que pinta `ResponsiveLayout` reclamaba los mismos `tab-deseos|tab-grupos|tab-perfil`. Las
   dos paradas nuevas apilan `/groups/tour-group` y `/wishlist/tour-member-1`, que pintan ese mismo
   chrome: la de arriba reemplazaba el alta de la portada y, al volver con un `back`, su desmontaje
   **borraba el id**. La portada no se vuelve a montar (queda oculta, no desmontada), así que no lo
   rehacía: `useTourTargetRect('tab-perfil')` se quedaba en `null` y `TourOverlay` no pinta nada sin
   medida. El mismo defecto se llevaba por delante la campana (`notificaciones`) una página después, y
   era **latente para cualquiera**: abrir un grupo o la lista de otra persona durante el tour dejaba
   esos objetivos muertos para el resto de la sesión. Arreglo en dos partes: los tres `tab-*` son de
   la portada —`ResponsiveLayout` los recibe como prop opcional `objetivosPestanas` y sólo
   `app/index.tsx` la rellena— y el registro pasa a guardar una **pila por id**, de modo que la baja
   de una pantalla retira sólo su alta y, si la que se va era la que mandaba, la de abajo vuelve a
   mandar y **se vuelve a medir** en vez de heredar una caja de cuando estaba tapada. Rojo primero:
   `__tests__/tour/tab-targets-sobreviven-a-otra-pantalla.test.tsx` (2 fallas: «`tab-deseos` quedó sin
   medida después de desmontar la otra pantalla», en las dos formas de pestaña) y dos reglas del
   registro en `__tests__/tour/targets.test.ts` (`expected null to deeply equal {…}`).

Verificación del tramo 6: `npx vitest run` **913 passed | 1 todo**, `npx tsc --noEmit` y
`npx eslint --max-warnings 0 .` limpios, y `npx playwright test e2e/tour.spec.ts --project=chromium`
**5 passed** — las mismas cinco que pasan en `main`.

Entrega: una sola PR sobre `main` (el árbol son ~790 líneas añadidas y ~90 borradas). Si el
presupuesto de las lentes del proveedor la rechaza por tamaño, el corte natural está entre
`c486bd2` (grupo y miembro de ejemplo, pila de empujones y estado del tour) y `e363a56` (los
objetivos de la portada y la pila del registro); el segundo arreglo es independiente del primero y
podría ir antes, porque el defecto de los `tab-*` ya existía en `main`.

L8 — Cuarta tanda, reportada por el propietario **en producción** después de `v2026.10.26`,
verbatim:

> «Ya está mucho mejor el tour aunque todavía hay explicaciones que tienen scroll como el paso 5 y el
> paso 6»

**Medido antes de tocar nada**, con una sonda que recorre las 22 páginas y apunta el sobrante de alto
en cuatro tamaños de pantalla:

| Viewport | Páginas con desborde |
| --- | --- |
| 390×844 | 8 (`grupos`, «Paso 5»), 14 (`detalle-grupo`), 16 (`deseos-miembro`) |
| 375×667 | 8 (`grupos`), 18 (`unirse`) |
| 360×640 | 8 (`grupos`), 18 (`unirse`) |
| 412×732 | 4 (`agregar-deseo`) |

Siempre **24 px**, que es una línea de texto. Y la prueba de CI no lo veía: muestreando cada 50 ms, el
sobrante iba `24 → 21 → 9 → 2 → 0` en unos **200 ms**, y el `expect.poll` del spec miraba el valor
final, que es cero. Dos causas distintas, las dos con evidencia:

1. **La tarjeta animaba su tamaño.** `useRectMotion` animaba el ancho y el alto de la estimación a la
   medida. Como el texto se reparte según el ancho, durante esos ~200 ms hay fotogramas en los que
   necesita más alto del que tiene la caja y el `ScrollView` de dentro se puede desplazar. Arreglo:
   `animarTamano: false` para la tarjeta (el velo y el anillo siguen animando el suyo); la tarjeta
   mide lo que mide su contenido desde el primer fotograma y lo único que se anima es dónde está.
2. **`onContentSizeChange` no avisa si el tamaño no cambia.** Instrumentado el enganche:
   `grupos#0` mide 180 px y `lista-grupos#0` mide también 180, así que la segunda página **no recibía
   ningún aviso**, se quedaba con la estimación (190) y su texto pedía 214: 24 px de scroll
   **permanentes**. Coincide con el «paso 6» del reporte. Arreglo: el `ScrollView` lleva
   `key={claveDePagina}`, una instancia por página, así que el aviso inicial siempre llega. No se
   pierde el foco: en cada página el foco va a la tarjeta, que es el padre de ese nodo.
3. **Un fotograma con la estimación.** Al montar la página nueva, la tarjeta se pintaba un fotograma
   con el alto de la estimación antes de tener la medida. Arreglo: mientras no hay medida, la tarjeta
   está montada pero con `opacity: 0` — se mide, no se pinta.

**Guardia**: el spec pasa de juzgar el valor final a juzgar **el peor valor mientras se asienta**
(`peorSobraDeAlto`: 400 ms muestreados por fotograma, y sólo cuenta mientras la tarjeta se ve), y la
prueba de legibilidad corre en **dos** tamaños (390×844 y 360×640) en vez de uno — el de 360×640 es
el que destapó la causa 2. Se tolera **un** fotograma y no más: `reanimated` aplica su estilo en el
fotograma siguiente al commit, así que al pasar de página hay exactamente uno de 16 ms, invisible y no
interactuable; lo que el guardián caza es lo que se percibe (el estirón de ~200 ms, 12 fotogramas, y
la página corta para siempre, 25 de 25). Rojos observados antes de los arreglos: «la página 8 del tour
obliga a desplazar el texto (24 px)» y, ya con el primer arreglo, «la página 9 … (24 px)».
