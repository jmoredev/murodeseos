# Nombre del grupo visible en escritorio (`fix/group-name-visible`)

**Abierta:** 2026-10-07 · **Estado:** implementación completa — guardian visto fallando antes del arreglo y pasando después; pendiente revisión y commit (orquestador)

## Objetivo

Devolver al nombre del grupo su espacio en la tarjeta de la pestaña de grupos para anchos ≥768px, donde hoy mide **0px** (invisible), y cerrar el hueco del harness que lo permitió.

## Restricción de producto

No cambiar la identidad visual ni el comportamiento ya decidido por el propietario en `mobile-first` (12px de suelo tipográfico, objetivos táctiles de 44px en móvil, patrón `vd`/`dvh`, un único umbral `>768`). El arreglo **no** puede degradar la versión móvil, que hoy funciona.

## Diagnóstico (medido, no inferido)

Herramienta: Edge headless vía `playwright-core` contra la app local (`expo start --web`, 8081) con Supabase local sembrado. Capturas y JSON en `E:/tmp/ui-audit/`.

### El defecto

| Viewport | Ancho de la caja del nombre | `scrollWidth` del texto |
| --- | --- | --- |
| 1280px | **0px** | 135 (Familia García) / 184 (Amigos del Trabajo) / 153 (Club de Lectura) |
| 900px | **0px** | ídem |
| 360px | 87–105px | visible |

Los tres grupos. El texto existe, mide, y su caja es cero.

### Presupuesto de anchura (escritorio, 1280px)

```
240px  contenido de la tarjeta (medido)
 − 8px  `pr-2` de la fila de título
− 116px columna fija de acciones `md:w-[7.25rem]`, shrink-0   (GroupCard.tsx:254)
= 124px fila de título (medido)
 − 56px emoji `md:w-14 md:h-14` (GroupCard.tsx:191)
 − 16px `md:ml-4`
= 44px  caja de flex-1 (medido: 43.98px)
 − 44px lápiz de alias `w-11 h-11`, shrink-0 (GroupCard.tsx:238)  ← su glifo mide 12px
= 0px   para el nombre
```

La columna de acciones necesita de verdad 96px (compartir 44 + `mr-2` 8 + menú 44); declara 116. El lápiz ocupa 44px para un glifo de 12px.

### Prueba de causa (inyección en vivo sobre la app corriendo)

| Modificación | Ancho del nombre resultante |
| --- | --- |
| ninguna | **0px** |
| lápiz de 44px → 18px | **22px** |
| lo anterior + columna de acciones 116 → 60px | **78px** |

### Origen (atribuido con `git log -p`)

Commit **`4090a61`** — `fix(mobile): make every action tappable and unhide the hover-only delete`, unidad **D2** de `mobile-first`:

```
-  <Pressable ... className="p-1 ml-1 shrink-0">
+  <Pressable ... className="w-11 h-11 ml-1 shrink-0 items-center justify-center">
```

