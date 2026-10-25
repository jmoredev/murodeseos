# Tarjeta y formulario: las acciones tienen que verse como acciones

**Abierta:** 2026-10-13 · **Rama:** `feat/ui-tarjeta-acciones` (desde `main`, `a864b58`) · **Estado:** cerrada — T1–T5 implementadas y verificadas (L4/L5): el chip de enlace usa `AppIcon` + dominio, el precio no se recorta y el control de imagen perdió el degradado; la PR #51 (`41563fe`, 2026-10-13) está en `main` con `components/WishLinkChip.tsx`, `lib/wish-link-utils.ts` y el E2E de `e2e/wishlist.spec.ts`

**El diagnóstico que lo une todo**: los cuatro problemas comparten raíz — **cosas que son acciones parecen texto, y cosas secundarias parecen la acción principal**. Dos reglas gobiernan este corte: (1) **una sola forma de botón secundario** (`min-h-[44px] rounded-full bg-surface-container-high` + `ring-1 ring-outline-variant/15`), la que ya usa «Cancelar reserva»; (2) el degradado de `PrimaryButton` se reserva a **la única acción principal** de cada pantalla.

## Specs

Las cuatro peticiones del propietario, **literales** (con sus erratas: son su texto, no se reescriben):

> - A la hora de ver los deseos se ve el precio, el enlace y un botón de "Ya lo tengo". El botón de Ya lo tengo resalta poco y no parece que sea un botón.

- **S1** — El botón «Ya lo tengo» tiene que **verse como un botón**: la forma de botón secundario (superficie tonal, `rounded-full`, `min-h-[44px]`, ancho completo), conservando el check verde porque la acción es positiva. Hoy es un `Pressable` **sin ninguna superficie** (`WishlistCard.tsx:194-225`).

> - El precio a veces sale cortado, hay que evitarlo a toda costa, en el resumen del producto tiene uqe verse el precio.

- **S2** — En la tarjeta, el precio **nunca** se recorta: el chip del precio **no cede** (`shrink-0`), la fila **envuelve** (`flex-wrap`) y el que cede es el enlace. Se verifica **midiendo** a 360px y a 320px que el precio no se elide ni desborda.

> - El enlace simpre sale muy pequeño, no es necesario qeu se vea el enlace reallmente, lo que hace falta es un botón que lleve al sitio que se ha puesto como enlace. Puede ser un botón solo con el icono de enlace por ejemplo. Dime que te parece o alguna otra alternativa.

- **S3** — El enlace deja de pintarse como texto diminuto y pasa a ser **un botón que abre el destino**. Elegido por el propietario entre las alternativas que se le dieron: **icono (Feather, vía `AppIcon`) + el dominio**, con objetivo táctil de 44px, superficie tonal con borde, `accessibilityRole="link"` y etiqueta accesible que **dice el dominio**. La URL completa no se muestra nunca.

> - A la hora de añadir un nuevo deseo, el botón de "Elegir de la galería" se ve cortado y quizás es demasiado grande para lo que se refiere y su funcionalidad

- **S4** — El control de imagen del formulario deja de ser la acción principal: **selector compacto** propio (no `PrimaryButton`), sin recorte, y con la foto ya puesta: **vista previa + dos acciones pequeñas** («Cambiar» y «Quitar»).

**Reglas del repositorio que ninguna unidad puede romper** (las vigilan tests, y romperlas rompe el build): texto **≥ 12px** (`typography-floor`), **`text-on-surface/NN` ≥ /70** (`contrast-floor`, barre todo el código de la app), **iconos solo por `AppIcon`** (familia Feather; nada de emoji, `icon-chrome`), **44px** de objetivo táctil, y **móvil primero**: la verificación de layout se hace a 360px (y 320).

## Tasks

| # | Tarea | Specs | Commit |
| --- | --- | --- | --- |
| T1 | El precio no se recorta: chip `shrink-0`, fila `flex-wrap`, el enlace es quien cede | S2 | 1 |
| T2 | El enlace como botón: `AppIcon` + dominio (helper `wishLinkHost`), 44px, etiqueta accesible con el dominio | S3 | 1 |
| T3 | «Ya lo tengo» con la forma de botón secundario, conservando el check verde | S1 | 1 |
| T4 | Control de imagen: selector compacto, y con foto: vista previa + «Cambiar» / «Quitar» | S4 | 2 |
| T5 | Tests: unitarios de la tarjeta y del helper del dominio, y un E2E que **mide** que el precio no se recorta a 360px y 320px | S1-S4 | 1-2 |
| T6 | Verificación completa (typecheck, lint, unitarios, E2E) y PR | S1-S4 | — |
| T7 | Revisión nativa del corte (decisión del propietario) | — | — |

## Log

- **L1 (2026-10-13) — petición del propietario, literal:**

