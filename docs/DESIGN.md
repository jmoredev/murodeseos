# Design System Document

## 1. Overview & Creative North Star: "The Digital Keepsake"
This design system moves away from the clinical, rigid grids of traditional social apps to embrace a philosophy of **The Digital Keepsake**. The goal is to make every "Wish" feel like a tangible, precious object pinned to a curated gallery.

We achieve a high-end editorial feel by leaning into **intentional asymmetry** and **tonal depth**. Instead of boxing content into strict rectangles, we use varied card heights and overlapping elements to create a rhythmic, organic flow. The experience should feel like flipping through a premium heavy-stock magazine—tactile, airy, and deeply personal.

---

## 2. Colors: Tonal Radiance
The palette is rooted in a warm, "pantry-chic" aesthetic—using soft blush and cream neutrals punctuated by a sophisticated "claret" primary accent.

### Color Tokens (Material Convention)
* **Primary (The Accent):** `#aa2c32` (A deep, sophisticated red used for high-intent actions).
* **Surface (The Canvas):** `#fff4f4` (A warm, breathable base).
* **Secondary (The Sun):** `#6d5a00` (Used for celebratory or high-energy highlights).
* **Tertiary (The Calm):** `#006666` (Used for grounding elements or alternative categories).

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section sitting on a `surface` background provides all the separation a user needs. We define space through mass, not lines.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the hierarchy below to "lift" content:
1. **Base:** `surface` (#fff4f4)
2. **Sectioning:** `surface-container-low` (#ffecee)
3. **Floating Cards:** `surface-container-lowest` (#ffffff)
4. **Interactive Overlays:** `surface-bright` (#fff4f4)
5. **Soft-filled fields (inputs):** `surface-container-highest` (#ecd8e0) — blush intermedio (más cuerpo que `#efe0e5`, más ligero que un malva) para leer bien sobre blanco y encajar con `surface` / `surface-container-low`.

### The "Glass & Gradient" Rule
To escape a "flat" feel, use Glassmorphism for floating navigation bars or modal headers. Apply `surface` at 70% opacity with a `20px` backdrop-blur.
* **Signature Texture:** Main CTAs should use a subtle linear gradient: `primary` (#aa2c32) to `primary-container` (#ff7574) at a 135-degree angle. This adds "soul" and a sense of light hitting the button.

---

## 3. Typography: Editorial Clarity
We pair two sans-serifs to balance personality with extreme legibility.

* **Display & Headlines (Plus Jakarta Sans):** Chosen for its modern, slightly wide stance. It feels friendly yet authoritative. Use `display-lg` (3.5rem) for hero moments with negative letter-spacing (-0.02em) to create a tight, editorial impact.
* **Body & Titles (Be Vietnam Pro):** A highly functional typeface that remains legible at small scales. Its neutral tone allows the "Wish" content to be the star without visual noise.

**Escala en uso:** `text-xs` está reservado para etiquetas cortas en mayúsculas, chips e insignias; nunca como cuerpo de lectura. En React Native el peso va **en el nombre de la familia** (`font-sans-semibold`, `font-sans-bold`), no en una clase de peso: el runtime no sintetiza pesos.

**Hierarchy Note:** Always lead with high contrast. A `display-md` headline should be followed by a `body-md` description with significant breathing room (using `spacing-6`) to ensure the layout feels "designed" rather than "populated."

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often messy. This system uses **Ambient Light Physics**.

* **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` card placed on a `surface-container-low` background creates a natural lift.
* **Ambient Shadows:** When a float is required (e.g., a "Post a Wish" FAB), use a shadow with a `24px` blur and `4%` opacity. The shadow color must be tinted: use `on-surface` (#4c212b) instead of pure black to maintain the warmth of the palette.
* **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline-variant` (#dc9ca8) at **15% opacity**. Never use 100% opaque outlines.
* **Glassmorphism:** Use semi-transparent surfaces for "wish details" overlays to let the vibrant colors of the Wall bleed through, creating an integrated, frosted-glass effect.

---

## 5. Components

### Buttons
* **Primary:** Gradient fill (`primary` to `primary-container`), `full` roundedness, `body-lg` bold text in `on-primary`.
* **Secondary:** `surface-container-high` background with `primary` text. No border.
* **Tertiary:** Ghost style. No background, `primary` text.

### Wish Cards
* **Rule:** Forbid divider lines.
* **Style:** Use `surface-container-lowest` (#ffffff) with a `DEFAULT` (0.5rem/8px) or `md` (0.75rem/12px) corner radius.
* **Layout:** Use vertical white space (`spacing-4`) to separate the "Wisher's Name" from the "Wish Body."

### Input Fields
* **Style:** Soft-filled. Use `surface-container-highest` (#ecd8e0) background on any parent (incluido `surface-container-lowest` en tarjetas).
* **Focus State:** Shift background to `surface-container-lowest` and add a `2px` "Ghost Border" of `primary` at 20% opacity.

### Navigation (The Floating Dock)
* **Style:** A centered, floating pill using Glassmorphism. `surface` at 80% opacity, `xl` corner radius, and a soft ambient shadow. Icons should be `outlined` with a `2px` stroke weight.

---

## 6. Do's and Don'ts

### Do
* **Do** use asymmetrical margins. For example, give a headline more top-padding than bottom-padding to create a "pushed" editorial look.
* **Do** use the semantic colour tokens for their one meaning — `price`, `success`, `priority-high|medium|low`, `role-badge`, `reserved`, `accent-warm|cool`. They replaced `secondary`/`tertiary`, which each carried several meanings at once (priority, price, success, badges, decorative tint) so a chip's colour did not tell you what it meant. Several share a hex on purpose; the name carries the meaning, and each can be recoloured on its own.
* **Do** leverage the `full` roundedness for interactive elements like Chips and Buttons to emphasize the "friendly" prompt.

### Don't
* **Don't** use 1px dividers to separate list items. Use a `0.35rem` (spacing-1) height gap or a subtle background tint change.
* **Don't** use pure black (#000000) for text. Always use `on-background` (#4c212b) to keep the "warm pastel" vibe intact.
* **Don't** cram content. If a screen feels full, increase the `spacing` tokens. Luxury is defined by the space you don't use.
---

## 7. Cómo se comprueba (medido en el navegador, 2026-10-21)

El resto del documento es la **dirección** del sistema. Esta sección es lo **medido** sobre el navegador real, para no confundir intención con resultado. La herramienta es `e2e/audit-ui.spec.ts` y se corre con:

```bash
node_modules/.bin/playwright test e2e/audit-ui.spec.ts --project=chromium
```

Escribe `test-results/audit-ui.md` y no falla por lo que encuentra: mide. Recorre deseos, formulario, grupos y perfil con el usuario E2E ya autenticado.

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

### Lo que esta auditoría no mide

Nada de lo que depende de juicio: si la jerarquía convence, si el copy ayuda a decidir, si la pantalla se siente pesada. Eso es revisión de diseño, no detector, y no se automatiza con reglas.
