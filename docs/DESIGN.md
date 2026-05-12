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

### The "Glass & Gradient" Rule
To escape a "flat" feel, use Glassmorphism for floating navigation bars or modal headers. Apply `surface` at 70% opacity with a `20px` backdrop-blur.
* **Signature Texture:** Main CTAs should use a subtle linear gradient: `primary` (#aa2c32) to `primary-container` (#ff7574) at a 135-degree angle. This adds "soul" and a sense of light hitting the button.

---

## 3. Typography: Editorial Clarity
We pair two sans-serifs to balance personality with extreme legibility.

* **Display & Headlines (Plus Jakarta Sans):** Chosen for its modern, slightly wide stance. It feels friendly yet authoritative. Use `display-lg` (3.5rem) for hero moments with negative letter-spacing (-0.02em) to create a tight, editorial impact.
* **Body & Titles (Be Vietnam Pro):** A highly functional typeface that remains legible at small scales. Its neutral tone allows the "Wish" content to be the star without visual noise.

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
* **Style:** Soft-filled. Use `surface-container-highest` background.
* **Focus State:** Shift background to `surface-container-lowest` and add a `2px` "Ghost Border" of `primary` at 20% opacity.

### Navigation (The Floating Dock)
* **Style:** A centered, floating pill using Glassmorphism. `surface` at 80% opacity, `xl` corner radius, and a soft ambient shadow. Icons should be `outlined` with a `2px` stroke weight.

---

## 6. Do's and Don'ts

### Do
* **Do** use asymmetrical margins. For example, give a headline more top-padding than bottom-padding to create a "pushed" editorial look.
* **Do** use the `secondary` (#6d5a00) and `tertiary` (#006666) colors for categorization tags (e.g., "Travel," "Growth").
* **Do** leverage the `full` roundedness for interactive elements like Chips and Buttons to emphasize the "friendly" prompt.

### Don't
* **Don't** use 1px dividers to separate list items. Use a `0.35rem` (spacing-1) height gap or a subtle background tint change.
* **Don't** use pure black (#000000) for text. Always use `on-background` (#4c212b) to keep the "warm pastel" vibe intact.
* **Don't** cram content. If a screen feels full, increase the `spacing` tokens. Luxury is defined by the space you don't use.