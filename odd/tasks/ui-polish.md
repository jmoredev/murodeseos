# Pulido de interfaz: contraste, semántica de color, truncamientos y cromo (`fix/ui-polish`)

**Abierta:** 2026-10-07 · **Rama:** `fix/ui-polish` (desde `origin/main`, `c25f542`) · **Estado:** cerrada — U1–U8 hechas, verificadas y **aprobadas por revisión nativa** (U1+U2+U3, U4+U5 y U6+U7+U8, las tres quemadas); pendiente empujar la rama y abrir el PR, que es decisión del propietario

## Objetivo

Cerrar la deuda de interfaz que salió de la auditoría visual con la app renderizada. Cuatro unidades decididas por el propietario más el set de iconos del cromo. **Todo lo que se toca aquí es verificable en el navegador** (el entorno E2E local ya funciona), así que ninguna unidad se cierra sin medición.

## Restricción de producto

No cambiar la identidad de marca: la paleta (`#aa2c32` rojo, `#6d5a00` oliva, `#006666` teal), las fuentes (BeVietnamPro + PlusJakartaSans), los tokens `surface-container-*` ni las sombras `ambient`. Tampoco se revierten las decisiones de `mobile-first` (suelo de 12px, objetivos de 44px en móvil, umbral único `>768`, `dvh`, insets). El arreglo no puede degradar la versión móvil.

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
- **U6 — alcance del cromo (2026-10-08)**: se sustituye **todo** el emoji del cromo, **incluido el 🎁 decorativo de los estados vacíos**, por una sola familia de `@expo/vector-icons` (Feather: un solo peso, coherente con la tipografía del producto). Los **avatares de usuario** y el `icon` del grupo (dato de BD) quedan intactos.
- **U7 — banda 769–1009px (2026-10-08)**: **opción B**, el nombre del grupo pasa a **su propia línea** y recupera el ancho completo en todos los anchos. Descartadas: «una columna hasta 1010px» (rompe el umbral único decidido en E2, exigiría un segundo hook) y «aceptar y documentar» (nombre visible pero ilegible, 25–90px). Coste aceptado: la tarjeta de escritorio gana altura.

## Unidades de trabajo

