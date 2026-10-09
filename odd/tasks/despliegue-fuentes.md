# Las fuentes no se sirven en producción (`fix/despliegue-fuentes`)

**Abierta:** 2026-10-09 · **Rama:** `fix/despliegue-fuentes` (desde `main`, `af691c2`) · **Estado:** hecho, verificado y aprobado por revisión nativa; pendiente fusionar y publicar

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

## Revisión nativa (2026-10-09)

Linaje **`review-c93ae323906ac906`**: **riesgo ALTO**, **4 lentes** (`review-risk`, `review-resilience`, `review-readability`, `review-reliability`), 3 ficheros / 211 líneas, presupuesto de corrección 106 → **aprobada a la primera** (sin refutador) y autoridad **quemada**.

**Por qué salió alto**: el disparador fue `shell_source` — el script de shell del paso que comprueba las fuentes en `.github/workflows/deploy.yml`. Es la primera vez en esta sesión que una revisión sube a 4 lentes, y el motivo es que añadí código que se ejecuta en el pipeline.

**Las 4 lentes se prepararon y se enviaron las 4** (24,6 KB de prompt por lente; 2,7–3,8 KB de resultado), sin incidentes de admisión.

**Trece hallazgos advisory, informativos, ninguno bloqueante.** Leídos juntos se agrupan en **tres sitios**, que es lo que pasa cuando cuatro lentes miran el mismo trozo desde ángulos distintos:

| Sitio | Hallazgos |
| --- | --- |
| **El paso de shell que comprueba la fuente** (`deploy.yml:116-124`) | `R2-003`, `R3-001`, `R3-002`, `R4-002` — el script del pipeline es lo que más miradas atrajo |
| **El guardián** (`__tests__/deploy-workflow.test.ts`) | `R2-001`, `R2-002`, `R3-003`, `R4-001`, `R4-003` |
| **Configuración y comentarios del workflow** | `R1-001`, `R1-002`, `R2-004`, `R3-004` |

El cuerpo del sobre da **ubicación y gravedad, no el texto**, así que quedan anotados como trabajo posterior en vez de interpretados de oídas. Se agrupan a propósito: cuatro lentes señalando el mismo rango significa que ese rango merece una lectura propia antes de la próxima vez que se toque el pipeline.

## Segunda vuelta: la comprobación estaba rota (2026-10-09)

**El despliegue salió en rojo con el sitio ya publicado y correcto.** El job `Publish` falló en **mi propio paso de verificación**, no en la publicación: `actions/deploy-pages@v5` dio `success` y las fuentes ya se servían.

### Tres errores míos en el mismo script

Encontré los tres **ejecutándolo en local antes de subirlo**, que es exactamente lo que debería haber hecho la primera vez:

| # | Error | Por qué es peor de lo que parece |
| --- | --- | --- |
| 1 | `grep … \| head -1` con `set -o pipefail` | `head` cierra la tubería, el escritor recibe SIGPIPE y el pipeline devuelve 141. **No determinista**: en local cabe en el búfer de tubería y **pasa**; en CI **falla**. Un paso que a veces pasa es peor que uno que siempre falla |
| 2 | `grep -m1` como «arreglo» | Mismo problema por el otro lado: al salir `grep` antes de tiempo, el que recibe SIGPIPE es `printf` volcando 2,7 MB de bundle. Medido en local: **salida 141** |
| 3 | Buscar la primera `.ttf` a secas | La primera del bundle **no es un activo local**, es una URL de Google Fonts (`//fonts.gstatic.com/…`), así que construía `…/murodeseos//fonts.gstatic.com/…` y daba 404. **Habría fallado siempre**, con un mensaje que culpaba al sitio |

**El arreglo** quita la tubería (coincidencia por regex de bash, `BASH_REMATCH`) y exige la raíz de activos local (`/assets/…ttf`), con lo que la URL de Google Fonts no puede colarse. Verificado **extrayendo el script del propio workflow y ejecutándolo contra producción**: encuentra un activo local y termina con `OK: la fuente se sirve`, salida 0.

### Lección de método: durante un despliegue la CDN sirve una mezcla

Mientras el sitio se propagaba medí, **en el mismo despliegue**, PNG bajo `assets/node_modules/` en **200** y fuentes en **404**. Eso me llevó a dos hipótesis falsas —«Pages bloquea `node_modules`» y «Pages bloquea las rutas con `@`»—, y las dos las **refuté con controles** antes de tocar nada: PNG bajo `node_modules/expo-router` (200) y PNG bajo `node_modules/@react-navigation` (200). Minutos después, las 6 fuentes que probé daban 200.

**Consecuencia práctica**: sondear justo después de publicar no mide el sitio, mide la propagación. Es exactamente el motivo por el que la comprobación reintenta 10 veces, y la razón por la que esa comprobación importa.

### Y el 4-lentes tenía razón

Cuatro de los trece hallazgos (`R2-003`, `R3-001`, `R3-002`, `R4-002`) señalaban **el mismo rango**: `deploy.yml:116-124`, el script de shell. Los anoté como «trabajo posterior» y ese rango es justo lo que falló. **Cuatro lentes apuntando al mismo sitio no es ruido: es la señal.**

### Lo que sí quedó demostrado del arreglo

En producción: `.nojekyll` → **200**, las 6 fuentes muestreadas → **200**, `document.fonts.check('20px Feather')` → **true**, y cargadas **PlusJakartaSans** y **BeVietnamPro** (400/500/600/700). **La tipografía de marca vuelve después de dos semanas y los iconos con ella.**

## Revisión nativa de la corrección (2026-10-09)

Linaje **`review-2d8e82e6c8010057`**: **riesgo ALTO**, **4 lentes** (`review-risk`, `review-resilience`, `review-readability`, `review-reliability`), 2 ficheros / 55 líneas, presupuesto de corrección 28 → **aprobada a la primera** y autoridad **quemada**. Las 4 se prepararon y se enviaron (17,1 KB de prompt y 0,8–3,0 KB de resultado por lente).

**Un solo hallazgo advisory**, informativo y no bloqueante: `R3-001` en `.github/workflows/deploy.yml:141`. **Y el contraste es el dato interesante**: el corte anterior, con el script frágil, produjo **trece** hallazgos y **cuatro de ellos** señalaban justo ese rango; este, con la tubería eliminada, produce **uno**. Menos superficie frágil, menos que decir.

## Commits

- **`8d43518`** — `fix(deploy): keep .nojekyll in the artifact so the fonts are served` (F1+F2+F3).
- **`b27235c`** — `fix(ci): the font check was broken three ways, and it was mine` (el script del paso, reescrito sin tuberías y con el activo local exigido).
