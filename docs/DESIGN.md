# Design System Document

> **El sistema visual vigente es `design/rediseno-muro/sistema-nuevo.md`** (rediseño «Personas primero»,
> en curso en la rama `feat/rediseno`): paleta canónica de 32 tokens, tipografía única **Nunito** y
> botón primario **teja plano**. Este documento describe la dirección anterior («The Digital Keepsake»)
> y se conserva por su historia y su método de auditoría; las secciones 2 y 3 ya llevan los valores
> nuevos, y el resto se reescribe a medida que cada tramo del rediseño aterriza.

## 1. Overview & Creative North Star: "The Digital Keepsake"
This design system moves away from the clinical, rigid grids of traditional social apps to embrace a philosophy of **The Digital Keepsake**. The goal is to make every "Wish" feel like a tangible, precious object pinned to a curated gallery.

We achieve a high-end editorial feel by leaning into **intentional asymmetry** and **tonal depth**. Instead of boxing content into strict rectangles, we use varied card heights and overlapping elements to create a rhythmic, organic flow. The experience should feel like flipping through a premium heavy-stock magazine—tactile, airy, and deeply personal.

---

## 2. Colors: Tonal Radiance
The palette is rooted in a warm, "pantry-chic" aesthetic: cream and sand neutrals with a **teja** primary accent. La tabla de tokens, usos y ratios verificados está en `design/rediseno-muro/sistema-nuevo.md` §1 (`tailwind.config.cjs` y `app/global.css` son la implementación); aquí queda el resumen.

### Color Tokens (Material Convention)
* **Primary (The Accent):** `--primary` `#B93D12` (teja; blanco encima 5,62:1). Hover y anillo de foco `--primary-dark` `#8F2E0C`.
* **Surface (The Canvas):** `--bg` `#FFF8F1` (crema) para el lienzo; `--surface` `#FFFFFF` para tarjetas, campos, hojas y barras.
* **Sectioning / Sand:** `--sand` `#FBEBDC` y `--sand-2` `#F6EBE2` (sección, etiqueta de grupo, pista del interruptor, control deshabilitado); tinta sobre arena `--sand-ink` `#7A4A2A` (6,34:1).
* **Ink:** `--ink` `#2B1A12` (texto e icono, 15,84:1 sobre el lienzo) y `--ink-2` `#5C4033` (secundario, metadatos y placeholders, 8,92:1).
* **Success (The Calm):** `--accent` `#2F6F4E` con `--accent-soft` `#E1F0E7` y `--accent-ink` `#1F4A33` (8,54:1).
* **Danger:** `--danger` `#B42318`, `--danger-dark` `#7A1A12`, `--danger-soft` `#FDECEA`.
* Los antiguos `priority-high|medium|low`, `price`, `success`, `reserved`, `role-badge` y `accent-warm|cool` siguen existiendo como nombre, ya reasignados a esos papeles; la prioridad pasa a corazones + texto en el rediseño y deja de tener color propio.

### The "No-Line" Rule
**Invertida por el rediseño.** El sistema nuevo **sí** usa contornos y el motivo está escrito en `sistema-nuevo.md` §11: para todas las edades, un contorno visible define mejor dónde se pulsa que una sombra tenue. Tres grosores, un papel cada uno: `--border` `#F0DFD2` (separador de 1 px), `--border-strong` `#E3C8B6` (1,5 px de filas y chips) y `--border-control` `#B67A50` (2 px de **todo control**, 3,57:1: es el cambio de contraste más visible del rediseño, S5).