| # | Tarea | Estado |
| --- | --- | --- |
| U1 | Contraste: llevar todo el texto informativo a ≥4,5:1. Subir los usos de `text-on-surface/NN` por debajo del umbral a `/70` | **hecha** — **89 usos** subidos a `/70` en **22 ficheros**; `tailwind.config.cjs` intacto y ningún otro cambio en el diff (verificado: `git diff` filtrado no devuelve ni una línea que no sea `text-on-surface/NN`). Cuatro usos (`/20` ×2, `/30` ×2) se subieron también en lugar de eximirse: los dos placeholders 🎁 son emoji, y en un emoji la propiedad `color` no pinta nada, así que la clase era inerte; el chevron `›` y la inicial de reserva del avatar simplemente se leen mejor al suelo |
| U2 | **Guardián de contraste**: función pura `contrastRatio`/`minAlphaFor` que **calcule** el umbral a partir de los tokens reales, y escáner de fuentes con guarda de no-vacuidad | **hecha** — `__tests__/contrast-floor.test.ts` (9 tests). Deriva el suelo **de `tailwind.config.cjs`**, no de constantes: barre los seis tokens de superficie, se queda con el que más exige y concluye `/70` (el que manda es `surface-container-highest` `#ecd8e0`, el relleno de inputs, el más oscuro de la familia). Se prueba a sí mismo con un control negativo (`/65` falla, `/66` pasa, `/45` falla) y lleva dos guardas de no-vacuidad (ficheros > 20 y usos vistos > 80) |
| U3 | Truncamientos y CTA: títulos de deseos legibles a 360px y «✓ Ya lo tengo» sin partirse en dos líneas | **hecha** — dos cambios en `components/WishlistCard.tsx`: el título pasa de `numberOfLines={2}` a `{3}` (a 360px la tarjeta da ~116px de texto y un título real necesita 3 líneas: `scrollHeight 60 / clientHeight 40` medidos), y el CTA baja su `tracking-[0.2em]` a `[0.05em]` — ese tracking sumaba ~31px sobre 13 caracteres y era la causa del corte, no el texto. Resultado medido en los **5 usuarios sembrados**: ningún título recortado (incluido «Auriculares Sony WH-1000XM5», el que acreditó el defecto, ahora en 3 líneas completas) y el CTA en **una sola línea** (`103×16`, antes `116×32`) con objetivo táctil de 44px intacto |
| U4 | Copy y formato: fuera «¡Oops!» y las exclamaciones de éxito; precio a formato español (`349,00 €`) | **hecha** — (1) **copy directo en 7 sitios**: `'Oops!'` era el título de la pantalla 404, `'¡Vaya!'` el encabezado de error de dos pantallas, y cuatro mensajes de éxito llevaban exclamación. (2) **Los tres `alert()` de navegador de `GroupsTab`** (bloqueantes, en una PWA) pasan al brindis de la casa; `ToastComponent` **no estaba montado** y ahora sí. (3) **`lib/format-price.ts`** nuevo: `formatPrice` **no destructivo** —lo que no entiende lo devuelve verbatim— y `parsePriceForSort`, que **cierra un defecto real**: `parseFloat('349,00')` devolvía `349` soltando los decimales en silencio y un valor no numérico producía `NaN` en el comparador (orden indefinido). Placeholder `0,00`. (4) El **clamp de notas no se tocó**: el seed inserta `notes: ''`, así que no hay nada que recortar — hallazgo de datos, no visual |
| U5 | Semántica de color: separar los tokens sobrecargados en tokens con un significado único, sin cambiar los colores | **hecha** — el censo real resultó **mayor que el enunciado**: `secondary` y `tertiary` llevaban **siete significados** entre los dos (prioridad media/baja, chip de precio, éxito, insignia de rol Admin, insignia «Reservado por ti», CTA «Ya lo tengo» y tinte decorativo de notificación), y `primary` cargaba además el de «prioridad alta». Se añadieron **9 tokens de significado** en `tailwind.config.cjs` (`priority-high/medium/low`, `price`, `success`, `role-badge`, `reserved`, `accent-warm`, `accent-cool`) con **los mismos hex exactos** y se re-apuntaron **24 usos en 7 ficheros**. `secondary`/`tertiary` quedaron **sin ninguna referencia** y se **retiraron del config** (el propio bloque de alias heredados dice quitarlos cuando eso pasa). `docs/DESIGN.md:81` prescribía justamente esos dos tokens muertos y se actualizó. **Render idéntico**: cada token nuevo apunta al hex que ya resolvía el viejo |
| U6 | Iconografía del cromo: sustituir 🎁👥👤 del dock y los glifos `✓ ✕ ⋮ ✎ ↗ ←` de los controles por `@expo/vector-icons` (una sola familia, un solo `strokeWidth`/peso); arreglar el recorte de los emoji que se queden. Avatares y datos: intactos | **hecha** — envoltorio único `components/ui/AppIcon.tsx` (familia Feather, color **siempre** por `className`), **23 sitios** sustituidos en 8 ficheros y guardián `__tests__/icon-chrome.test.ts`. Ver «Verificación de U6» |
| U7 | Cerrar la banda 769–1009px del nombre de grupo (arrastrada de la feature anterior) | **hecha** — opción B en `components/GroupCard.tsx`: el encabezado pasa a `flex-wrap` y la columna del nombre a `md:w-full md:order-3 md:mt-3` (fila propia a ancho completo). Guardián nuevo en `e2e/desktop-layout.spec.ts` que recorre los tres anchos de la banda. Ver «Verificación de U7» |
| U8 | Cerrar los 3 hallazgos de la revisión de U4+U5: precio accesible sin «€», `formatPrice` con valores no finitos y comparador que devuelve `NaN` | **hecha** — `lib/format-price.ts` (guarda de finitud en `formatPrice` + comparador nuevo `comparePriceForSort`, un orden total que nunca devuelve `NaN`), `components/WishListTab.tsx:118` (usa el comparador) y `components/WishlistCard.tsx:67` (el precio accesible pasa al **nombre**, que sí se renderiza). Ver «Verificación de U8» |

