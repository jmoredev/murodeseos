# Pulido de interfaz: contraste, semántica de color, truncamientos y cromo (`fix/ui-polish`)

**Abierta:** 2026-10-07 · **Rama:** `fix/ui-polish` (desde `origin/main`, `c25f542`) · **Estado:** abierta — U1–U4 cerradas; pendientes U5, U6 y U7

## Objetivo

Cerrar la deuda de interfaz que salió de la auditoría visual con la app renderizada. Cuatro unidades decididas por el propietario más el set de iconos del cromo. **Todo lo que se toca aquí es verificable en el navegador** (el entorno E2E local ya funciona), así que ninguna unidad se cierra sin medición.

## Restricción de producto

No cambiar la identidad de marca: la paleta (`primary` `#aa2c32`, `secondary` `#6d5a00`, `tertiary` `#006666`), las fuentes (BeVietnamPro + PlusJakartaSans), los tokens `surface-container-*` ni las sombras `ambient`. Tampoco se revierten las decisiones de `mobile-first` (suelo de 12px, objetivos de 44px en móvil, umbral único `>768`, `dvh`, insets). El arreglo no puede degradar la versión móvil.

## Evidencia medida (2026-10-07)

Herramienta: Edge headless vía `playwright-core` contra la app local (`expo start --web`, 8081) con Supabase local sembrado. 19 capturas y JSON de medidas en `E:/tmp/ui-audit/`.

### Contraste: falla todo el texto secundario

WCAG AA exige **4,5:1** para texto normal (estos rótulos son de 12px). Medido:

| Elemento | Ratio | Cómo se ve |
| --- | --- | --- |
| Etiquetas del dock «Grupos» / «Perfil» (navegación principal en móvil) | **2,92** | `text-on-surface/55` |
| Rótulos de campos del perfil («Camiseta», «Pantalón», «Zapatos») | **2,54–2,62** | `text-on-surface/45` |
| «N participantes» | 2,99 | `text-on-surface/50` |
| Pestañas inactivas «Mis grupos» / «Mi perfil» | 3,27 | `text-on-surface/55` |
| Subtítulos («¿Qué te gustaría recibir?», «Gestiona tus intercambios») | 3,33 | `text-on-surface/45` |
| Ordenaciones inactivas («Por Precio», «Por Prioridad») | 3,27 | `text-on-surface/55` |

**Aritmética del umbral** (on-surface `#4c212b` sobre `surface` `#fff4f4`, luminancia relativa):

| Opacidad | Ratio | ¿AA? |
| --- | --- | --- |
| `/45` | 2,62 | ✗ |
| `/50` | 2,99 | ✗ |
| `/55` | 3,35 | ✗ |
| `/60` | 3,84 | ✗ |
| `/65` | 4,43 | ✗ (por poco) |
| **`/66`** | **4,56** | ✓ **umbral mínimo** |
| `/70` | 5,03 | ✓ |

**Tamaño del problema**: **89 usos** de `text-on-surface/NN` con `NN < 70` en **22 ficheros**. Distribución: `/45` ×36 · `/55` ×23 · `/65` ×12 · `/50` ×10 · `/40` ×2 · `/30` ×2 · `/20` ×2 · `/60` · `/35` ×1. Los `/70` (13) y `/80` (1) ya cumplen.

### Truncamientos y desbordes

- **Títulos de deseos a 360px**: `scrollHeight 60 / clientHeight 40`, clamp a 2 líneas → «Auriculares Sony WH-1000XM5» queda como «Auriculares Sony WH-…» y «Libro: El Archivo de las Tormentas» como «Libro: El Archivo de l…». Es contenido del usuario, cortado.
- **CTA partido**: «✓ Ya lo tengo» mide `116×32` con interlineado de 16px → **2 líneas** a 360px (`WishlistCard.tsx:180`).
- **Banda 769–1009px del nombre de grupo**: pendiente de la feature anterior, documentada aquí por si entra en esta tanda (`odd/tasks/group-name-visible.md`).

