# Pulido de interfaz: contraste, semántica de color, truncamientos y cromo (`fix/ui-polish`)

**Abierta:** 2026-10-07 · **Rama:** `fix/ui-polish` (desde `origin/main`, `c25f542`) · **Estado:** abierta — U1 y U2 cerradas; pendientes U3–U7

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
| U3 | Truncamientos y CTA: títulos de deseos legibles a 360px y «✓ Ya lo tengo» sin partirse en dos líneas | pendiente |
| U4 | Copy y formato: fuera «¡Oops!» y las exclamaciones de éxito; precio a formato español (`349,00 €`) | pendiente |
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

- _(U1+U2, pendiente de commit)_ — contraste AA: 89 usos a `/70` en 22 ficheros + `__tests__/contrast-floor.test.ts`.

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