## Verificación de U7 (2026-10-08)

**Cambio**: el encabezado de la tarjeta pierde el envoltorio interno y pasa a `flex-row flex-wrap`; el bloque de icono y la columna de acciones son hijos directos y comparten fila, y la columna del nombre lleva `md:ml-0 md:mt-3 md:order-3 md:w-full md:flex-none`. En móvil no hay salto (el nombre conserva `flex-1 min-w-0` y encoge), así que la fila única de siempre se mantiene. Se elimina `md:min-h-[3.5rem]`: era la alineación con el icono de 56px y, al no compartir ya la fila, quedaba como tamaño muerto; `min-h-[3.25rem]` se conserva **solo** para móvil.

**RED observado por el escritor antes de tocar la maquetación** (`e2e/desktop-layout.spec.ts`, el guardián ampliado fallando contra el árbol anterior):

```
/?tab=groups a 769px: el nombre «E2E Test Group» NO cabe en su caja: scrollWidth=145 > clientWidth+1=26
```

**Medición del padre en navegador** (Edge headless, app local con Supabase sembrado), caja del nombre `clientWidth/scrollWidth`:

| Viewport | Antes | Ahora | Resultado |
| --- | --- | --- | --- |
| 360 | 82 / 82 | **82 / 82** | idéntico — móvil sin regresión |
| 768 | 640 / 640 | **640 / 640** | idéntico (a 768 sigue siendo móvil: el umbral es `> 768`) |
| **769** | 25 / 145 | **221 / 221** | banda cerrada |
| **900** | 90 / 145 | **286 / 286** | banda cerrada |
| **1009** | 144,5 / 145 | **341 / 341** | banda cerrada |
| 1010 | 145 / 145 | **341 / 341** | sin regresión |
| 1280 | 152 / 152 | **348 / 348** | mejor |

Contadores «N participantes» sin truncar en todos los anchos (269/269 · 334/334 · 389/389 · 396/396) y sin desborde horizontal de documento. La línea base se reprodujo revirtiendo `components/GroupCard.tsx` de forma temporal (`git stash`): a 769 volvió a medir **25/145 truncando**, lo que confirma que el guardián mide el defecto real y no un artefacto.

**Coste real medido, y el informe del escritor se quedó corto**: la tarjeta de escritorio pasa de **179px a 247px** de alto → **+68px**, no los ~40px que el escritor estimó analíticamente (dijo no haber podido medir el «antes» sin revertir). El ancho **no** cambia (316,5 a 769 · 444 a 1280), luego el grid no se ha tocado. A 360px la tarjeta mide **328×175 antes y después**: cero regresión móvil, medido.

**Limpieza del padre**: el escritor había duplicado `test.use({ viewport: 1280 })` dentro del segundo describe, cuando ya existe a nivel de fichero; se retiró la línea redundante (el scope de fichero ya cubre ese describe y el de la banda lo sobrescribe a 769).

**Guardián nuevo**: `test.describe('Banda de dos columnas (769–1009px)')` recorre `[769, 900, 1009]` con `setViewportSize` + `waitGroupsTabLoaded` por ancho, y aserta no-vacuidad, `scrollWidth <= clientWidth + 1` del nombre y de cada contador, con el ancho en el mensaje de fallo. Cierra el hueco V9 que la feature anterior dejó abierto: el guardián de 1280 cazaba el colapso a 0 pero **no** protegía esta banda.