### Semántica de color: dos tokens con dos significados

**Corrección a la auditoría inicial**: lo que se describió como «tres acentos compitiendo» es en realidad una **escala semántica de prioridad** deliberada (rojo = alta, oliva = media, teal = baja) que aparece en `WishlistCard.tsx:39-40`, `WishDetailModal.tsx:33-34` y `WishListTab.tsx:508`. Eso **no es un defecto**: la regla «un solo acento» es de páginas de marketing, no de UI de producto.

El hallazgo real es más estrecho: **dos tokens sirven dos significados cada uno**.

| Token | Significado 1 | Significado 2 |
| --- | --- | --- |
| `secondary` (oliva) | prioridad **media** (`WishlistCard.tsx:40`) | **chip de precio** (`WishlistCard.tsx:152,157`, `WishDetailModal.tsx:111-112`) |
| `tertiary` (teal) | prioridad **baja** (`WishlistCard.tsx:39`) | **éxito/información**: `ProfileTab.tsx:138`, `app/(auth)/login/index.tsx:139,143`, «✓ Ya lo tengo» (`WishlistCard.tsx:180`) |

Los tres colores **sí cumplen AA** como texto (oliva 6,3:1 · teal 6,3:1 · rojo 6,3:1), así que esto es higiene de sistema, no accesibilidad.

### Cromo con emoji y glifos de texto

Distinción importante, verificada en el código:

- **El avatar es contenido del usuario**: `app/profile/setup/index.tsx:91-94` es un selector de emoji (`selectedAvatar === emoji`). **No se toca.**
- **El icono del grupo es un campo de base de datos que la UI no permite elegir**: `app/groups/create/index.tsx:12` tiene `const icon = '🎁'` **fijo**. La variedad vista (👨‍👩‍👧‍👦💼📚🧪) viene de los datos sembrados. Es un hueco de producto, no de estilo.
- **El dock sí es cromo**: `ResponsiveLayout.tsx:177,194,211` usa 🎁👥👤 como los tres iconos de la navegación principal en móvil. Junto con los glifos de texto `✓ ✕ ⋮ ✎ ↗ ←` es el objetivo correcto.
- **Recorte**: los emoji miden 23px de contenido en cajas de 20px (dock) y 35 en 30 (tarjetas) → se cortan por abajo. Afecta a los que se queden (avatares incluidos).

### Copy

- `'Oops!'` literal en `app/`.
- Signos de exclamación en mensajes de éxito: `'¡Cuenta creada exitosamente! Por favor, inicia sesión.'`, `'¡Regalo reservado!'`, `'¡Perfil actualizado!'`.
- Precio con punto decimal en interfaz española: «349.00 €» (debería ser «349,00 €»).

### Coherencia tipográfica

60 usos de `uppercase tracking-*`, con valores incoherentes dentro del mismo fichero (`tracking-widest` a 12px y `tracking-tighter` a 12px en `app/groups/[id]/index.tsx:161,251`). **No entra en esta tanda** (decisión de estilo, sin valor objetivo medible); queda anotado como trabajo posterior.

## Decisiones (confirmadas con el propietario, 2026-10-07)

- **Las cinco unidades entran**: contraste, truncamientos y CTA, copy y formato, semántica de color, e iconografía del cromo.
- **Iconografía: set real**. Se implementa con **`@expo/vector-icons`**, que **ya está disponible** (v15.1.1, dependencia de `expo`) → **cero dependencias nuevas**. Se descarta `react-native-svg` + `lucide-react-native`/`@phosphor-icons/react-native` (no instalados, añadirían dependencia). Los **avatares de emoji del usuario se quedan**.
- **Contraste**: subir el texto informativo al mínimo AA. Umbral **`/70`** (con margen sobre el mínimo calculado `/66`).

## Unidades de trabajo

