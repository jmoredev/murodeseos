# Las fuentes no se sirven en producción (`fix/despliegue-fuentes`)

**Abierta:** 2026-10-09 · **Rama:** `fix/despliegue-fuentes` (desde `main`, `af691c2`) · **Estado:** en curso

## Objetivo

Que las fuentes vuelvan a cargarse en el sitio publicado. Ahora mismo **no se sirve ninguna**: ni la tipografía de marca ni la de los iconos.

## Cómo se descubrió

El propietario instaló la app desde Chrome y reportó que **los iconos salían como recuadros vacíos, y en algunos sitios nada**. Eso apuntaba a un cambio reciente: en la unidad U6 el cromo pasó de **emoji y glifos de texto** (que siempre existen en el sistema) a **glifos de la fuente Feather**, que hay que descargar. Si esa fuente no llega, salen recuadros.

## La cadena, con evidencia

| Paso | Evidencia |
| --- | --- |
| El action de Page **excluye los ficheros que empiezan por punto** | `actions/upload-pages-artifact` ejecuta `--exclude=.[^/]*` salvo que `include-hidden-files: true` (su `action.yml` lo declara, por defecto `false`) |
| Por eso **`.nojekyll` no llega al sitio** | Descargado el artefacto del run `37897832481`: el tar **no contiene** `nojekyll`, aunque `dist/.nojekyll` existe en local |
| Sin `.nojekyll`, **Pages ejecuta Jekyll** | — |
| **Jekyll descarta `node_modules`** | Es una exclusión por defecto suya |
| Y ahí viven **todas las fuentes** | `assets/node_modules/@expo/vector-icons/…` y `assets/node_modules/@expo-google-fonts/…` |
| Resultado medido en producción | Feather **404** · BeVietnamPro **404** (con el HTML del 404 como cuerpo) · mientras `AppIcons/…` **200** y `manifest.json` **200** |

**Es una regresión de la migración a Actions** (primer despliegue por Actions: 2026-09-24). El flujo anterior publicaba la rama `gh-pages`, que **sí llevaba `.nojekyll`** en su raíz —comprobado con `git ls-tree origin/gh-pages`— y por tanto servía las fuentes.

## Por qué nadie lo vio durante dos semanas

Porque **una fuente que falta degrada en silencio**: el navegador cae a la fuente del sistema y la aplicación sigue funcionando. No hay error, no hay 404 visible en la interfaz. Lo único que cambió es que el cromo dejó de depender de emoji (infalibles) y pasó a depender de una **fuente propia**, y entonces la degradación silenciosa se volvió **tofu visible**.

**Reparto de culpa, dicho con precisión:** el cambio de U6 **no causó** el 404 —llevaba dos semanas ahí— pero **lo hizo visible**. El reporte del propietario destapó un defecto de producción que afectaba a **todo** el sitio.

## Unidades de trabajo

| # | Tarea | Estado |
| --- | --- | --- |
| F1 | **El arreglo**: que `.nojekyll` llegue al artefacto (`include-hidden-files: true` en el paso de subida) | **hecha** — una línea en `.github/workflows/deploy.yml`, con el porqué escrito al lado (el fallo es mudo, quien lo lea tiene que entender por qué no se puede quitar) |
| F2 | **Guardián** que falle si el paso del workflow deja de incluir los ficheros ocultos, con control negativo | **hecha** — `__tests__/deploy-workflow.test.ts`, 5 casos. **Visto fallando** contra el workflow de `main` (`incluyeOcultos = false`) y verde con el arreglo. Tres controles negativos: sin la opción, sin el paso entero, y **con la opción puesta en otro paso** (el bloque se corta por sangría; si se cortara buscando el siguiente `- uses:` leería de más y sería un guardián vano) |
| F3 | **La comprobación que lo habría cazado el primer día**: tras publicar, pedir una fuente del sitio real y exigir un 200, con reintentos por la propagación del CDN | **hecha** — paso `Verify the fonts are actually served` en el job de publicación. Descubre la URL de la fuente **desde el bundle servido** (el hash cambia en cada build) y reintenta hasta 10 veces antes de fallar, nombrando la causa probable |
| F4 | Verificación, revisión nativa, PR y **publicación** (una etiqueta) | en curso |

## Restricciones

- **No se toca el gate**: el E2E sigue corriendo antes de publicar.
- La comprobación de F3 va **después** de publicar: no puede revertir lo publicado. Se acepta y se dice: deja el despliegue **en rojo y con el motivo a la vista**, que es justo lo que faltaba.
- F3 no debe ser frágil: descubre la URL de la fuente **desde el bundle servido**, porque el hash cambia en cada build, y reintenta antes de fallar.
- Nada de efectos silenciosos: si el arreglo cambia lo que se publica (y lo hace: añade `.nojekyll`), se dice en la ficha y en la PR.

## Verificación

- `pnpm run typecheck`, `pnpm run lint` (`--max-warnings 0`), `pnpm run test:unit`.
- El guardián de F2 **visto fallando** contra el workflow sin el arreglo.
- Tras publicar: **las fuentes en 200 en el sitio real**, y los iconos visibles en el navegador (que es lo que reportó el propietario).
- E2E con **resiembra y `--workers=1`**.

## Commits

- **`96c7ffe`** — `fix(deploy): keep .nojekyll in the artifact so the fonts are served` (F1+F2+F3).