**Estado**: `pnpm run typecheck` y `pnpm run lint` (`--max-warnings 0`) limpios; `test:unit` **30 ficheros / 242 passed + 1 todo**; `playwright test --project=chromium e2e/desktop-layout.spec.ts --workers=1` → **3 passed** (banda + 1280).

## Verificación de U8 (2026-10-08)

**Test-first, con el RED observado antes de implementar** (no deducido): se añadieron los seis casos nuevos, se ejecutó la implementación **anterior** recuperada de `git show HEAD:lib/format-price.ts` y se capturó el defecto en vivo:

```
formatPrice(NaN)        = "NaN"          formatPrice(Infinity)  = "Infinity"
formatPrice(-Infinity)  = "-Infinity"    oldCompare('gratis','aprox 30') = NaN  → orden indefinido
```

El comparador viejo (`?? Number.POSITIVE_INFINITY`) devolvía `NaN` incluso con **dos valores iguales** (`oldCompare('x','x')` → `NaN`), que es justo lo que el comentario del código afirmaba imposible.

**El hallazgo de a11y era más profundo que el de la revisión.** La lente leyó el código y concluyó «el valor accesible omite el €»; medido en el DOM real, **`react-native-web` 0.21 no emite `accessibilityValue` en un `role="button"`**: el botón salía con `aria-label="Test Gift"` y **sin** `aria-valuetext`, así que el precio no llegaba al DOM en absoluto. Se comprobó con una sonda desechable que volcó el `outerHTML` del botón.

**Arreglo elegido**: el dato accesible pasa al **nombre** (`aria-label`), la única vía que sí se renderiza, y se reutiliza `priceText` —la misma expresión que pinta el texto visible— para que el «€» no pueda divergir entre lo que se ve y lo que se oye. Se retira el `accessibilityValue` porque en la única plataforma que se entrega es código muerto, y dejarlo sería exactamente el pecado que este repo ya ha pagado: un atributo que afirma algo que la plataforma ignora. El nombre accesible queda «*título*. Prioridad *X*. *precio* *€*. *estado de reserva*.»

**Sin impacto en E2E**: se revisaron los localizadores por etiqueta; ninguno depende de la etiqueta de la tarjeta (los `getByRole('button', { name })` del área son «Nuevo deseo», «Guardar deseo» y «Eliminar»). En unitarios sí hubo que actualizar el del título a subcadena, y de paso se corrigió una mentira latente: la variable se llamaba `img` y contenía el botón de la tarjeta (`Image` está oculto para AT).

**Estado**: `pnpm run typecheck` y `pnpm run lint` (`--max-warnings 0`) limpios; `pnpm run test:unit` **29 ficheros / 237 passed + 1 todo** (antes 232 + 1; +6 casos nuevos y −1 que replicaba el comparador defectuoso en vez de probarlo).

## Verificación de U6 (2026-10-08)

**Envoltorio único**: `components/ui/AppIcon.tsx` — una familia (Feather), un peso, y el color **siempre** por el `className` NativeWind del llamador (nunca una prop `color` con hex, que rompería el token del tema). Los nombres permitidos derivan del propio `Feather.glyphMap`, así que un nombre inexistente es un error de tipos y no un «?» silencioso. Se importa por la subruta `@expo/vector-icons/Feather` (el índice del paquete arrastra todos los sets).

**23 sitios sustituidos en 8 ficheros**: dock (🎁👥👤), glifos de control (✓ ✕ ⋮ ✎ ↗ ←) y los placeholders decorativos de 40 y 64px. **Intactos por decisión**: avatares de usuario, `groups.icon` (dato de BD), los pictogramas de tipo de notificación (✨🎁📭🎅🎂🕯️🔔 — son contenido semántico, no cromo de control; Feather no tiene equivalente para 🎂/🕯️/🎅 y un icono genérico perdería significado) y el 😕 de los estados de error. **Fuera de alcance, anotado**: el `›` de «Ver deseos ›» (va dentro de una etiqueta de texto) y el 🗑 de los modales de borrado.

