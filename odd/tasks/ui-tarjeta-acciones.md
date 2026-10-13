# Tarjeta y formulario: las acciones tienen que verse como acciones

**Abierta:** 2026-10-13 · **Rama:** `feat/ui-tarjeta-acciones` (desde `main`, `a864b58`) · **Estado:** decisiones de diseño tomadas con el propietario; código sin escribir

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