| # | Tarea | Estado |
| --- | --- | --- |
| U1 | Contraste: llevar todo el texto informativo a ≥4,5:1. Subir los usos de `text-on-surface/NN` por debajo del umbral a `/70` | **hecha** — **89 usos** subidos a `/70` en **22 ficheros**; `tailwind.config.cjs` intacto y ningún otro cambio en el diff (verificado: `git diff` filtrado no devuelve ni una línea que no sea `text-on-surface/NN`). Cuatro usos (`/20` ×2, `/30` ×2) se subieron también en lugar de eximirse: los dos placeholders 🎁 son emoji, y en un emoji la propiedad `color` no pinta nada, así que la clase era inerte; el chevron `›` y la inicial de reserva del avatar simplemente se leen mejor al suelo |
| U2 | **Guardián de contraste**: función pura `contrastRatio`/`minAlphaFor` que **calcule** el umbral a partir de los tokens reales, y escáner de fuentes con guarda de no-vacuidad | **hecha** — `__tests__/contrast-floor.test.ts` (9 tests). Deriva el suelo **de `tailwind.config.cjs`**, no de constantes: barre los seis tokens de superficie, se queda con el que más exige y concluye `/70` (el que manda es `surface-container-highest` `#ecd8e0`, el relleno de inputs, el más oscuro de la familia). Se prueba a sí mismo con un control negativo (`/65` falla, `/66` pasa, `/45` falla) y lleva dos guardas de no-vacuidad (ficheros > 20 y usos vistos > 80) |
| U3 | Truncamientos y CTA: títulos de deseos legibles a 360px y «✓ Ya lo tengo» sin partirse en dos líneas | **hecha** — dos cambios en `components/WishlistCard.tsx`: el título pasa de `numberOfLines={2}` a `{3}` (a 360px la tarjeta da ~116px de texto y un título real necesita 3 líneas: `scrollHeight 60 / clientHeight 40` medidos), y el CTA baja su `tracking-[0.2em]` a `[0.05em]` — ese tracking sumaba ~31px sobre 13 caracteres y era la causa del corte, no el texto. Resultado medido en los **5 usuarios sembrados**: ningún título recortado (incluido «Auriculares Sony WH-1000XM5», el que acreditó el defecto, ahora en 3 líneas completas) y el CTA en **una sola línea** (`103×16`, antes `116×32`) con objetivo táctil de 44px intacto |
| U4 | Copy y formato: fuera «¡Oops!» y las exclamaciones de éxito; precio a formato español (`349,00 €`) | **hecha** — (1) **copy directo en 7 sitios**: `'Oops!'` era el título de la pantalla 404, `'¡Vaya!'` el encabezado de error de dos pantallas, y cuatro mensajes de éxito llevaban exclamación. (2) **Los tres `alert()` de navegador de `GroupsTab`** (bloqueantes, en una PWA) pasan al brindis de la casa; `ToastComponent` **no estaba montado** y ahora sí. (3) **`lib/format-price.ts`** nuevo: `formatPrice` **no destructivo** —lo que no entiende lo devuelve verbatim— y `parsePriceForSort`, que **cierra un defecto real**: `parseFloat('349,00')` devolvía `349` soltando los decimales en silencio y un valor no numérico producía `NaN` en el comparador (orden indefinido). Placeholder `0,00`. (4) El **clamp de notas no se tocó**: el seed inserta `notes: ''`, así que no hay nada que recortar — hallazgo de datos, no visual |
| U5 | Semántica de color: separar los dos tokens sobrecargados en tokens con un significado único, sin cambiar los colores | pendiente |
| U6 | Iconografía del cromo: sustituir 🎁👥👤 del dock y los glifos `✓ ✕ ⋮ ✎ ↗ ←` de los controles por `@expo/vector-icons` (una sola familia, un solo `strokeWidth`/peso); arreglar el recorte de los emoji que se queden. Avatares y datos: intactos | pendiente |
| U7 | Cerrar la banda 769–1009px del nombre de grupo (arrastrada de la feature anterior) | pendiente |

## Verificación