**Guardián** `__tests__/icon-chrome.test.ts` (5 pruebas): cero glifos en los ficheros del cromo, no-vacuidad (9 ficheros leídos y no vacíos, comprobado antes de barrer), `@expo/vector-icons` importado **sólo** por el envoltorio (por AST, no por regex) y el propio `AppIcon` sin color hardcodeado. El escritor observó el **RED con 24 ofendidos** (los 23 sitios más el fichero del envoltorio, que aún no existía).

**Defecto del guardián, encontrado y corregido por el padre**: el barrido de texto marcaba el glifo **dentro de un comentario**, así que el guardián se puso rojo por su propia documentación (dos comentarios que explicaban el retiro del ✓). Se reescribió para recorrer el **AST** y mirar sólo `JsxText` y literales de cadena, que por construcción nunca son comentarios, con **control negativo en el propio test** (`// ✓` y `{/* ✓ */}` no cuentan; `<Text>✓</Text>` sí). El primer intento con el escáner de TypeScript devolvía **0 comentarios** en el fichero real, así que se descartó esa vía en lugar de dejarla a medias.

**Medición en navegador** (lo que el escritor no podía hacer): Edge headless vía `playwright-core` contra la app local con Supabase sembrado, a 360/375px y 1280px.

| Qué se midió | Resultado |
| --- | --- |
| ¿Se carga la fuente real? | **Sí**: `document.fonts.check('20px Feather')` → `true`, `feather:loaded`. Sin tofu |
| Códigos de glifo | Coinciden **1:1** con el mapa de Feather: `f110`=arrow-left · `f12b`=check · `f175`=gift · `f205`=user · `f20a`=users · `f160`=edit-2 · `f117`=arrow-up-right |
| **¿El `className` pinta el icono?** (riesgo declarado por el escritor) | **Sí**: en el dock, la pestaña activa mide `rgb(170,44,50)` (= `text-primary`) y las inactivas `rgba(76,33,43,0.7)` (= `text-on-surface/70`), **idénticos al color de su etiqueta** en los tres estados |
| Recorte | **Ninguno**: 12+ instancias medidas (12/16/20/40px) sin desbordar su caja; antes el emoji medía 23px dentro de una caja de 20px |

**Segundo defecto introducido por el escritor, corregido por el padre**: `gapPx = 0` entre el check y el texto del CTA «Ya lo tengo» y del chip «Reservado por ti» (el glifo ✓ llevaba su espacio dentro del propio string). Añadido `gap-1` → **4px medidos**, y el CTA **sigue en una línea** (102,2 → 106,2px de ancho, 16px de alto), que era el contrato de U3.

**No medido**: el placeholder de 64px y el cierre de 16px de `WishDetailModal` (exigen seleccionar un ítem dentro de la ruta de detalle); el mismo mecanismo está medido a 12/16/20/40px.

**E2E: un fallo real, corregido.** El locator reescrito por el escritor (`getByTestId('info-sheet-close')` con `click({ force: true })`) falló con **«Element is outside of the viewport»**: `force` salta la espera de estabilidad y calcula el punto con la hoja a mitad de su animación de entrada (medida real una vez asentada: 44×44 en y=207, **dentro** del viewport). Se cambia a **click normal**, que además comprueba que un usuario puede pulsarlo de verdad. La hoja se cierra y el spec pasa. **La causa de fondo de que el test anterior usara un click a nivel de DOM era exactamente esta carrera**, no un defecto del botón.

**Desviaciones de superficie, ratificadas**: `vitest.config.ts` (+1 alias) y `test/mocks/expo-vector-icons.tsx` (mock nuevo). Son necesarias —el paquete publica JSX sin transformar y jsdom no lo parsea, así que sin el alias ningún test que monte un `AppIcon` carga— y siguen el patrón que ya existía para `expo-linear-gradient`. El mock no oculta roturas: la prueba de que el paquete real funciona es la medición en navegador (fuente cargada y códigos correctos).

