# Alturas iguales en todas las tarjetas de la lista

**Abierta:** 2026-10-13 · **Rama:** `fix/ui-altura-tarjetas` (desde `main`, `41563fe`) · **Estado:** decisión tomada (rejilla con filas iguales), código sin escribir

## Specs

- **S1** — Todas las tarjetas de la lista miden **lo mismo de alto**, incluidas las que **no** tienen descripción.

> En las tarjetas al ver los deseos que todas tengan la misma longitud y todo quede a la misma altura, las que tienen descripción son más largas que las otras y queda todo como desordenado, aunque no tegan descripción que ocupen lo mismo

- **S2** — **Decisión del propietario (2026-10-13)**, entre los tres caminos que se le presentaron: **rejilla con filas iguales** (`grid` + `auto-rows-fr`). Se descarta **reservar huecos por dentro** (deja aire muerto en las tarjetas cortas, y en escritorio el título ocupa menos líneas, así que el aire sería mayor).

## Diagnóstico (leído en el código, no supuesto)

- El contenedor es **`flex-row flex-wrap`**, con guías por márgenes negativos (`-m-2` en el contenedor y `p-2` en cada envoltorio) y cada tarjeta a `w-1/2` en móvil o `w-1/3` en escritorio. Está en **dos sitios**: `components/WishListTab.tsx:424` (lista propia) y `app/wishlist/[id]/index.tsx:228` (lista de otro).
- En flexbox, las tarjetas de **una misma línea** se igualan solas (`items-stretch` + `h-full`), pero **cada línea** mide lo que su tarjeta más alta. De ahí el desorden que se ve: una línea con descripción mide más que la siguiente sin ella.
- Hay una **segunda fuente de variación** que el propietario no mencionó y que también descuadra: el **título** admite hasta 3 líneas, medido en el propio código (`scrollHeight 60 vs clientHeight 40` a 360px con «Auriculares Sony WH-1000XM5»). Dos tarjetas **sin** descripción con títulos de 1 y 3 líneas tampoco coinciden hoy.

## Tasks

| # | Tarea | Specs | Commit |
| --- | --- | --- | --- |
| T1 | El contenedor pasa a **rejilla con filas iguales** en los **dos** sitios donde se pintan tarjetas | S1, S2 | 1 |
| T2 | La tarjeta **reparte el espacio** que sobre: el precio abajo y sin huecos en medio | S1 | 1 |
| T3 | E2E que **mide**: todas las tarjetas iguales, con y sin descripción y con título corto y largo, a **360px** y a **1280px** | S1 | 1 |
| T4 | Verificación completa (typecheck, lint, unitarios, suite E2E) y PR | S1 | — |
| T5 | Revisión nativa del corte (decisión del propietario) | — | — |

## Log

- **L1 (2026-10-13) — petición del propietario, literal:**

> En las tarjetas al ver los deseos que todas tengan la misma longitud y todo quede a la misma altura, las que tienen descripción son más largas que las otras y queda todo como desordenado, aunque no tegan descripción que ocupen lo mismo

- **L2 (2026-10-13) — decisión del propietario:** **rejilla con filas iguales**. Se le presentaron tres caminos (reservar solo la descripción; reservar descripción y título; rejilla) y eligió el tercero.

- **L3 (2026-10-13) — riesgo declarado antes de escribirlo:** el proyecto **no usa `grid` en ningún sitio** (ni `grid-cols` ni `auto-rows` en `components/` ni en `app/`), y estas vistas son componentes de React Native con nativewind. Así que **hay que verificar midiendo** que en web se emite `display: grid` de verdad y que las filas quedan iguales; si no funcionara, se cae al plan de reservar huecos, que es el que se descartó por aire muerto. No se da por hecho.

- **L4 (2026-10-13) — alcance ampliado a los dos sitios a propósito:** el propietario habla de «ver los deseos», y eso incluye la lista de otro miembro (`app/wishlist/[id]/index.tsx`), que usa el mismo patrón. Arreglar solo uno dejaría la mitad del problema, así que entran los dos.

- **L5 (2026-10-13) — el typecheck cazó un error de sintaxis MÍO antes de medir nada:** puse los comentarios `{/* … */}` **dentro de las ramas de un ternario** (`? ( … ) : ( … )`), donde solo cabe **un elemento**; un comentario JSX solo es válido como **hijo** de un elemento. El `tsc` lo dijo en la primera pasada (`')' expected` en los dos ficheros) y el E2E **ni llegó a arrancar**: su «timeout esperando el webServer» era el **síntoma**, no un fallo de la rejilla. Los dos comentarios se movieron dentro del `<View>` de la rejilla. Lección corta y general: **un comentario no es un nodo**, y en posición de expresión no vale.
