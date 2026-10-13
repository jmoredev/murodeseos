# Los siete informativos de la revisión del trabajo posterior

**Abierta:** 2026-10-13 · **Rama:** `chore/informativos-trabajo-posterior` (desde `main`, `3f4e40c`) · **Estado:** en curso

**Qué es esto.** Los **siete hallazgos informativos** que dejó la revisión del corte del trabajo posterior (linaje `review-de990285ab7f8605`), que el proveedor declaró «trabajo posterior, nunca motivo para re-revisar ese candidato». **Cinco son correcciones** y dos se resuelven con la misma prueba.

**Mismo aviso que la ficha anterior**: el proveedor da id, lente, severidad y **ubicación**, pero **no el texto del hallazgo**. Las `S#` de abajo son mi **lectura crítica de la ubicación citada**, no una cita suya.

## Specs

- **S1** — `R1-VISIBLE-HOST-TRUNCATION` (WARNING, riesgo) y después **`R3-MULTIPART-TLD` (CRITICAL del refutador)**. El recorte del dominio tiene que conservar **las dos puntas**, porque dicen cosas distintas: el principio, **de quién** es la tienda; el final, **a dónde va** el enlace. Se recorta **por el medio**, y la cola son las etiquetas del **destino**: **dos** (`example.es`) o **tres** cuando el sufijo público tiene varias partes (`example.co.uk`). Asumir siempre dos fue un defecto real —con `.co.uk` se conservaba `co.uk` y el sitio desaparecía— y quedan probados los dos casos.
- **S2** — `R2-accesible-sin-verificar` y `R3-A11Y-TRUNC`. El helper **promete** que el nombre accesible conserva el dominio completo, y eso **no estaba probado**: la prueba solo miraba el texto visible. Se añade una que afirme las dos cosas a la vez (visible recortado, audible entero). *(Dos hallazgos, una prueba.)*
- **S3** — `R2-etiqueta-scan` (WARNING) y `R3-TAG-SCAN`. Mi ayudante de test leía la etiqueta **escaneando texto** con una heurística («el primer `>` que no forme parte de una flecha»), y una heurística así se rompe con un `>=`, con un `>` dentro de una cadena o con un `=>` anidado. En este repositorio **ya se parsea en tests** (`icon-chrome.test.ts`, con el AST de TypeScript): se hace igual, buscando el elemento JSX y leyendo su atributo. *(Dos hallazgos, un cambio.)*
- **S4** — `R2-linaje-artefacto`. En el `L3` de la ficha anterior quedó un artefacto de mi propia edición: `…del linaje review-cf1add91836999c2… no: del precio`. Se limpia.
- **S5** — `R3-E2E-SCOPE`. En el E2E de editar un deseo, la aserción del precio pintado **no estaba acotada a la tarjeta editada**, así que podía pasar porque **otra** tarjeta de la lista tuviera ese precio. Se acota por el `testID` de la tarjeta.

## Tasks

| # | Tarea | Specs | Commit |
| --- | --- | --- | --- |
| T1 | El dominio se recorta **por delante** (sobrevive el destino) y la prueba afirma el sufijo, no una cadena exacta | S1 | 1 |
| T2 | Prueba de que el nombre accesible conserva el dominio entero con el visible recortado | S2 | 1 |
| T3 | El ayudante del test lee la etiqueta con el **AST**, no con un escáner de texto | S3 | 1 |
| T4 | Limpiar el artefacto del `L3` en la ficha anterior | S4 | 1 |
| T5 | Acotar el E2E al `testID` de la tarjeta editada | S5 | 1 |
| T6 | Verificación completa (typecheck, lint, unitarios, suite E2E entera) y PR | S1-S5 | — |
| T7 | Revisión nativa del corte (decisión del propietario) | — | — |

## Log

- **L1 (2026-10-13) — petición del propietario, literal:**

> Vamos con los 7 informativos

- **L2 (2026-10-13) — de dónde salen:** los siete del linaje **`review-de990285ab7f8605`** (la revisión del corte del trabajo posterior): `R1-VISIBLE-HOST-TRUNCATION`, `R2-accesible-sin-verificar`, `R2-etiqueta-scan`, `R2-linaje-artefacto`, `R3-A11Y-TRUNC`, `R3-E2E-SCOPE` y `R3-TAG-SCAN`.

- **L3 (2026-10-13) — lo que la revisión puso en duda, y tiene razón:** `R1` apunta a **mi propia respuesta a un hallazgo anterior** (el recorte del dominio que introduje en el corte del trabajo posterior). Es el caso más interesante de los siete: la revisión no cuestiona código heredado, cuestiona **la decisión con la que resolví otra revisión**, y al leerla con calma la decisión estaba mal orientada (recortar el final es esconder el destino).

- **L4 (2026-10-13) — el artefacto del `L3` (S4) se arregla aquí, y no antes:** se dejó diferido a propósito porque arreglar una errata exigía un commit, un candidato nuevo y otra corrida de CI. Entra con este corte, que ya necesita CI por los otros cuatro.

- **L5 (2026-10-13) — por qué el AST y no una heurística mejor:** se podría afinar el escáner de texto (saltar `=>`, ignorar `>` dentro de cadenas…), pero eso es ir tapando agujeros de un parser a mano. El repositorio ya usa el AST en `icon-chrome.test.ts`, así que la respuesta correcta es **no parsear yo**: buscar el elemento JSX y leer su atributo.

- **L6 (2026-10-13) — el refutador encontró un CRITICAL en mi propia regla, y yo lo había escrito como si fuera un trade-off:** `R3-MULTIPART-TLD`. Mi comentario decía, entre paréntesis, que «con un TLD de varias partes la cola se queda en las dos últimas etiquetas y el principio conserva el nombre reconocible», y lo presenté como limitación asumible. **No era una limitación: era el defecto.** Con `.co.uk` la etiqueta conservaba `co.uk` y perdía `example.co.uk`, es decir el destino que la propia `S1` promete conservar. Corregido con una tabla corta de etiquetas de sufijo público, y probado con `.co.uk` **y** con `.es` para que no cambie lo que ya funcionaba.
  **Lección**: documentar una consecuencia como «trade-off aceptable» no la convierte en aceptable. Si el resultado rompe lo que la spec promete, es un defecto, y el comentario solo lo disfraza — y encima lo vuelve más difícil de ver, porque el siguiente lector lo da por decidido.