### Surface Hierarchy & Nesting
Sigue siendo una pila de capas, con los valores nuevos:
1. **Base:** `surface` (#FFF8F1, el lienzo; `--bg`)
2. **Sectioning:** `surface-container-low` (#FBEBDC, `--sand`)
3. **Floating Cards:** `surface-container-lowest` (#FFFFFF, `--surface`)
4. **Interactive Overlays:** `surface-bright` (#FFF8F1) y `surface-sunken` (#FFFCF8, filas leídas y Recibidos)
5. **Fields (inputs):** `surface-container-highest` (#FFFFFF) — el campo deja de ser el malva `#ecd8e0`: es blanco con contorno de 2 px `--border-control` (`sistema-nuevo.md` §10.12).

### The "Glass & Gradient" Rule
**Retirada.** Todas las superficies son **opacas** y el desenfoque queda fuera: baja el contraste del texto y cuesta en móviles modestos. La única transparencia permitida es `rgba(255,248,241,.97)` en la barra de pestañas (`sistema-nuevo.md` §5, §11).
* **Signature Texture:** el botón primario es **teja plano** `--primary` (#B93D12) con texto blanco 5,62:1 constante y sombra cálida `--sh-cta`; **no** hay degradado `primary → primary-container`. El degradado restaba legibilidad al texto blanco en su tramo claro (`sistema-nuevo.md` §10.1, §11).

---

## 3. Typography: Editorial Clarity
**Una sola familia: Nunito** (redondeada, de contraformas abiertas, pesos 200–1000), sustituye a la pareja Plus Jakarta Sans + Be Vietnam Pro (`sistema-nuevo.md` §2, S6).

* **Una familia, tres pesos:** 600 cuerpo y controles (`--weight-body`), 700 botones y etiquetas (`--weight-label`), 800 títulos (`--weight-title`). En React Native el peso va **en el nombre de la familia** (`font-sans`/`font-sans-semibold` → `Nunito_600SemiBold`, `font-sans-bold`/`font-display` → `Nunito_700Bold`, `font-display-extrabold` → `Nunito_800ExtraBold`), no en una clase de peso: el runtime no sintetiza pesos.
* **Escala:** 11 pasos, de 13 a 30 px, con cuerpo base **17 px**; ningún texto por debajo de 13 px y sin cursivas (`sistema-nuevo.md` §2.1). Las maquetas se dibujaron con fuentes del sistema a esos mismos tamaños, así que el cambio de familia no altera la composición.

**Escala en uso:** `text-xs` (12 px) es el suelo que vigila `__tests__/typography-floor.test.ts`; por encima, se usa la escala canónica y no valores sueltos. El peso, como se ha dicho, va en el nombre de la familia.

**Hierarchy Note:** Always lead with high contrast. A `display-md` headline should be followed by a `body-md` description with significant breathing room (using `spacing-6`) to ensure the layout feels "designed" rather than "populated."

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often messy. This system uses **Ambient Light Physics**.

* **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` card placed on a `surface-container-low` background creates a natural lift.
* **Ambient Shadows:** When a float is required (e.g., a "Post a Wish" FAB), the shadow is tinted with the ink, never pure black: `0 2px 8px rgba(43,26,18,.05)` (`--sh-1`) para una tarjeta en reposo, y los tokens `--sh-cta`, `--sh-sheet`, `--sh-toast`, `--sh-dialog` para cada elevación (`sistema-nuevo.md` §5).
* **The "Ghost Border" Fallback:** ya no es un fallback: el contorno es parte del sistema (ver §2). `--border` / `--border-strong` son decorativos (1,30:1 y 1,59:1) y **nunca** contorno de un control; para eso está `--border-control` `#B67A50` (3,57:1, WCAG 3:1).
* **Glassmorphism:** **retirado**. Todas las superficies son opacas; la única transparencia permitida es `rgba(255,248,241,.97)` en la barra de pestañas (`sistema-nuevo.md` §5, §11).

---

## 5. Components

### Acceso (T2b · artboard 11)

- **Una sola contraseña con «Mostrar»**: `components/ui/PasswordInput.tsx` acepta `toggleMode="text"` (48 px dentro del
  campo de 56). El alta conserva el ojo (`toggleMode` por defecto). Se retiraron el campo de repetición y la validación de
  coincidencia en `app/(auth)/reset-password`; el mínimo sigue en 8 caracteres (`lib/password.ts`).
- **Recuperar la contraseña es una pantalla propia** (`/forgot-password`) y su confirmación otra (`/recovery-sent`, con el
  correo en un chip). La respuesta es la misma exista o no la cuenta, y el 429 («Se pidieron demasiados enlaces seguidos»)
  deja «Enviar enlace» y «Enviar otra vez» sin efecto.
- **Nueva contraseña** (`/reset-password`) confirma en «Contraseña cambiada» («Ir a mi lista» / «Cerrar sesión») en vez de
  saltar a la lista; el enlace caducado tiene su propio estado con «Pedir un enlace nuevo».
- **Errores junto al campo, nunca con prefijo «Error:»**: «Escribe tu correo electrónico», «Escribe tu contraseña», «Por
  favor, introduce un correo electrónico válido» y «Correo electrónico o contraseña incorrectos» + explicación. Nada de lo
  escrito se borra y el foco va al primer campo que falla. La conexión caída tiene su aviso «Sin conexión».
- **Piezas compartidas** en `components/auth/` (marco, marca, campo con error y ayuda, aviso, botón con anillo de carga y
  enlaces) construidas con los tokens de `sistema-nuevo.md`; `email-input` / `password-input` / `login-button` /
  `register-link` / `forgot-password-link` / `new-password-input` / `save-password-button` se conservan, y el correo de la
  recuperación es `forgot-email-input`.

### Buttons
* **Primary:** fondo `--primary` **teja plano** (#B93D12), `full` roundedness, texto blanco 17 px/700 en `on-primary`, sombra `--sh-cta`. Sin degradado (`sistema-nuevo.md` §10.1).
* **Secondary:** `surface` + contorno `--border-strong` y texto `--ink`; al pasar, `--hover-control` (§10.2).
* **Tertiary:** estilo texto: sin fondo, `primary-dark` subrayado; hover `--primary-soft` (§10.4).

### Wish Cards
* **Rule:** Forbid divider lines.
* **Style:** Use `surface-container-lowest` (#ffffff) with a `DEFAULT` (0.5rem/8px) or `md` (0.75rem/12px) corner radius.
* **Layout:** Use vertical white space (`spacing-4`) to separate the "Wisher's Name" from the "Wish Body."

### Input Fields
* **Style:** campo `surface` (#FFFFFF) de 56 px de alto, radio `--r-sm` y contorno **2 px** `--border-control` (#B67A50); placeholder `--ink-2` (8,92:1). Deshabilitado: `--sand-2` + `--ink-2` (`sistema-nuevo.md` §10.12).
* **Focus State:** anillo de 3 px `--primary-dark` con 3 px de separación (`:focus-visible` de `app/global.css`); el error suma contorno `--danger` y fondo `--danger-soft`.

### Navigation (The Floating Dock)
* **Style:** A centered, floating pill using Glassmorphism. `surface` at 80% opacity, `xl` corner radius, and a soft ambient shadow. Icons should be `outlined` with a `2px` stroke weight.

### Estados globales (T2a, artboard 12)
Una pieza por patrón; cambian el color y el texto, nunca la forma (`design/rediseno-muro/12-estados-globales.html`).
* **Arranque (`components/BootScreen.tsx`)**: nombre, qué es la app y «Preparando tu muro. La primera vez suele tardar unos segundos.», con un `role="status"` que anuncia el arranque. Sustituye al fondo liso mientras cargan las fuentes y al «Cargando...» de la portada. Su texto lleva la pila del sistema de respaldo: existe justo mientras Nunito carga.
* **Esqueleto (`components/ui/Skeleton.tsx`)**: `Skeleton`, `SkeletonRow` y `SkeletonCard` con las formas del artboard (línea 15, avatar 48, tile 56, pastilla 28, hero 186). Color del token `border` y `animate-pulse`; es **decorativo** (`aria-hidden`) y el «cargando» lo anuncia la pantalla una vez. En T2a no se conecta a ninguna pestaña (S9).
* **Sin conexión (`components/OfflineBanner.tsx` + `lib/use-online.ts`)**: banda con `role="alert"`, icono, título «Sin conexión», detalle honesto y «Reintentar». Montada una vez en `app/_layout.tsx`, en el flujo de la columna (empuja, no tapa). Sin conexión no se promete nada guardado (S8): el detalle habla sólo de la conexión. En nativo el hook es inerte (siempre «en línea»).
* **Error y 404 (`components/AppErrorBoundary.tsx`, `app/+not-found.tsx`)**: «Algo ha ido mal» dice que lo guardado sigue guardado y ofrece «Reintentar» + «Recargar la página»; la 404 dice qué pasa, ofrece «Ir a Inicio» y «Abrir Mi lista» (`/?tab=wishlist`) y explica lo de los enlaces de invitación.
* **Brindis (`components/Toast.tsx`)**: burbuja de tinta (`bg-ink`, `--on-ink`), acción única («Deshacer»/«Reintentar») que **sustituye** a la ×, dos líneas en móvil cuando hay acción y **el de error no se va solo**. Sin acción se cierra a los 3 s; con acción, a los 10 s (propuesta de §13). La API es la misma para los cuatro llamadores actuales.
* **Hoja y ventana (`components/ConfirmModal.tsx`)**: hoja inferior con asa y velo al 52 % en móvil; ventana centrada de 520 px y velo al 30 % en escritorio. Primero «Cancelar», después la acción; destructiva en `--danger`. La copy la sigue decidiendo cada pantalla (S9).
* **Novedades (`components/WhatsNewModal.tsx`)**: cabecera sobre `--primary-soft` con destello en tile blanco, píldora `v<release>`, subtítulo «Lo que ha cambiado desde la última vez que entraste.» y etiqueta «En esta versión». El enlace al historial llega en T8.

---

## 6. Do's and Don'ts

### Do
* **Do** use asymmetrical margins. For example, give a headline more top-padding than bottom-padding to create a "pushed" editorial look.
* **Do** use the semantic colour tokens for their one meaning — `price`, `success`, `priority-high|medium|low`, `role-badge`, `reserved`, `accent-warm|cool`. They replaced `secondary`/`tertiary`, which each carried several meanings at once (priority, price, success, badges, decorative tint) so a chip's colour did not tell you what it meant. Several share a hex on purpose; the name carries the meaning, and each can be recoloured on its own.
* **Do** leverage the `full` roundedness for interactive elements like Chips and Buttons to emphasize the "friendly" prompt.

### Don't
* **Don't** use 1px dividers to separate list items. Use a `0.35rem` (spacing-1) height gap or a subtle background tint change.
* **Don't** use pure black (#000000) for text. Always use `on-background` (#2B1A12, `--ink`) to keep the warm "pantry-chic" vibe intact.
* **Don't** cram content. If a screen feels full, increase the `spacing` tokens. Luxury is defined by the space you don't use.
---

## 7. Cómo se comprueba (medido en el navegador, 2026-10-21)

El resto del documento es la **dirección** del sistema. Esta sección es lo **medido** sobre el navegador real, para no confundir intención con resultado. La herramienta es `e2e/audit-ui.spec.ts` y se corre con:

```bash
node_modules/.bin/playwright test e2e/audit-ui.spec.ts --project=chromium
```

Escribe `test-results/audit-ui.md` y no falla por lo que encuentra: mide. Recorre deseos, alta de deseo, grupos y perfil con el usuario E2E ya autenticado.

### Resultado de la primera pasada

| Comprobación | Hallazgos | Lectura |
| --- | --- | --- |
| Texto por debajo de 12 px | **0** | `text-xs` se usa para etiquetas, no para cuerpo |
| Desborde horizontal | **0** | nada obliga a desplazarse de lado |
| Contenido recortado (ambos ejes) | **0** | no hay texto comido por un contenedor |
| Imágenes rotas | **0** | |
| Contraste WCAG medido | **0** | ver la nota de abajo |
| Contraste **no medible** | **4** | texto blanco sobre el gradiente de las CTA |
| **Objetivos táctiles < 44 px** | **0** tras el arreglo | antes eran **23**: pestañas a 36 px y botones de icono de 40×40. Ahora es la única regla que **hace fallar** la auditoría, para que no vuelva |
| Superficies anidadas | **1** | un bloque `surface-container-low` dentro de la tarjeta del formulario |

**Nota sobre el contraste:** los botones primarios usan el gradiente `primary → primary-container`, y en web un gradiente es `background-image`, no `background-color`. Una auditoría que solo mira el color de fondo atraviesa el botón y encuentra el blanco de la tarjeta detrás: eso produjo tres falsos positivos de «1.00:1, blanco sobre blanco» en la primera pasada. Por eso el informe los declara **no medibles** en vez de inventar un número. Si alguna vez hace falta medirlos, hay que evaluar el gradiente como superficie propia.

**Actualización (T1 del rediseño):** el CTA ya no lleva degradado, sino teja plano `#B93D12` con texto blanco (5,62:1, §2), así que esas comprobaciones «no medibles» dejan de aplicar; se remiden cuando la auditoría vuelva a correr en CI.

### Lo que esta auditoría no mide

Nada de lo que depende de juicio: si la jerarquía convence, si el copy ayuda a decidir, si la pantalla se siente pesada. Eso es revisión de diseño, no detector, y no se automatiza con reglas.
