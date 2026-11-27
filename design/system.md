# Muro de Deseos — current design system ("The Digital Keepsake")

Snapshot of the tokens in use today, captured read-only. Sources: `app/global.css`, `tailwind.config.cjs`, `docs/DESIGN.md`.

> Note: the `rediseno-muro` directions intentionally replace this system (the owner asked for a full restyle). This file documents the baseline they are compared against.

## CSS custom properties (`app/global.css`, RGB triplets)

| Token | Value | Usage |
| --- | --- | --- |
| `--background` | `255 244 244` | App canvas |
| `--foreground` | `76 33 43` | Default text |
| `--primary` | `170 44 50` | Brand / CTAs / focus ring |
| `--primary-container` | `255 117 116` | CTA gradient end |
| `--surface` | `255 244 244` | Base surface |
| `--surface-container-low` | `255 236 238` | Section surface |
| `--surface-container-lowest` | `255 255 255` | Cards |
| `--on-surface` | `76 33 43` | Text on surfaces |
| `--outline-variant` | `220 156 168` | Ghost borders |

## Colors (`tailwind.config.cjs`)

| Token | Value | Usage |
| --- | --- | --- |
| `primary` | `#aa2c32` | Brand, high priority |
| `primary-container` | `#ff7574` | Gradient end, accent |
| `on-primary` | `#ffffff` | Text on primary |
| `surface` | `#fff4f4` | Canvas |
| `surface-container-low` | `#ffecee` | Sections |
| `surface-container-high` | `#fff0f0` | Raised sections |
| `surface-container-highest` | `#ecd8e0` | Input fill |
| `surface-container-lowest` | `#ffffff` | Cards |
| `priority-high` | `#aa2c32` | Priority chip |
| `priority-medium` | `#6d5a00` | Priority chip |
| `priority-low` | `#006666` | Priority chip |
| `price` | `#6d5a00` | Price chip |
| `success` / `reserved` | `#006666` | Success, reserved state |
| `role-badge` | `#6d5a00` | Admin badge |
| `on-surface` | `#4c212b` | Body text |
| `outline-variant` | `#dc9ca8` | Ghost border |

## Typography (`tailwind.config.cjs`)

| Token | Value | Usage |
| --- | --- | --- |
| `font-sans` | `Be Vietnam Pro 400` | Body |
| `font-sans-semibold` | `Be Vietnam Pro 600` | Labels |
| `font-display` | `Plus Jakarta Sans 700` | Headings |
| `font-display-extrabold` | `Plus Jakarta Sans 800` | Hero headings |

## Radius and shadow (`tailwind.config.cjs`)

| Token | Value | Usage |
| --- | --- | --- |
| `rounded` | `0.5rem` | Default |
| `rounded-md` | `0.75rem` | Cards |
| `shadow-ambient` | `0 12px 24px rgba(76,33,43,.04), 0 4px 8px rgba(76,33,43,.03)` | Cards |
| `shadow-ambient-lg` | `0 16px 32px rgba(76,33,43,.06), 0 8px 16px rgba(76,33,43,.04)` | Floating dock, modals |

## Component rules (`docs/DESIGN.md`)

- No 1px borders: depth through tonal layering and tinted ambient shadows.
- Glass navigation/modals: `surface` at 70–80 % with 20 px blur.
- Primary CTA: 135° gradient `primary → primary-container`, fully rounded.
- Chips and buttons fully rounded; generous spacing.
- Mobile: floating glass dock with 3 tabs (Deseos / Grupos / Perfil); desktop: header pill tabs; single breakpoint at 768 px.