> Cosas a arreglar y quiero que me indique la mejor forma de hacerlo:
> - A la hora de ver los deseos se ve el precio, el enlace y un botón de "Ya lo tengo". El botón de Ya lo tengo resalta poco y no parece que sea un botón.
> - El precio a veces sale cortado, hay que evitarlo a toda costa, en el resumen del producto tiene uqe verse el precio.
> - El enlace simpre sale muy pequeño, no es necesario qeu se vea el enlace reallmente, lo que hace falta es un botón que lleve al sitio que se ha puesto como enlace. Puede ser un botón solo con el icono de enlace por ejemplo. Dime que te parece o alguna otra alternativa.
> - A la hora de añadir un nuevo deseo, el botón de "Elegir de la galería" se ve cortado y quizás es demasiado grande para lo que se refiere y su funcionalidad

- **L2 (2026-10-13) — decisiones del propietario sobre las alternativas presentadas:** enlace → **icono + dominio** (no solo el icono); «Ya lo tengo» → **tonal neutro con check verde** (ni tonal verde ni relleno); alcance → **una sola PR con las dos unidades** y una corrida de CI.

- **L3 (2026-10-13) — diagnóstico leído en el código, no supuesto:**
    - El precio se recorta por una regla deliberada de `ui-polish` (C4): **los dos chips** llevan `min-w-0 shrink` y el precio `numberOfLines={1}`, así que en una fila apretada elipsa el precio. Esta unidad **invierte** esa regla y mantiene la garantía anti-desborde con `flex-wrap` en vez de encogiendo el precio.
    - `WishLinkChip` (variante chip) pinta **el emoji 🔗 dentro de un `Text`** con `max-w-[55%]` y una línea: diminuto y recortado; además la política del repo es que la familia de iconos entre **solo** por `AppIcon`. La tarjeta pinta **solo `links[0]`** (el modal los lista todos); por defecto se deja así.
    - «Ya lo tengo» no tiene superficie ni borde.
    - El control de imagen usa `PrimaryButton` (el degradado de la acción principal) para una acción secundaria: eso es la causa **segura** de que parezca grande. La causa del recorte **se comprobará midiendo**: `PrimaryButton` fija `paddingVertical: 14` **en línea** dentro de un `Pressable` con `overflow-hidden`, así que el `py-3` del llamador no puede corregirlo.

- **L4 (2026-10-13) — lo que se aprendió al verificar, y lo que NO se pudo afirmar:**
    - **nativewind compila las clases**: en el DOM no queda `shrink-0` ni `bg-surface-container-high`, sino clases atómicas generadas. Mis primeros tests afirmaban las clases en el elemento renderizado y fallaron; la regla vive en el **código**, así que ahí se afirma (igual que hacen `contrast-floor` y `typography-floor`) y su **efecto se mide** en el navegador.
    - **El E2E de la tarjeta es falsable, y se demostró**: con el código anterior en cuarentena falla con `el precio se recorta a lo ancho (96px)` (esperado `<= 1`), y con el arreglo da 0. Además se endureció: un dominio corto no aprieta la fila y la prueba habría pasado sin probar nada, así que usa un dominio largo y mide **los dos ejes** (ancho y alto), porque según la plataforma un texto con `numberOfLines` recorta con elipsis o con line clamp.
    - **Del control de imagen se arregló y verificó la jerarquía** (era la causa cierta): el control ya no lleva el degradado y `Guardar` sí, medido sobre `backgroundImage`.
    - **El recorte del botón antiguo NO se llegó a afirmar**: era una hipótesis, no un hecho leído. Lo que se hizo fue eliminar sus dos mecanismos posibles (el `paddingVertical` fijo que el llamador no podía corregir y una etiqueta larga) y **medir el control nuevo**: no desborda a lo ancho ni a lo alto, y llega a 44px. Enunciarlo como «se arregló el recorte» sin haberlo medido antes habría sido vender una hipótesis como un hecho.
    - **Etiquetas nuevas**: «Añadir foto», «Cambiar» y «Quitar», con el nombre accesible **conteniendo la etiqueta visible** (WCAG 2.5.3) y diciendo sobre qué actúa. La anterior, «Elegir de la galería», era larga y además inexacta en web, donde abre el diálogo de archivos.
    - **Trabajo posterior anotado**: la forma de botón secundario ya está escrita en tres sitios (el botón «Cancelar reserva», el «Ya lo tengo» de la tarjeta y el `ImageAction` del formulario). Extraer un `SecondaryButton` compartido es la siguiente limpieza natural, y se deja fuera de este corte para no ampliar la revisión.

- **L5 (2026-10-13) — el mismo error de método, dos veces, y por eso queda escrito:** los dos fallos de esta tanda fueron **en mis pruebas, no en el código**: (1) afirmar clases que nativewind **compila** y por tanto no deja en el DOM; (2) medir el degradado en el `Pressable` exterior cuando `LinearGradient` lo pinta en un **hijo**, con lo que la prueba decía «sin degradado» de la propia acción principal. Los dos son el mismo error: **mirar donde yo suponía que estaba la evidencia en vez de donde está**. Y la consecuencia importa: una prueba que mide el elemento equivocado es **peor que no tenerla**, porque da por verificado lo que no ha mirado. Por eso las dos correcciones quedaron escritas dentro de los propios tests.

L6 — Cerrada el 2026-10-25: PR #51 (`41563fe`, 2026-10-13); `components/WishLinkChip.tsx`, `lib/wish-link-utils.ts` y el E2E del precio en `e2e/wishlist.spec.ts`, en `main`.