**Dependencia declarada**: `@expo/vector-icons` estaba instalado y resolvía, pero **no estaba declarado** en `package.json` (llegaba sólo por hoisting de pnpm, como transitiva de `expo`), y los tres workflows hacen `pnpm install --frozen-lockfile`: era una trampa latente. Declarado `^15.1.1`; el lockfile suma 3 líneas y el install congelado pasa.

**Estado**: `pnpm run typecheck` y `pnpm run lint` (`--max-warnings 0`) limpios; `test:unit` **30 ficheros / 242 passed + 1 todo** (antes de U6: 29/237). E2E local con resiembra y `--workers=1`: el único fallo de la corrida fue el del locator, ya corregido y verificado en su test.

**Nota cosmética**: `components/WishlistCard.tsx` y `components/WishListTab.tsx` estaban en CRLF y quedaron en LF; el diff no se infla porque git normaliza.

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
- **(U6, `R3-appicon-color-contract-unproved`)** — el guardián de iconos comprueba que el envoltorio **no** lleva un hex hardcodeado, pero eso **no prueba** que el colour llegue a pintarse: la prueba real fue la medición en navegador (dock activo `rgb(170,44,50)` = `text-primary`, inactivos `rgba(76,33,43,0.7)` = `text-on-surface/70`, idénticos a la etiqueta). El guardián unitario no puede sostener esa afirmación; si se quiere automatizar, tiene que ser un test de navegador, no de fuente.
- **(U6, `R3-icon-guard-whole-file-exemption`)** — la exclusión de `app/groups/[id]/index.tsx` en el guardián es **por fichero entero** (el `🎁` de `{group?.icon}` es un dato de BD), así que un glifo de chrome reintroducido en ese fichero **no** lo cazaría. Trabajo posterior: acotar la exclusión a la línea del `icon`.
- **(U6, `R3-vector-icons-alias-scope`)** — el alias de vitest apunta sólo a la subruta `@expo/vector-icons/Feather`; un import del índice del paquete no pasaría por el mock. Hoy es correcto porque el envoltorio es el único que importa la familia, pero conviene saberlo antes de añadir un segundo punto de import.

## Revisión nativa del corte U6+U7+U8 (2026-10-08)

Linaje **`review-6972711e352f35e5`**: riesgo medio, 1 lente (`review-reliability`), **21 ficheros / 839 líneas** (`737+102`), presupuesto de corrección 200 → **aprobada a la primera** (sin refutador) y autoridad **quemada** (`gentle-ai.review-acknowledged/v1`).

**Acotado del candidato**: `inspect` sólo ofrecía **`supabase/config.toml`** (la proyección `workspace` ve el árbol sucio, no el contenido commiteado), que es el **swap temporal de puertos** — un artefacto de entorno, no la feature. Se verificó comparando el `base_tree` del candidato con `git rev-parse HEAD^{tree}` (coincidían) y se arrancó con **`baseRef=bbbec9665249c8b1e3a5e504e413944d96115fa7` + `committedOnly: true`**, que acotó exactamente el corte (21 ficheros, `737+102=839` líneas, sin `supabase/`). **Tercera vez que este repo paga la misma trampa**: cuando la implementación está commiteada y el árbol tiene un cambio local intencionado, la proyección del recordatorio apunta al artefacto.

**Un incidente sin consumo de autoridad**: el primer `start` devolvió `consent-binding-stale` / `consent-binding-expired` (una binding caducada a los 10 minutos sin respuesta) con `lineage_created: false` y `mutation_performed: false`. Reejecutado `start` con `idempotencyKey` nueva → linaje creado a la primera. **Nada se quemó en el intento fallido.**