**Fusionado en `main`** (`87c795a`, PR #36) → el defecto está en producción.

**Error de razonamiento documentado en el propio componente**: el comentario de `GroupCard.tsx:166` afirma «Escritorio (≥768px) … a ≥768px aplica exactamente las mismas reglas de antes». Falso: el lápiz se escribió **sin prefijo `md:`**, así que también cambió escritorio, donde el espacio es más estrecho.

### Causa de fondo

| | Contenido de tarjeta | Espacio para el nombre |
| --- | --- | --- |
| Móvil 360px (1 columna) | ~280px | 87–105px |
| Escritorio 1280px (3 columnas) | **240px** | **0px** |

El grid (`GroupsTab.tsx`, `isDesktop ? 'w-1/3' : 'w-full'`) da 3 columnas desde 769px, así que **la tarjeta de escritorio es más estrecha que la de un teléfono**. Con emoji (72px) y columna de acciones (116px) fijos, para nombre y lápiz solo quedan 44px. Ninguna micro-optimización arregla eso: hay que devolver ancho.

### Síntoma hermano del mismo embotellamiento

`3 participantes` → `scrollWidth 118 / clientWidth 44` en **escritorio y móvil**. El contador se corta. Se arregla con el mismo cambio de anchura.

### Por qué no lo cazó nada

- La aserción que mide esa caja (`groupNameBoxState`) vive en `e2e/mobile-layout.spec.ts:579`, y ese fichero fija `test.use({ viewport: { width: 360, height: 640 } })` en la línea 35. **Solo corre a 360px.**
- El fixture que comprueba es `E2E_CONFIG.group.name` («E2E Test Group»), corto: cabe. Un nombre real como «Amigos del Trabajo» ya se clampa hoy (84 vs 56px) sin que nada lo reporte.
- El proyecto `chromium` (1280×720) **no tiene ninguna comprobación** del nombre del grupo.

## Decisiones

- **Aplicada (propietario): opción A — rejilla a 2 columnas en escritorio** (`components/GroupsTab.tsx:357`, `isDesktop ? 'w-1/2' : 'w-full'`). Sin otros cambios: la columna de acciones, el emoji, el lápiz de alias y `numberOfLines` quedan como estaban.

## Resultado medido tras el arreglo (Chromium vía Playwright, app local, 2026-10-07)

Formato: `caja / texto`, con el texto truncado marcado.

| Viewport | Contenedor | Nombre «E2E Test Group» | Contador «2 participantes» | Nota |
| --- | --- | --- | --- | --- |
| 360px | 352px | 105 / 105 ✅ | 153 / 153 ✅ | Sin regresión: la rama `w-full` del ternario no cambió |
| **769px** | 681px | **25 / 145 ⚠️ TRUNCA** | **73 / 118 ⚠️ TRUNCA** | Antes 0px. **Sigue roto**: con 25px el nombre es ilegible |
| 900px | 812px | **90 / 145 ⚠️ TRUNCA** | 138 / 138 ✅ | Antes 0px. La estimación previa (~130px) era optimista; el real es 90px |
| 1024px | 936px | 152 / 152 ✅ | 200 / 200 ✅ | Correcto |
| 1280px | 936px | **152 / 152 ✅** (antes 0) | 200 / 200 ✅ (antes 118/44) | Correcto; coincide con la estimación de aceptación |
| 1600px | 936px | 152 / 152 ✅ | 200 / 200 ✅ | Correcto |

**El contenedor tiene un tope de 936px**: de 1024px en adelante la maquetación es idéntica, así que el arreglo es correcto en todo el rango ≥1024px. La medición de 769px la hizo el padre, no el writer.

«Familia García» no existe en la base del usuario E2E (es grupo de `juan@test.com`), así que la comparación se hizo contra «E2E Test Group» (145px de texto).

### Limitación residual: la banda 769–1023px sigue truncando

Con 2 columnas a 769px el contenedor es 681px → columna 340px → tarjeta ~316px → contenido ~268px. El chrome fijo consume 116 (columna de acciones) + 8 (`pr-2`) + 72 (emoji `md:w-14` + `md:ml-4`) + 48 (lápiz 44 + `ml-1`) = **244px**, dejando ~24px para el nombre (medido: 25px).

**Por qué no tiene arreglo con dos columnas**: para que un nombre de 145px quepa harían falta 145 + 244 = 389px de contenido → 437px de tarjeta → 461px de columna → **922px de contenedor**, y ahí solo hay 681px. Es una sobre-suscripción aritmética, no un ajuste fino.

Vías para cerrarla, si el propietario quiere:

| Vía | Efecto en 769px | Coste |
| --- | --- | --- |
| 2 columnas solo desde 1024px (1 columna en 769–1023) | Nombre a ancho completo (681px) | Rompe la convención de **umbral único** decidida en E2: haría falta un segundo hook |
| Recortar el chrome ~80px (columna de acciones a sus 96px reales, emoji a 48/12, lápiz a 24 en `md:`) | ~105px → sigue truncando | Toca targets táctiles y tamaño del icono en escritorio |
| Opción B (nombre en su propia línea) | Nombre a ancho completo en **todos** los anchos | Tarjeta más alta; cambio estructural |
| Aceptar y documentar | 25–90px con elipsis | El nombre es visible pero ilegible en esa banda |


## Unidades de trabajo

| # | Tarea | Estado |
| --- | --- | --- |
| G1 | Devolver ancho: aplicar la opción elegida en `components/GroupCard.tsx` y/o `components/GroupsTab.tsx` | **hecha** — opción A en `GroupsTab.tsx:357` (`w-1/3` → `w-1/2`); nombre pasa de 0px a 152px a 1280 |
| G2 | Recuperar también el contador `3 participantes` con el mismo cambio | **hecha** — contador a 1280px: rect 200px, scrollWidth = clientWidth (sin truncado); antes 118/44 |
| G3 | Guardián en el harness: aserción del nombre del grupo (y del contador) **a 1280px**, con nombre de fixture largo; no vacua (debe fallar contra el árbol actual) | **hecha** — `e2e/desktop-layout.spec.ts` (nuevo, viewport propio 1280×720 vía `test.use`); visto **fallando** contra el árbol sin arreglar («la caja del nombre … mide 0px de ancho») y **pasando** después |
| G4 | Verificar con la misma medida que acreditó el defecto (0px → ancho suficiente, en 1280, 900 y 360) | **hecha para ≥1024px; abierta para 769–1023px** — ver «Limitación residual»: el nombre pasa de 0px a 152px a 1280/1024, pero en la banda 769–1023 sigue truncado (25px a 769, 90px a 900) y eso no se arregla con dos columnas |

## Verificación

- **Prueba del guardián:** ejecutado contra el árbol sin arreglar → **falla** nombrando la caja colapsada (`mide 0px de ancho`); contra el árbol arreglado → **pasa**. Un test que nunca se vio fallar no prueba nada.
- **Suite E2E completa en local (primera vez que es posible, chromium):** **51 passed, 1 skipped** (el skip es el check de opacidad, que solo corre en proyectos táctiles).
- **A/B de los 5 fallos iniciales:** los mismos 5 fallaban **con y sin** el arreglo → no eran del cambio. Causa real: el entorno local estaba a medias (faltaba `scripts/setup-e2e-user.ts`, el tercer paso de `test:e2e:prepare`), que normaliza el nombre de `juan@test.com` a «Juan Perez» como espera `e2e/config.ts`. Tras ejecutarlo, 18 passed / 1 skipped.
- `pnpm run test:unit`: **28 ficheros, 221 passed + 1 todo**. `pnpm run typecheck` y `pnpm run lint` (`--max-warnings 0`) limpios.
- Medida en navegador a 360 / 769 / 900 / 1024 / 1280 / 1600 con los mismos scripts que acreditaron el defecto.

## Opciones de arreglo

| Opción | Qué hace | Nombre resultante (escritorio) | Coste |
| --- | --- | --- | --- |
| **A. Rejilla a 2 columnas en escritorio** | `isDesktop ? 'w-1/2' : 'w-full'` | ~152px → «Familia García» (135) cabe en 1 línea | Menos grupos por fila en escritorio |
| **B. El nombre a su propia línea** | Reestructurar: emoji+acciones arriba, nombre+contador debajo a ancho completo | ~232px → todos caben | Tarjeta más alta |
| **C. Mínimo sin cambio visual** | Columna 116→96 (+20), lápiz 44→24 en `md:` (+20), `numberOfLines` 2 también en escritorio, emoji 56→48 y `ml-4`→`ml-3` (+12) | ~96px en 2 líneas → sigue truncando | No arregla del todo; solo hace visible |