- **Medición en navegador obligatoria** por unidad (es lo que acreditó el defecto del nombre): contrastes recalculados sobre la app corriendo, y recuento de truncamientos antes y después.
- `pnpm run typecheck`, `pnpm run lint` (`--max-warnings 0`), `pnpm run test:unit`.
- Suite E2E en local: `pnpm exec playwright test --project=chromium` (línea base actual: **51 passed / 1 skipped**).
- El guardián de U2 debe verse **fallando** contra el árbol actual antes de aplicar U1.
- Verificación independiente delegada al cerrar la tanda.
- **Riesgo de presupuesto de revisión**: cinco unidades en 22+ ficheros no caben en un solo candidato (ya pasó con 1833 líneas en `mobile-first`: `lens_context_budget_exceeded`). Se cierra con **un work-unit commit por unidad** y revisión encadenada por corte.

## Hallazgos informativos

- **El guardián empezó con una lista de exenciones indexada por `<fichero>:<línea>:<clase>` y provocó un bucle.** Cada edición del código desplazaba las líneas, las claves dejaban de casar, el guardián fallaba y el «arreglo» de la clave desplazaba las líneas otra vez. Se retiró el mecanismo: los cuatro usos afectados resultaron no necesitarlo y la regla quedó **absoluta** (por debajo del suelo es un defecto, sin excepciones). Lección: **una exención indexada por número de línea es una trampa**; si hiciera falta, debería vivir junto al código, no en una tabla aparte.
- La clase `text-on-surface/NN` es **inerte sobre un emoji**: `color` no afecta a los glifos de color. Dos de los cuatro usos «por debajo del suelo» no pintaban nada y aun así contaban como incumplimiento.
- Los emoji de los avatares **se recortan** (23px de contenido en 20px de caja). Si no se sustituyen por iconos, hay que darles caja suficiente.
- El campo `icon` del grupo existe en la base de datos y **la UI no permite elegirlo**: `app/groups/create/index.tsx:12` lo fija a `'🎁'`. Hueco de producto, fuera del alcance de esta tanda.
- Coherencia de `uppercase tracking-*`: 60 usos con valores dispares. Trabajo posterior.

## Commits

- **`78a29be`** — `fix(a11y): bring secondary text up to WCAG AA and guard the floor` (U1+U2): 89 usos a `/70` en 22 ficheros + `__tests__/contrast-floor.test.ts`.
- **`7ac4094`** — `fix(mobile): stop cutting wish titles and wrapping the card CTA` (U3).
- _(U4, pendiente de commit)_ — copy, brindis de `GroupsTab`, `lib/format-price.ts`, orden por precio y tres specs E2E.

## Verificación de U4 (2026-10-07)

**En navegador (medido por el orquestador, no por el writer):**
- **Precio con coma**: los precios del usuario `ana` se pintan `["349,00 €","349,00 €","120,00 €"]` — ninguno en formato inglés.
- **El brindis se ve de verdad** al copiar el código del grupo, y está en la capa **z=10000**, por encima de los 9999 con los que react-native-web monta sus modales. Sin montar el `ToastComponent` no se habría visto nada.

**Y un fallo que fue del orquestador, no del writer:** la primera corrida de la suite dio **7 fallos** (línea base 51 passed / 1 skipped). Causa: **no incluí `e2e/` en las superficies del writer**, así que cuatro puntos de los specs seguían esperando el texto viejo — el placeholder `'0.00'` en `wishlist.spec.ts` (dos veces), la aserción del precio mostrado en el mismo spec, `'¡Regalo reservado!'` en `notification-reservation.spec.ts` y `'¡Perfil actualizado!'` en `profile.spec.ts` (dos veces). Corregidos → **51 passed / 1 skipped**, línea base restaurada.

**Lección**: al cambiar una cadena visible o un placeholder, los specs E2E que la usan **son parte del cambio**. El writer no podía verlo (le pedí explícitamente no correr el E2E para no cargarlo), así que la omisión fue mía al definir la superficie.

**Estado estático y de suite**: `typecheck` y `lint` limpios; `test:unit` **29 ficheros / 232 passed + 1 todo** (antes 28/221; el fichero y sus 11 tests son del formateador).