Tres hallazgos **advisory, informativos, ninguno bloqueante** (el proveedor lo dice explícitamente: no reabren la revisión ni son motivo para repetirla; son trabajo posterior, ya recogidos arriba): `R3-appicon-color-contract-unproved` (WARNING) · `R3-icon-guard-whole-file-exemption` (SUGGESTION) · `R3-vector-icons-alias-scope` (SUGGESTION).

## Verificación de U5 (2026-10-07)

**Censo real, medido antes de tocar nada**: 21 usos de `secondary`/`tertiary` en 7 ficheros (nada en `lib/`) más 3 de `primary` usados como «prioridad alta» → **siete significados sobre dos tokens** más uno sobre `primary`.

| Token nuevo | Hex | Hex que ya resolvía |
| --- | --- | --- |
| `priority-high` | `#aa2c32` | `primary` |
| `priority-medium` · `price` · `role-badge` · `accent-warm` | `#6d5a00` | `secondary` |
| `priority-low` · `success` · `reserved` · `accent-cool` | `#006666` | `tertiary` |

**24 usos re-apuntados** en `components/WishlistCard.tsx` (7), `components/WishDetailModal.tsx` (5), `components/WishListTab.tsx` (3), `app/(auth)/login/index.tsx` (2), `components/ProfileTab.tsx` (2), `components/NotificationItem.tsx` (4) y `app/groups/[id]/index.tsx` (1). Recuento final verificado por clase: 3+3+3 de prioridad, 4 de precio, 5 de éxito, 1 de rol, 1 de reservado, 2+2 de tinte = **24 exactos**.

**Deriva documental cerrada**: `docs/DESIGN.md:81` prescribía literalmente «usa `secondary` y `tertiary` para etiquetas de categorización» — es decir, mandaba usar los tokens que se acaban de retirar. Actualizado a los tokens de significado. Es el mismo patrón de podredumbre documental que ya apareció en `docs/DEVELOPMENT.md` durante `mobile-first`.

**Verificación**: `git grep` sobre ficheros versionados → **cero referencias de clase** a los tokens viejos. `typecheck` y `lint` limpios. `test:unit` **29 ficheros / 232 passed + 1 todo**. Suite E2E chromium **51 passed / 1 skipped**.

### Dos incidentes, ninguno del código

1. **La delegación fue a la rama equivocada y fue culpa mía.** Seguía en `chore/local-dev-ports` tras arreglar el CI de la PR #39 y no volví a `fix/ui-polish` antes de delegar, así que el writer heredó esa rama. **Su informe afirmaba que sus 8 ficheros eran «byte-idénticos» a los de `fix/ui-polish`, y era falso**: el árbol tenía 0 ocurrencias de `text-on-surface/70` frente a 5 y 8 en los ficheros de la rama correcta, es decir sus ediciones estaban sobre versiones **anteriores a U1 y U3**. Copiar esos ficheros habría revertido dos unidades ya revisadas. Se guardó su diff como evidencia, se descartó, se cambió de rama y se re-aplicaron los 24 renames sobre el texto real de esta rama (los números de línea de la tabla original ya no valían; el mapeo es por contenido). **Lección: verificar el árbol, no el informe** — y confirmar la rama ANTES de delegar, no después.
2. **La suite E2E local dio 9 fallos que no eran del cambio.** Todos con esperas de ~30s y en specs sin relación con colores. Causa: en local los workers son tantos como CPUs (CI usa `workers: 1`) y la suite **no se autolimpia** (defecto E-10 del propio repo), así que la base acumuló estado de muchas corridas. Aislados, los specs afectados pasan; con `--workers=1` los fallos bajan a 2; y tras **resembrar los dos scripts** y correr con 1 worker, la suite queda en **51 passed / 1 skipped**. **Lección: para que una corrida local valga como verificación hay que resembrar y usar `--workers=1`; si no, da fallos y verdes falsos.**

