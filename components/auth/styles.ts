/**
 * Piezas de estilo compartidas por las pantallas de acceso
 * (`design/rediseno-muro/11-acceso.html` y `sistema-nuevo.md`).
 *
 * Los valores salen de los tokens de `tailwind.config.cjs`; aquí sólo se
 * agrupan para que las cuatro pantallas midan igual.
 */

/** Campo: alto `--field-h` 56 px (§6), radio `--r-sm` 14 px (§4) y contorno de control 2 px. */
export const FIELD_BASE =
    'h-14 w-full rounded-[14px] border-2 bg-surface-container-lowest px-3.5 text-[17px] font-sans text-ink';

/** Contorno `--border-control` (#B67A50), el de todo control (§12.2). */
export const FIELD_IDLE = 'border-border-control';

/** Campo inválido: fondo y contorno de error (`11 · .ac-input[aria-invalid="true"]`). */
export const FIELD_INVALID = 'border-danger-line bg-danger-soft';

/** Campo atenuado mientras se envía (`11 · .ac-input-off`): sigue mostrando lo escrito. */
export const FIELD_OFF = 'border-border bg-sand-2 text-ink-2';

/** Etiqueta del campo: `--text-body` 17 px, peso 800, pegada al campo. */
export const LABEL = 'mb-1.5 text-[17px] font-sans-bold leading-[1.25] text-ink';

/** Título de pantalla: `--text-page` 30 px (§2.1), 800, interletrado de título. */
export const SCREEN_TITLE = 'text-[29px] font-display-extrabold leading-[1.14] tracking-[-0.02em] text-ink';

/** Subtítulo de pantalla: 17 px, `--ink-2`. */
export const SCREEN_SUBTITLE = 'mt-2 text-[17px] font-sans leading-[1.4] text-ink-2';

/** Enlace de acción (`.link-btn`): 16 px, 700, subrayado, 48 px de alto. */
export const LINK_BUTTON =
    'min-h-[48px] items-center justify-center rounded-[14px] px-3 py-2 active:opacity-70';

export const LINK_BUTTON_TEXT =
    'text-[16px] font-sans-bold text-primary-dark underline';

/**
 * Color del placeholder. `TextInput` no acepta clases para él, así que va como
 * prop: es `--ink-2` (#5C4033), el mismo valor que usan los demás formularios
 * del repo (`signup`, `wishlist/add`, `DateField`).
 */
export const PLACEHOLDER_INK = '#5C4033';