**Dos ediciones del writer fuera de su superficie**, ambas necesarias y declaradas por él: `__tests__/WishListTab.test.tsx:116` (la consulta del placeholder) y el stub muerto `global.alert = vi.fn()` en `__tests__/GroupsTab.test.tsx:370`, que ya no se usa porque `GroupsTab` no llama a `alert`.

**Sobre el hallazgo R3-003 de la revisión (clamp de notas)**: no se cambió porque el seed inserta `notes: ''` en todos los items (`scripts/seed-complete-database.ts:246,272`), así que no hay notas que renderizar ni recortar. Es un hallazgo **de datos**, no visual: con notas reales de más de dos líneas volvería a plantearse.

## Verificación de U3 (2026-10-07)

**Detector**: elementos con `line-clamp` (que es como react-native-web implementa `numberOfLines`) medidos por `scrollHeight` vs `clientHeight`, más la altura del CTA. Sobre los **cinco usuarios sembrados** a 360×640:

| Caso | Antes | Ahora |
| --- | --- | --- |
| «Auriculares Sony WH-1000XM5» | `60 / 40` recortado a 2 líneas | **`60 / 60`**, 3 líneas completas |
| «Libro: El Archivo de las Tormentas» | recortado | **`60 / 60`** |
| «Cafetera Italiana Bialetti» | recortado | **`60 / 60`** |
| CTA «✓ Ya lo tengo» | `116×32` = **2 líneas** | **`103×16` = 1 línea**, objetivo 44px |

**0 incumplimientos** (ni recortes ni CTA partido). A 1280px el comportamiento es el mismo que antes: títulos a 1 línea y CTA a 1 línea.

**Matiz honesto**: el título largo cabe **justo** en 3 líneas, sin holgura. Un título más largo seguiría recortándose, porque una tarjeta de ancho fijo no puede renderizar texto arbitrario; lo que se ha cerrado es el defecto real (títulos corrientes cortados a 3 líneas por un límite de 2), no la imposibilidad general.

**Estado estático y de suite**: `typecheck` y `lint` limpios; `test:unit` 28 ficheros / 221 + 1 todo; suite E2E chromium **51 passed / 1 skipped**, idéntica a la línea base.

**Nota de proceso**: U3 se hizo en línea y no delegada. El writer anterior falló sin informe y el previo entró en bucle; la unidad resultó ser **un solo fichero con dos cambios pequeños**, por debajo del disparador de delegación multifichero, y el padre ya tenía el arnés de medida montado.

## Verificación de U1+U2 (2026-10-07)

**Guardián visto fallando** (la prueba que no se salta): introduciendo a mano un `/45` en `components/GroupCard.tsx` el guardián falla con `components/GroupCard.tsx:239: text-on-surface/45 — ratio 2.42 < 4.5 (AA no)`; restaurado, vuelve a verde. Comprobado por el orquestador, no solo por el writer.

**Medición en navegador** (Edge headless, app local con Supabase sembrado; 20 elementos, **0 por debajo de AA**):

| Elemento | Antes | Ahora |
| --- | --- | --- |
| «Gestiona tus intercambios» | 3,33 | **5,10** |
| «¿Qué te gustaría recibir?» | 3,33 | **5,10** |
| «Personaliza cómo te ven los demás» | 3,33 | **5,10** |
| «Camiseta» / «Pantalón» / «Zapatos» | 2,54–2,62 | **4,95** |
| Dock «Perfil» / «Grupos» (inactivos, móvil) | 2,92 | **5,10** |
| Pestañas inactivas «Mis deseos» / «Mi perfil» (escritorio) | 3,27 | **4,95** |

**Estado estático y de suite:** `pnpm run typecheck` y `pnpm run lint` (`--max-warnings 0`) limpios; `pnpm run test:unit` verde; `pnpm exec playwright test --project=chromium` → **51 passed / 1 skipped**, idéntico a la línea base (importante porque `e2e/mobile-layout.spec.ts` aserta tamaños de fuente, objetivos táctiles y opacidad en reposo).