## Commits

- **`78a29be`** — `fix(a11y): bring secondary text up to WCAG AA and guard the floor` (U1+U2).
- **`7ac4094`** — `fix(mobile): stop cutting wish titles and wrapping the card CTA` (U3).
- **`6564dab`** — `fix(a11y): direct copy, a real toast for the group actions, and Spanish prices` (U4).
- **`bbbec96`** — `refactor(design): one token per meaning instead of two tokens for seven` (U5): 9 tokens de significado, 24 usos re-apuntados, `secondary`/`tertiary` retirados y `docs/DESIGN.md` actualizado.

## Revisión nativa de U4+U5 (2026-10-07)

Linaje **`review-f7abbb49da69f35c`**: riesgo medio, 1 lente (`review-reliability`), **20 ficheros / 313 líneas**, presupuesto 157 → **aprobada a la primera** (sin refutador) y autoridad **quemada**.

**Acotado del candidato**: `inspect` ofrecía la rama entera desde `main` (33 rutas, U1–U5), así que se arrancó con `baseRef=7ac4094` + `committedOnly: true` → candidato `7ac4094..bbbec96` (U4+U5), confirmado por los `candidate_paths` del proveedor. Es la misma técnica que funcionó con el delta de documentación de `mobile-first`: **cuando `inspect` ofrece la rama acumulada, reducir con `baseRef` al tramo no revisado**.

Tres hallazgos **advisory, informativos, y los tres reales** (verificados por el padre contra el código, no aceptados por la severidad): se cierran en **U8**.

| ID | Sev. | Ubicación | Defecto |
| --- | --- | --- | --- |
| `R3-a11y-price` | WARNING | `components/WishlistCard.tsx:68` | El valor accesible es el precio **sin** el «€» que sí lleva el texto visible (`${a11yPriceText} €`): un lector de pantalla lee «349,00» |
| `R3-format-nan` | SUGGESTION | `lib/format-price.ts:25` | La rama numérica es `String(price)` sin guarda de finitud: `formatPrice(NaN)` → `"NaN"`, `formatPrice(Infinity)` → `"Infinity"` → se pintaría «NaN €» |
| `R3-sort-nan` | SUGGESTION | `components/WishListTab.tsx:120` | El comparador usa `?? Number.POSITIVE_INFINITY` y el comentario afirma que «nunca devuelve NaN», y **es falso**: `Infinity - Infinity === NaN`, así que con **dos** precios no numéricos devuelve `NaN` y el orden queda indefinido. Doble defecto: el hueco lógico **y** un comentario que afirma lo contrario de lo que hace el código |

## Revisión nativa de U1+U2+U3 (2026-10-07)

Linaje **`review-f594a23f576fd4ac`**: riesgo medio, 1 lente (`review-reliability`), 23 ficheros / 694 líneas, presupuesto 200 → **aprobada**, autoridad **quemada**. Cuatro hallazgos advisory, todos informativos (`R3-001`/`R3-002`/`R3-004` en el propio guardián `__tests__/contrast-floor.test.ts`, `R3-003` en el clamp de notas de `components/WishlistCard.tsx:142`).

**`R3-003` se decidió no tocar** (recogido en «Verificación de U4»): el seed inserta `notes: ''`, así que no hay notas que recortar; es un hallazgo **de datos**, no visual.

**Incidencia de admisión, sin consumo de slot**: el primer envío del resultado de la lente se rechazó truncado (`reviewer payload contains no complete JSON object: … scan ended at byte 5671`); el payload rechazado quedó en `.git/gentle-ai/rejected-results/<linaje>/…`. La instrucción del proveedor fue **no reenviar los bytes rechazados**: STATUS fresco volvió a ofrecer el mismo slot (idéntico `subject-hash`) y el reintento **pasó**. Lección: una salida truncada del revisor es recuperable con STATUS fresco; no hay que reiniciar el linaje.

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
