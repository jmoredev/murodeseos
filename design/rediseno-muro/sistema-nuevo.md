# Sistema de diseño nuevo — «Personas primero»

Especificación de implementación del sistema visual que sustituye al actual. Se extrae de las
maquetas ya dibujadas de la dirección elegida (S2): **02-personas-primero**, **04-ficha-grupo**,
**05-mi-lista**, **06-formulario-deseo**, **07-personas**, **08-detalle-deseo**, **09-avisos**,
**10-perfil**, **11-acceso** — todas en `design/rediseno-muro/`.

- **La app usará una tipografía redondeada: Nunito.** Las maquetas están dibujadas con fuentes del
  sistema; por eso aquí se propone la escala definitiva sobre Nunito (ver «Tipografía») y se fija
  el mismo tamaño, peso y altura de línea que ya usan las maquetas, de modo que el cambio de fuente
  no altera la composición.
- **`design/system.md` no se toca**: es la foto del sistema actual (rosa «Digital Keepsake»). La
  comparación está en «Diferencias con el sistema actual».
- Cada valor de esta ficha cita el artboard donde se usa. Si un valor aparece sólo como derivado
  (un color que no llega a token), está en «Inconsistencias detectadas» con su valor canónico.

Convención de citas: `NN-artboard.html · .clase`.

---

## 1. Color

32 tokens en cinco grupos. Todos los pares que se declaran aptos superan **WCAG AA**: 4,5:1 para
texto normal y 3:1 para texto grande, iconos y contornos de control. Los ratios están calculados
sobre los valores de esta tabla, no copiados de las maquetas.

### 1.1 Base (superficies y tinta)

| Token | Valor | Uso | Contraste | Artboard |
| --- | --- | --- | --- | --- |
| `--bg` | `#FFF8F1` | lienzo de la app y de las tarjetas hundidas (nota del deseo) | — | 02 · `body`, 05 · `.w-note` |
| `--surface` | `#FFFFFF` | tarjetas, campos, hojas, barras | — | 02 · `.wish`, 11 · `.ac-input` |
| `--surface-sunken` | `#FFFCF8` | fila leída, tarjeta de «Recibidos» | `--ink-2` 9,18:1 | 05 · `.ml-rec`, 09 · `.av-item-read` |
| `--ink` | `#2B1A12` | texto principal, iconos, fondo del toast | sobre `--bg` 15,84:1 · sobre `--surface` 16,68:1 · sobre `--primary-soft` 13,78:1 | todos |
| `--ink-2` | `#5C4033` | texto secundario, metadatos, placeholders | sobre `--bg` 8,92:1 · sobre `--surface` 9,39:1 · sobre `--primary-soft` 7,76:1 | todos |
| `--muted` | `#8A7A70` | **sólo decoración y deshabilitado**: corazones vacíos, icono apagado. Nunca texto legible | sobre `--bg` 3,91:1 *(no apto para texto)* | 02 · `.tile-off`, `.hearts .off` |
| `--border` | `#F0DFD2` | separador de 1 px entre filas, contorno de tarjeta estática | — (decorativo) | 02 · `.p-card`, 07 · `.psn-people > li + li` |
| `--border-strong` | `#E3C8B6` | contorno de 1,5 px de filas, chips y tiles; **no** de controles | sobre `--surface` 1,59:1 (decorativo) | todos |
| `--border-control` | `#B67A50` | contorno de 2 px de **todo control**: campo, selector, buscador, tarjeta de opción, interruptor | sobre `--surface` 3,57:1 · sobre `--bg` 3,39:1 | propuesto; valor ya presente en 02 (ilustración). En las maquetas los campos usan `--border-strong` (ver §12) |
| `--sand` | `#FBEBDC` | etiqueta de grupo, tile de grupo, nota de sugerencia, aviso cálido | — | 02 · `.step-c`, 07 · `.psn-gtag` |
| `--sand-2` | `#F6EBE2` | tile neutro («Otro regalo»), pista del interruptor, control deshabilitado | `--ink-2` 8,00:1 | 02 · `.tile-n`, 05 · `.tile-n` |
| `--sand-ink` | `#7A4A2A` | texto e icono sobre `--sand` y `--sand-2` | sobre `--sand` 6,34:1 | todos |
| `--unread` | `#FFF6EC` | fondo del aviso no leído | `--ink` 15,60:1 | 09 · `.av-item-unread` |

### 1.2 Teja (primario)

| Token | Valor | Uso | Contraste | Artboard |
| --- | --- | --- | --- | --- |
| `--primary` | `#B93D12` | acción principal, corazón lleno, bandera de no leído, contorno de lo elegido | blanco encima 5,62:1 · sobre `--primary-soft` 4,64:1 · sobre `--selected` 5,15:1 | 02 · `.btn-primary`, 09 · `.av-unread-flag` |
| `--primary-dark` | `#8F2E0C` | texto de acción sobre fondo claro, anillo de foco, hover del primario | sobre `--surface` 8,19:1 · sobre `--bg` 7,78:1 · sobre `--primary-soft` 6,77:1 | 02 · `.eyebrow`, 11 · `:focus-visible` |
| `--primary-soft` | `#FDE5D6` | panel de celebración, fondo del tile familia A, píldora de pestaña activa | `--ink` 13,78:1 · `--primary-dark` 6,77:1 | 02 · `.hero`, `.nav-i[aria-current]` |
| `--primary-line` | `#F3CDB6` | contorno de 1,5 px de paneles y avisos sobre `--primary-soft` | decorativo | 02 · `.hero-dt`, 09 · `.av-perm` |
| `--primary-line-strong` | `#EEC4A8` | contorno de 2 px del botón suave | decorativo | 02 · `.btn-soft` |
| `--hover-row` | `#FFF1E5` | hover de fila completa (persona, grupo, pestaña de escritorio) | — | 02 · `.g-link:hover`, `.nav-i:hover` |
| `--hover-control` | `#FFF3E9` | hover de botón secundario, chip y fila de tamaño | — | 02 · `.btn-secondary:hover`, `.cat-chip:hover` |
| `--selected` | `#FFF3EB` | fondo de lo elegido: casilla marcada, tarjeta de prioridad, chip pulsado | `--primary-dark` 5,15:1 | 02 · `.g-opt:has(input:checked)`, 06 · `.fd-prio-card:has(input:checked)` |
| `--active-soft` | `#FBD9C4` | hover del botón suave y del botón de ajustes del grupo | — | 02 · `.btn-soft:hover`, 09 · `.av-set:hover` |

### 1.3 Verde (acento y éxito)

| Token | Valor | Uso | Contraste | Artboard |
| --- | --- | --- | --- | --- |
| `--accent` | `#2F6F4E` | icono de éxito, interruptor encendido, tile familia B | sobre `--surface` 5,99:1 · sobre `--accent-soft` 5,08:1 | 02 · `.tile-b`, 04 · `.gx-trk` |
| `--accent-soft` | `#E1F0E7` | fondo de éxito, ayuda verde, tile familia B, etiqueta «nuevo» | `--accent-ink` 8,54:1 | 02 · `.helper`, 09 · `.av-new` |
| `--accent-ink` | `#1F4A33` | texto sobre `--accent-soft` | sobre `--accent-soft` 8,54:1 · sobre `--surface` 10,07:1 | 02 · `.state-mine`, 10 · `.pr-banner` |
| `--accent-line` | `#B4D5C3` | contorno de 1,5 px de lo correcto y de la tarjeta con deseo recibido | decorativo | 04 · `.gx-sw[aria-checked]`, 08 · `.dd-state-mine` |

### 1.4 Estado

| Token | Valor | Uso | Contraste | Artboard |
| --- | --- | --- | --- | --- |
| `--danger` | `#B42318` | error, acción destructiva, contorno de campo inválido | sobre `--surface` 6,57:1 · sobre `--danger-soft` 5,75:1 | 04 · `.gx-srow-danger`, 11 · `.ac-alert` |
| `--danger-dark` | `#7A1A12` | texto del error y de la confirmación destructiva | sobre `--danger-soft` 9,26:1 | 11 · `.ac-alert-t`, 10 · `.pr-err` |
| `--danger-soft` | `#FDECEA` | fondo del aviso de error y del campo inválido | `--danger-dark` 9,26:1 | 11 · `.ac-alert`, 09 · `.av-perm-warn` |
| `--danger-line` | `#EFC9C5` | contorno de 2 px del aviso de error | decorativo | 04 · `.gx-srow-danger`, 10 · `.pr-banner-err` |

### 1.5 Sobre tinta (toast y superficies oscuras)

| Token | Valor | Uso | Contraste | Artboard |
| --- | --- | --- | --- | --- |
| `--on-ink` | `#FFF3E8` | texto del toast sobre `--ink` | sobre `--ink` 15,28:1 | 05 · `.ml-toast`, `.ml-toast-txt` |
| `--on-ink-accent` | `#FFE9DA` | acción «Deshacer» y anillo de foco dentro del toast | sobre `--ink` 14,23:1 | 05 · `.ml-undo` |

### 1.6 Píxeles de presentación (no son tokens de la app)

Estos colores sólo existen para dibujar el marco del móvil, la ventana del navegador y la cabecera
de la maqueta. **No se implementan.**

| Valor | Dónde | Para qué |
| --- | --- | --- |
| `#241610`, `#4B332A` | 02–11 · `.pf` | marco y bisel del móvil de 390 px |
| `#F6E8DC`, `#D9B79E`, `#7A5B45` | 02–11 · `.chrome`, `.dots`, `.chrome-right` | barra del navegador y su texto |
| `#1F3A5F` | 10 · `.pr-swatch` | muestra del selector de color del perfil |

### 1.7 Pares de contraste verificados

Todo par que se usa para texto o para el contorno de un control, con el mínimo exigido.

| Par | Ratio | Exigencia | Resultado |
| --- | --- | --- | --- |
| `--ink` sobre `--bg` | 15,84:1 | texto 4,5:1 | AA |
| `--ink` sobre `--surface` | 16,68:1 | texto 4,5:1 | AA |
| `--ink-2` sobre `--surface` | 9,39:1 | texto 4,5:1 | AA |
| `--ink-2` sobre `--bg` | 8,92:1 | texto 4,5:1 | AA |
| `--ink-2` sobre `--sand-2` | 8,00:1 | texto 4,5:1 | AA |
| `--ink-2` sobre `--surface-sunken` | 9,18:1 | texto 4,5:1 | AA |
| blanco sobre `--primary` | 5,62:1 | texto 4,5:1 | AA |
| `--primary-dark` sobre `--primary-soft` | 6,77:1 | texto 4,5:1 | AA |
| `--primary-dark` sobre `--selected` | 5,15:1 | texto 4,5:1 | AA |
| `--primary-dark` sobre `--surface` | 8,19:1 | texto 4,5:1 | AA |
| `--accent` sobre `--surface` | 5,99:1 | texto 4,5:1 | AA |
| `--accent` sobre `--accent-soft` | 5,08:1 | texto 4,5:1 | AA |
| `--accent-ink` sobre `--accent-soft` | 8,54:1 | texto 4,5:1 | AA |
| `--sand-ink` sobre `--sand` | 6,34:1 | texto 4,5:1 | AA |
| `--danger` sobre `--surface` | 6,57:1 | texto 4,5:1 | AA |
| `--danger-dark` sobre `--danger-soft` | 9,26:1 | texto 4,5:1 | AA |
| `--on-ink` sobre `--ink` | 15,28:1 | texto 4,5:1 | AA |
| `--on-ink-accent` sobre `--ink` | 14,23:1 | texto 4,5:1 | AA |
| `--border-control` sobre `--surface` | 3,57:1 | contorno 3:1 | AA |
| `--border-control` sobre `--bg` | 3,39:1 | contorno 3:1 | AA |
| `--primary` sobre `--selected` (borde de lo elegido) | 5,15:1 | contorno 3:1 | AA |
| `--danger` sobre `--danger-soft` (borde inválido) | 5,75:1 | contorno 3:1 | AA |
| anillo de foco `--primary-dark` sobre `--bg` | 7,78:1 | foco 3:1 | AA |
| anillo de foco `--primary-dark` sobre `--primary-soft` | 6,77:1 | foco 3:1 | AA |
| anillo de foco `--on-ink-accent` sobre `--ink` | 14,23:1 | foco 3:1 | AA |

**No aptos, y por eso restringidos:** `--muted` (#8A7A70, 3,91:1 sobre `--bg`) y `--border` /
`--border-strong` (1,30:1 y 1,59:1 sobre blanco). Se usan sólo como decoración, nunca como texto ni
como contorno de un control.

---

## 2. Tipografía

**Familia (app):** `Nunito` — redondeada, de contraformas abiertas, con 200–1000 de peso y buen
rendimiento en cuerpos pequeños; encaja con el objetivo «fácil de usar para todo tipo de edades».

```css
--font-app: "Nunito", "Nunito Sans", ui-rounded, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--font-mono: ui-monospace, "Cascadia Mono", Consolas, monospace; /* códigos de invitación, cifras tabulares */
```

**Familia (maquetas, y fallback real si Nunito no ha cargado):**

```css
--font-mock: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

Los nueve artboards declaran exactamente `--font-mock` (02 · `:root`), así que la escala de abajo es
la que hay que respetar al cambiar de fuente: **no se cambia ningún tamaño al pasar a Nunito.**

### 2.1 Escala

Cuerpo base **17 px** (la medida que usan 216 declaraciones de las nueve maquetas y que fija la
dirección: «cuerpo de 17 px», 02 · `.keys`). Nunito a 17 px rinde como el sistema a 17 px, así que
la escala se mantiene y sólo se normalizan los medios pasos (§12).

| Token | Tamaño | Altura de línea | Peso | Uso | Artboard |
| --- | --- | --- | --- | --- | --- |
| `--text-badge` | 13 px | 1,45 | 800 | bandera de no leído, contador de pestaña | 02 · `.nav-badge` (12,5), `.dt-badge` (13); 09 · `.av-unread-flag` (13,5) |
| `--text-tab` | 14 px | 1,1 | 600 / 800 activo | etiqueta de pestaña inferior | 02 · `.nav-i` |
| `--text-meta` | 15 px | 1,3 | 600 | metadatos densos: fecha, «nuevo», grupo | 09 · `.av-meta` (15), `.av-celeb-d` (15,5); 07 · `.psn-gtag-e` |
| `--text-small` | 16 px | 1,35 | 600 | secundario dentro de una tarjeta, ayudas, categoría | 02 · `.w-cat`, `.g-meta`; 11 · `.ac-hint` |
| `--text-body` | 17 px | 1,4 · 1,5 en párrafo | 600 | cuerpo, etiquetas, botones, campos | 02 · `.btn`, `.alta-input`; 08 · `.dd-sheet-sub` |
| `--text-row` | 18 px | 1,25 | 800 | título de fila y de deseo | 02 · `.w-title`; 07 · `.psn-name`, `.psn-gname` |
| `--text-sub` | 20 px | 1,2 | 800 | subtítulo de bloque | 08 · `.dd-blk` (19); 06 · `.fd-prev-h`; 09 · `.av-blk` |
| `--text-sheet` | 22 px | 1,2 | 800 | título de hoja inferior | 10 · `.pr-sheet-h`; 07 · `.psn-sheet-h`; 08 · `.dd-sheet-h` (23) |
| `--text-section` | 24 px | 1,2 | 800 | título de sección | 02 · `.blk`, `.dt-h`; 07 · `.psn-blk`; 10 · `.pr-blk` |
| `--text-screen` | 26 px | 1,15 | 800 | cabecera de pantalla, nombre en la ficha | 02 · `.person-head h2`, `.sheet-head h3`; 04 · `.gx-name` (27) |
| `--text-page` | 30 px | 1,1 | 800 | título de página | 07 · `.psn-head`; 04 · `.gx-dname`; 08 · `.dd-dtitle`; 09 · `.av-title` (29); 10 · `.pr-h` (29); 11 · `.ac-h` (29) |

Fuera de escala, y correcto así: el `h1` de la cabecera de cada artboard (40 px, 02 · `.strip h1`)
es presentación, no pantalla; el glifo del avatar se dimensiona por el avatar (§9.6), no por la escala.

### 2.2 Pesos e interletrado

| Token | Valor | Uso | Artboard |
| --- | --- | --- | --- |
| `--weight-body` | 600 | cuerpo, etiquetas de campo, textos de control | 02–11 (97 declaraciones) |
| `--weight-label` | 700 | botones, chips, títulos de fila pequeños | 02 · `.btn`, `.g-name` |
| `--weight-title` | 800 | títulos, énfasis, cifras | 02 · `.blk` (402 declaraciones) |

| Token | Valor | Uso |
| --- | --- | --- |
| `--track-title` | -0,02em | títulos de 26–30 px (02 · `.welcome-title`, 07 · `.psn-head`) |
| `--track-section` | -0,015em | títulos de 20–24 px (02 · `.blk`, 04 · `.gx-blk`) |
| `--track-row` | -0,01em | 18–19 px y etiquetas de bloque (09 · `.av-day-h`) |
| `--track-code` | 0,08em | códigos de invitación en `--font-mono` (02 · `.code`) |

Nunca hay texto por debajo de 13 px ni cursivas. El peso 500 aparece una vez (11 · `.ac-alert-d`) y
se normaliza a 600 (§12).

---

## 3. Espaciado

Base de 4 px con medios pasos de 2 px, que es la densidad real de las maquetas móviles (separaciones
internas de 10, 14 y 18 px). 14 tokens.

| Token | Valor | Uso típico | Artboard |
| --- | --- | --- | --- |
| `--sp-0` | 2 px | separación entre icono y su etiqueta en píldoras | 02 · `.pill` |
| `--sp-1` | 4 px | hueco entre líneas de una fila densa | 02 · `.groups`, 09 · `.av-list` (6 → 4) |
| `--sp-2` | 6 px | hueco de lista muy densa (avisos, celebraciones) | 09 · `.av-celebs` |
| `--sp-3` | 8 px | hueco entre botones apilados, entre icono y texto | 02 · `.btn` (gap), `.welcome-cta` |
| `--sp-4` | 10 px | hueco entre filas de tarjeta, entre avatar y texto | 02 · `.wishes`, 07 · `.psn-actions` |
| `--sp-5` | 12 px | relleno de tarjeta de deseo; hueco entre filas de lista | 02 · `.wish` (padding), `.psn-search` |
| `--sp-6` | 14 px | relleno de fila y de campo compacto; separación del toast | 02 · `.celebs li`, 11 · `.ac-input` |
| `--sp-7` | 16 px | margen lateral del móvil y relleno de pantalla | 02 · `.pf-scroll`, `.fd-bar` |
| `--sp-8` | 18 px | relleno de tarjeta de escritorio | 02 · `.dt-card`, 08 · `.dd-dcard` |
| `--sp-9` | 20 px | relleno de hoja inferior y de diálogo en móvil | 02 · `.sheet`, 10 · `.pr-sheet` |
| `--sp-10` | 24 px | separación entre bloques de sección | 02 · `.cat-how` (padding 22/24), 06 · `.fd-dialog` (padding) |
| `--sp-11` | 28 px | respiro inferior de la hoja y de la barra de guardado | 10 · `.pr-save` (28), 02 · `.sheet` (34 → 28) |
| `--sp-12` | 32 px | margen del encabezado de escritorio | 02 · `.dt-head` (padding 0 32) |
| `--sp-13` | 40 px | separación entre dispositivos y columnas del artboard | 02 · `.cat-row` (gap 40) |

**Reglas de composición**

- **Móvil 390 px:** 16 px laterales (02 · `.pf-scroll`), 20 px dentro de hojas (02 · `.sheet`) y 28 px
  de respiro inferior cuando hay gesto del sistema (10 · `.pr-save`).
- **Escritorio:** contenido centrado en 1200 px dentro de la ventana de 1280 (02 · `.dt-main`,
  `.dt-head`); ficha de dos columnas `1fr 340px` con 24 px de hueco (08 · `.dd-dmain`).
- **Tablet:** pendiente de T7; hasta entonces se aplica el corte único de 768 px con la columna del
  móvil centrada y ancho máximo de lectura de 640 px.
- Espacio mínimo entre dos objetivos táctiles: 8 px (`--sp-3`).

---

## 4. Radios

| Token | Valor | Uso | Artboard |
| --- | --- | --- | --- |
| `--r-pill` | 999px | botones, chips, píldoras, pestañas de escritorio, etiquetas | 02 · `.btn`, `.pill`, `.dt-nav a` |
| `--r-sheet` | 28px (sólo esquinas superiores) | hoja inferior | 02 · `.sheet`, 04 · `.gx-sheet`, 08 · `.dd-sheet`, 10 · `.pr-sheet` |
| `--r-dialog` | 24px | diálogo centrado de escritorio | 06 · `.fd-dialog` |
| `--r-card` | 20px | **tarjeta**: deseo, persona, grupo, sección, estado | 02 · `.wish`, `.p-card`; 06 · `.fd-state-card` |
| `--r-lg` | 18px | fila de opciones, fila de ajustes, recuadro de pasos | 02 · `.step`, `.g-opt`; 10 · `.pr-row` |
| `--r-md` | 16px | chip grande, aviso, toast, panel de celebración | 02 · `.celebs li`, 05 · `.ml-toast`, 11 · `.ac-alert` |
| `--r-sm` | 14px | control: campo, selector, tile de fila, botón de texto | 02 · `.alta-input`, `.g-link`; 11 · `.ac-input` |
| `--r-xs` | 12px | tile pequeña de 40 px, botón «Mostrar», acción del toast | 02 · `.cat-pick .cat-t`, `.alta-show`; 05 · `.ml-undo` |
| `--r-badge` | 9px | bandera cuadrada de tipo de aviso | 09 · `.av-kind` |

**Regla del tile** (cuadrado con icono o emoji): radio = lado / 4, redondeado al token más cercano.
40 px → `--r-xs` 12; 48 px → 12; 56 px → `--r-sm` 14; 64 px → `--r-md` 16; 72–80 px → `--r-card` 20.
(02 · `.cat-t` 56 px con radio 16 y `.cat-pick .cat-t` 40 px con radio 12).

Los avatares son círculos perfectos (50 %) y nunca llevan tile.

---

## 5. Sombras

Nueve sombras y un anillo. Ninguna sombra lleva color frío: todas son `rgba(43,26,18,…)` (la tinta) salvo las tres
cálidas del primario, que existen para que la tarjeta de celebración y el botón principal «brillen»
sin borde.

| Token | Valor | Uso | Artboard |
| --- | --- | --- | --- |
| `--sh-1` | `0 2px 8px rgba(43,26,18,.05)` | tarjeta en reposo, píldora, avatar grande | 02 · `.wish`, `.pill-days` |
| `--sh-2` | `0 10px 28px rgba(43,26,18,.08)` | tarjeta elevada de escritorio | 02 · `.alta-card` |
| `--sh-cta` | `0 8px 18px rgba(185,61,18,.22)` | botón primario | 02 · `.btn-primary` |
| `--sh-glow` | `0 12px 30px rgba(185,61,18,.10)` | panel de celebración y vista previa de la alta | 02 · `.hero-dt`, `.alta-panel` |
| `--sh-toast` | `0 14px 30px rgba(43,26,18,.30)` | toast | 05 · `.ml-toast` |
| `--sh-sheet` | `0 -10px 30px rgba(43,26,18,.22)` | hoja inferior (sombra hacia arriba) | 02 · `.sheet`, 08 · `.dd-sheet` |
| `--sh-dialog` | `0 30px 70px rgba(43,26,18,.34)` | diálogo centrado | 06 · `.fd-dialog` |
| `--sh-bar` | `0 -6px 18px rgba(43,26,18,.06)` | barra de acción fija del móvil | 06 · `.fd-bar` |
| `--sh-danger` | `0 8px 18px rgba(180,35,24,.22)` | botón de peligro | 10 · `.btn-danger` |
| `--ring-selected` | `0 0 0 3px var(--primary-soft)` | anillo de lo elegido en tarjeta de opción, radio y casilla (no es sombra: no se mezcla con `--sh-1`) | 02 · `.alta-face:has(input:checked)`, 06 · `.fd-prio-card:has(input:checked)` |

**Reglas**

- Una tarjeta en reposo lleva **una** sombra (`--sh-1`) y un contorno de 1 px `--border`. Nunca las dos
  sombras ambientales del sistema anterior.
- El desenfoque de fondo (`backdrop-filter`) y el cristal quedan fuera: todas las superficies son
  opacas; la única transparencia permitida es `rgba(255,248,241,.97)` en la barra de pestañas
  (02 · `.pf-nav`) para no cortar el contenido al hacer scroll.
- Los estados de foco no usan sombra: usan anillo (§7).

---

## 6. Tamaños y objetivos táctiles

| Token | Valor | Uso | Artboard |
| --- | --- | --- | --- |
| `--touch` | 48px | **mínimo de cualquier control**: botón, pestaña, icono pulsable, «Mostrar», «Deshacer», cerrar | 02 · `.btn`, `.nav-i`, `.x-btn`; 05 · `.ml-undo` |
| `--touch-inline` | 32px | enlace de tienda **en línea** dentro de un párrafo (sólo escritorio; ≥ 24 px de WCAG 2.2) | 02 · `.dw-link` |
| `--field-h` | 56px | alto de campo, selector, buscador | 02 · `.alta-input`, 07 · `.psn-search-in` |
| `--cta-h` | 52px | botón principal de una barra de acción fija | 06 · `.fd-bar .btn`, 08 · `.dd-bar .btn` |
| `--tabbar-h` | 72px | barra de pestañas inferior (incluye el gesto del sistema) | 02 · `.pf-nav` |
| `--icon` | 24px | icono de acción por defecto | 02 · `.ic` |
| `--icon-sm` | 20px | icono dentro de botón o píldora | 02 · `.link-btn .ic` |
| `--icon-tab` | 23px | icono de pestaña inferior | 02 · `.nav-i .ic` |

- Separación mínima entre dos controles: 8 px.
- Ningún control baja de 48×48 px en el móvil. El «Mostrar» de un campo ocupa 48 de alto dentro del
  campo de 56 (11 · `.ac-show`).
- El icono de tienda junto a un título no es un control de 48: es un enlace en línea de 32 px con
  área pulsable ampliada por el padding del título (02 · `.dw-link`).

---

## 7. Foco

```css
:focus-visible {
  outline: 3px solid var(--primary-dark);  /* #8F2E0C */
  outline-offset: 3px;
  border-radius: 8px;
}
```

- Un solo estilo de foco en toda la app (02 · `:focus-visible`, replicado igual en 04–11).
- En campos y controles de radio el `border-radius` del anillo sube a `--r-sm` (14 px) para seguir la
  forma del control (02 · `.alta-input:focus-visible`, 11 · `.ac-input:focus-visible`).
- Sobre `--primary-soft` el anillo sigue siendo `--primary-dark` (6,77:1).
- Dentro del toast y sobre cualquier superficie oscura el anillo cambia a `--on-ink-accent`
  (05 · `.ml-toast :focus-visible`). En la franja de presentación, a `#FDE5D6` (02 · `.strip :focus-visible`);
  ese último no es token de la app.
- Los controles nativos con `opacity:0` (radio y casilla dentro de una tarjeta) no pintan su anillo:
  el anillo lo pinta la tarjeta con `:has(input:focus-visible)`, con el mismo estilo
  (02 · `.g-opt:has(input:focus-visible)`, 06 · `.fd-prio-card:has(input:focus-visible)`).
- El foco **no** se mueve con la sombra ni con cambios sólo de color: siempre hay anillo visible.

---

## 8. Movimiento

| Token | Valor | Uso | Artboard |
| --- | --- | --- | --- |
| `--dur-state` | .16s | transición de color de fondo, borde y texto en hover, foco y selección | 02 · `.btn`, `.nav-i`, `.g-link` |
| `--ease-state` | ease | curva de todas las transiciones de estado | 02–11 |
| `--dur-spin` | .9s linear, infinita | giro de la rueda de carga | 06 · `.fd-spin`, 11 · `.ac-spin` |

- No hay desplazamientos, escalados ni entradas animadas: sólo color, borde y el giro de la rueda.
  Las hojas y los diálogos aparecen en su posición final (02 · `.sheet`, 06 · `.fd-dialog`).
- El interruptor sí se desplaza 22 px con `transform .16s ease` (04 · `.gx-knb`).

**Movimiento reducido** (idéntico en los nueve artboards):

```css
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
}
```

Con movimiento reducido la rueda de carga deja de girar y se queda en su sitio (06 · `.fd-spin`), y
el interruptor salta a su posición sin transición.

---

## 9. Iconos de categoría

Deseos con **icono de categoría, nunca foto** (S3). Trazo de 1,8 px, `viewBox 0 0 24 24`,
`stroke: currentColor`, un solo color por icono: el de su familia.

### 9.1 Las 12 categorías y sus 4 familias

| Categoría | Icono (`#i-…`) | Familia | Fondo | Trazo | Contraste del trazo |
| --- | --- | --- | --- | --- | --- |
| Tecnología | `headphones` | A · teja | `--primary-soft` | `--primary-dark` | 6,77:1 |
| Música y entradas | `ticket` | A · teja | `--primary-soft` | `--primary-dark` | 6,77:1 |
| Experiencias y talleres | `vase` | A · teja | `--primary-soft` | `--primary-dark` | 6,77:1 |
| Hogar y cocina | `moka` | B · verde | `--accent-soft` | `--accent` | 5,08:1 |
| Comida y bebida | `cake` | B · verde | `--accent-soft` | `--accent` | 5,08:1 |
| Deporte y aire libre | `ball` | B · verde | `--accent-soft` | `--accent` | 5,08:1 |
| Libros | `book` | C · arena | `--sand` | `--sand-ink` | 6,34:1 |
| Ropa y accesorios | `sweater` | C · arena | `--sand` | `--sand-ink` | 6,34:1 |
| Calzado | `shoe` | C · arena | `--sand` | `--sand-ink` | 6,34:1 |
| Juegos y juguetes | `dice` | C · arena | `--sand` | `--sand-ink` | 6,34:1 |
| Belleza y cuidado | `drop` | C · arena | `--sand` | `--sand-ink` | 6,34:1 |
| Otro regalo | `gift` | N · neutro | `--sand-2` | `--ink-2` | 8,00:1 |

Reparto: A teja 3, B verde 3, C arena 5, N neutro 1 (02 · `.cat-grid`, familias `.tile-a`/`.tile-b`/
`.tile-c`/`.tile-n`). El reparto es el mismo en todos los artboards que dibujan deseos
(05 · `.wish-media tile-*`, 06 · `.wish-media`, 08 · `.dd-media`), y se mantiene incluso cuando el
deseo está reservado: el estado se lee en su píldora, no cambiando el color (02 · `.wish.is-other`).

### 9.2 Tamaños

| Pieza | Tile | Icono | Radio | Artboard |
| --- | --- | --- | --- | --- |
| Tarjeta de deseo (móvil y escritorio) | 64px de alto, ancho completo | 36 px | `--r-sm` 14 | 02 · `.wish-media`, `.ic-36` |
| Fila compacta de deseo | 52–56 px | 28–30 px | `--r-sm` | 05 · `.ml-rec-tile`; 02 · `.dw-media` |
| Rejilla de categorías | 56×56 | 30 px | `--r-md` 16 | 02 · `.cat-t` |
| Selector del formulario | 40×40 | 23 px | `--r-xs` 12 | 02 · `.cat-pick .cat-t`, 06 · `.cat-t` |
| Chip de categoría | — | 20 px | `--r-pill` | 02 · `.cat-chip .ic` |

**Regla de accesibilidad:** el color nunca es el único portador del significado. Cada icono va con el
nombre escrito de la categoría (02 · `.w-cat`, 16 px `--ink-2`, 9,39:1) o con una etiqueta accesible
(`<span class="sr-only">… · Tecnología</span>`, 02 · `.mini-tile`).

---

## 10. Componentes

Anatomía de los trece componentes del sistema nuevo. Los valores son los canónicos: si una maqueta se
desvía, la desviación está en §12.

### 10.1 Botón primario

- Fondo `--primary`, texto blanco 17 px/700, `--r-pill`, alto mínimo 48, relleno 10/20, hueco 8 entre
  icono y texto, contorno 2 px transparente (reserva de espacio para el estado de peligro).
- Sombra `--sh-cta`. Hover: fondo `--primary-dark`. Activo: `--primary-dark` sin sombra.
- Máximo **un** botón primario por pantalla y siempre al alcance del pulgar (06 · `.fd-bar`,
  08 · `.dd-bar`).
- Artboard: 02 · `.btn-primary`, 11 · `.ac-actions`.

```css
.btn-primary { background: var(--primary); color: #fff; box-shadow: var(--sh-cta); }
.btn-primary:hover { background: var(--primary-dark); }
```

### 10.2 Botón secundario

- Fondo `--surface`, texto `--ink`, contorno 2 px `--border-strong`, `--r-pill`, alto 48.
- Hover: fondo `--hover-control`, contorno `--ink-2`.
- Acompaña al primario («Ahora no», «Cancelar») y nunca compite con él por color.
- Artboard: 02 · `.btn-secondary`, 08 · `.dd-sheet-btns`.

### 10.3 Botón de peligro

- Fondo `--danger`, texto blanco 17 px/700, `--r-pill`, alto 48, sombra `--sh-danger`.
- Hover: `--danger-dark`. Se usa en confirmaciones destructivas (borrar un deseo, salir de un grupo)
  y siempre dentro de un diálogo u hoja con un secundario que permita cancelar.
- La acción destructiva secundaria (no principal) es un botón de texto en `--danger` con subrayado,
  fondo `--danger-soft` al pasar por encima (06 · `.fd-danger`).
- Artboard: 10 · `.btn-danger`, 04 · `.gx-srow-danger` (fila destructiva de la hoja).

### 10.4 Botón suave y botón de texto

- **Suave** (acción repetida dentro de una tarjeta, «Ya lo tengo»): fondo `--primary-soft`, texto
  `--primary-dark`, contorno 2 px `--primary-line-strong`, hover `--active-soft`.
  Artboard: 02 · `.btn-soft`, 05 · `.wish .btn`.
- **Texto** (terciario, «Volver a pedirlo», «Cambiar»): sin fondo, texto `--primary-dark` 17 px/700
  subrayado de 2 px con 4 px de separación, alto 48, radio `--r-sm`, hover fondo `--primary-soft`.
  Artboard: 02 · `.link-btn`, `.cat-pick-act`; 05 · `.ml-rec-acts`.
- **Deshabilitado:** fondo `--sand-2`, texto `--ink-2` (8,00:1), sin sombra, `cursor: not-allowed` y
  `aria-disabled` o `disabled`. **Un solo tratamiento** en toda la app. Artboard: 10 · `.btn[disabled]`
  (valor canónico distinto, §12).

### 10.5 Tarjeta de deseo (con icono de categoría y enlace sólo icono)

Estructura, de arriba abajo (02 · `.wish`, 06 · `.wish-media`, 08 · `.dd-wish`):

1. **Franja de categoría**: 64 px de alto, radio `--r-sm`, relleno 0/12, fondo y trazo de la familia
   de la categoría, icono de 36 px a la izquierda y, a la derecha, precio 18 px/800 y nombre de la
   categoría 16 px `--ink-2`.
2. **Título** 18 px/800 (`--text-row`), `--ink`, máximo 3 líneas.
3. **Prioridad**: tres corazones de 17 px (`--primary` llenos, `--muted` vacíos) + texto 17 px
   `--ink-2` («Me encantaría», «Le gustaría», «Le haría ilusión»). Los corazones nunca van solos.
4. **Enlace a la tienda, sólo icono**: círculo de **48×48** con icono `link` de 24 px,
   `--primary-dark` sobre `--surface`, contorno 1,5 px `--border-strong`, hover `--primary-soft`.
   `aria-label="Abrir en la tienda (dominio): título"` y `title` con el dominio (02 · `.w-link`,
   05 · `.w-link`). Sólo aparece si el deseo tiene enlace.
5. **Nota** («Nota …»): bloque con prefijo `Nota` en 800, texto 17 px/1,4 `--ink-2`, fondo `--bg`,
   `border-left` 3 px `--border-strong`, radio `--r-xs`, recortado a **3 líneas** con
   `-webkit-line-clamp: 3` (02 · `.w-note`). En el detalle no se recorta (08 · `.dd-note`).
6. **Estado**: píldora de 16 px/800 con icono. «Lo regalas tú» → `--accent-soft` / `--accent-ink` con
   contorno `--accent-line`; «Ya reservado» → `--sand-2` / `--ink-2` con contorno discontinuo
   `--border-strong` (02 · `.state-mine`, `.state-other`).
7. **Acción**: botón suave, o barra de acción fija en el detalle.

- Tarjeta: `--surface`, contorno 1 px `--border`, radio `--r-card`, relleno 12, `--sh-1`.
- Cuando el deseo es propio, el contorno pasa a `--accent-line` y el fondo del bloque de estado a
  `--accent-soft`; nunca se cambia el color de la categoría.
- Artboard: 02 · `.wish`, `.dw`; 05 · `.wish`; 06 · `.wish-media`; 08 · `.dd-wish`.

### 10.6 Chip de celebración

Tres densidades de la misma pieza (cumpleaños y onomástica, S3):

| Variante | Alto | Relleno | Avatar | Texto | Artboard |
| --- | --- | --- | --- | --- | --- |
| Bloque (Inicio y ficha de persona) | 56 | 8/14 | 40 px | título 17 px/800 + cuándo 16 px `--ink-2` | 02 · `.celebs li` |
| Fila con avatar (Avisos) | 56 | 8/12 | 40 px | título 17 px + fecha 15 px con nombre en 800 | 09 · `.av-celeb` |
| Línea en texto (lista de Personas) | — | — | — | 16 px/600 `--ink-2`, icono `cal` de 17 px, nombre en 800 | 07 · `.psn-celeb` |

- Fondo `--surface`, contorno **1,5 px** `--border-strong`, radio `--r-md` 16.
- **La próxima** lleva fondo `--primary-soft`, contorno `--primary-line` y la fecha en una píldora
  blanca `--surface` con texto `--primary-dark` (02 · `.celebs li.is-next`, 04 · `.gx-celeb-next`).
- Se ordenan por cercanía; la lista de una persona muestra cumpleaños y onomástica, nunca eventos de
  grupo (S3).

### 10.7 Avatar emoji

- Círculo perfecto, `1:1`, fondo `linear-gradient(180deg, #FFFFFF, #FFF2E6)`, contorno 2 px
  `--border-strong`, emoji centrado con `line-height: 1` y tamaño de glifo ≈ 0,48 × lado.
- Medidas: 40 px (glifo 20) en avisos y celebraciones, 48 px (24) en filas, 56 px (27) en cabeceras,
  72 px (36) en Perfil; `--sh-1` a partir de 56 px.
- Hover/selección: contorno `--primary` + anillo `0 0 0 3px var(--primary-soft)` (02 · `.person:hover`).
- Variante «todos»: contorno discontinuo `--border-strong`, color `--ink-2` (02 · `.avatar-all`).
- Sólo emoji, nunca foto (S3). Siempre `aria-hidden` cuando el nombre está al lado; cuando es el
  único contenido, lleva el nombre en `sr-only`.
- Artboard: 02 · `.avatar`, 07 · `.psn-main .avatar`, 10 · `.pr-av-72`.

### 10.8 Fila de persona y fila de grupo

**Persona** (07 · `.psn-main`, 04 · `.gx-person`):

- Alto mínimo 56 (64 en lista de grupos), relleno 4/6, radio `--r-sm`, hover `--hover-row`.
- Avatar 48 · nombre 18 px/800 · recuento de deseos 16 px/700 `--ink-2` a la derecha · celebración en
  una línea · grupos como etiquetas (`--r-pill`, fondo `--sand`, 16 px/700) · chevron 20 px
  `--primary-dark`.
- Cada persona aparece **una sola vez**, con sus grupos listados dentro (S3). La lista vive en una
  tarjeta `--surface`, radio `--r-card`, contorno 1 px `--border`, separadores de 1 px `--border`
  (07 · `.psn-people`).

**Grupo** (07 · `.psn-grow`, 02 · `.g-link`):

- Alto mínimo 56–64, tile de emoji 46×46 con radio 14 y fondo `--sand`, nombre 18 px/800, meta
  16 px `--ink-2`, chevron. Toda la fila es el enlace.
- Al pasar por encima se subraya el nombre, no el tile: el subrayado señala el destino.

### 10.9 Hoja inferior

- Ancho completo del móvil, anclada abajo; `--r-sheet` 28 en las esquinas superiores, relleno
  10/20/28, `--sh-sheet`, fondo `--surface` opaco.
- Asa de 44×5, radio 99, `--border-strong`, centrada, 8 px de margen inferior.
- Cabecera: título `--text-sheet` (22 px/800) y, si cierra, botón redondo de 48 con contorno 2 px
  `--border-strong` (02 · `.x-btn`).
- Velo: `rgba(43,26,18,.52)` a pantalla completa (02 · `.scrim`, 08 · `.dd-scrim`).
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apuntando al título y el fondo `inert`
  (08 · `.dd-sheet`). Máximo dos botones, primario arriba y secundario debajo, apilados.
- Artboard: 02 · `.sheet`, 04 · `.gx-sheet`, 07 · `.psn-sheet`, 08 · `.dd-sheet`, 10 · `.pr-sheet`.

### 10.10 Diálogo

- Sólo escritorio: caja de 880 px de ancho como máximo, radio `--r-dialog` 24, `--sh-dialog`, sobre
  velo `rgba(43,26,18,.30)`, centrada con 80 px de margen superior y 20 de inferior.
- Cabecera con borde inferior de 1 px `--border` y relleno 14/24; cuerpo con scroll propio; pie con
  borde superior de 1 px y relleno 12/24, acciones alineadas a la derecha con 12 px de hueco.
- `role="dialog"`, `aria-modal="true"`, foco atrapado y devuelto al disparador al cerrar.
- En móvil la misma confirmación es una hoja inferior (§10.9).
- Artboard: 06 · `.fd-dialog`.

### 10.11 Toast con «Deshacer»

- Anclado a 14 px de los lados y **84 px** del borde inferior: 72 de la barra de pestañas + 12.
- Fondo `--ink`, texto `--on-ink` 17 px/1,3, radio `--r-md` 16, relleno 9/10/9/14, `--sh-toast`.
- Acción «Deshacer»: 48 px de alto, radio `--r-xs`, texto `--on-ink-accent` 17 px/800 subrayado 2 px,
  hover `rgba(255,243,232,.16)`, foco con anillo `--on-ink-accent`.
- `role="status"`, `aria-live="polite"`; una sola acción; el aviso no bloquea la pantalla y deja
  seguir leyendo. No se cierra al tocar fuera.
- Deshacer debe revertir exactamente lo hecho: «Ya lo tengo» devuelve el deseo a «Pendientes» con su
  precio, su nota y su enlace (05 · `.ml-undo`, nota 1 de 05).
- Artboard: 05 · `.ml-toast`, `.ml-undo`.

### 10.12 Campo con «Mostrar»

- Etiqueta 17 px/800 arriba, 6 px de separación; ayuda 16 px `--ink-2` debajo del campo.
- Campo de **56** de alto, radio `--r-sm`, relleno 0/14, texto 17 px/600 `--ink`, placeholder
  `--ink-2` (8,92:1), contorno 2 px `--border-control`, fondo `--surface`.
- **«Mostrar»**: botón dentro del campo a la derecha (5 px), 48 de alto, radio `--r-xs`, texto
  17 px/800 `--primary-dark` subrayado 2 px, hover `--primary-soft`. El campo reserva 104 px a la
  derecha (`padding-right:104px`) para que el texto nunca quede debajo. Se alterna a «Ocultar» y
  mantiene el foco en el campo, no en el botón.
- **Error:** contorno 2 px `--danger`, fondo `--danger-soft`, mensaje de 16 px/700 `--danger-dark` con
  icono `alert` de 19 px y `aria-describedby`. Nunca se comunica sólo con color.
- **Deshabilitado o de sólo lectura:** fondo `--sand-2`, texto `--ink-2`, contorno 1,5 px
  `--border-strong`.
- Artboard: 11 · `.ac-input`, `.ac-show`, `.ac-ferr`, `.ac-input[aria-invalid]`; 02 · `.alta-input`,
  `.alta-show`; 10 · `.pr-input`.

### 10.13 Pestañas inferiores

- Barra de **72** px al pie, 4 columnas (Inicio / Mi lista / Personas / Avisos), relleno 4/8/20,
  borde superior 1 px `--border`, fondo `rgba(255,248,241,.97)`.
- Cada pestaña: 48 de alto mínimo, icono 23 y etiqueta 14 px/600 en columna; inactiva `--ink-2`.
- Activa: fondo `--primary-soft`, texto `--primary-dark` 14 px/800, `aria-current="page"`. El estado
  se lee por color **y** por peso y fondo.
- Contador: bandera `--primary` con texto blanco 13 px/800, radio `--r-pill`, 19 px de alto, sobre la
  esquina superior derecha del icono (02 · `.nav-badge`).
- En escritorio las mismas cuatro secciones son píldoras en el encabezado: 48 de alto, 0/15 de
  relleno, 17 px/600 `--ink-2`, activa `--primary-soft` + `--primary-dark` + 800 (02 · `.dt-nav`).
- Los grupos **no** son una pestaña: viven dentro de «Personas» (S2).
- Artboard: 02 · `.pf-nav`, `.dt-nav`; 05 · `.ml-seg` (control segmentado «Pendientes / Recibidos»,
  mismo lenguaje: pista `--sand-2`, activo `--surface` con contorno `--ink` y `--sh-1`).

### 10.14 Aviso de error (y de éxito e información)

- Caja con icono, relleno 12/14, radio `--r-md` 16, hueco 11 entre icono y texto, contorno **2 px**.
- **Error** `--danger-soft` + `--danger-line`, icono 24 px `--danger`, título 17 px/800 y detalle
  17 px/1,35 en `--danger-dark` (9,26:1).
- **Éxito** `--accent-soft` + `--accent-line`, icono `--accent`, texto `--accent-ink` (8,54:1).
- **Información cálida** `--primary-soft` + `--primary-line`, icono `--primary-dark`, texto `--ink`.
- Variante **en línea** (bajo un formulario, más compacta): relleno 11/14, radio `--r-md`, el mismo
  juego de colores (10 · `.pr-banner`, `.pr-banner-err`).
- `role="alert"` sólo para el error que aparece tras una acción; el resto `role="status"`.
- El mensaje de campo (§10.12) es la versión mínima del mismo lenguaje: icono + texto, sin caja.
- Artboard: 11 · `.ac-alert`, `.ac-alert-ok`; 10 · `.pr-banner`; 06 · `.fd-banner`.

---

## 11. Diferencias con el sistema actual

Comparado con `design/system.md` (la foto del sistema en uso, «The Digital Keepsake»). Este fichero
**no** se modifica: sirve de punto de partida de la comparación.

| Aspecto | Sistema actual (`design/system.md`) | Sistema nuevo | Por qué |
| --- | --- | --- | --- |
| Marca | `--primary: #aa2c32` (rosa carmesí) con degradado `135° primary → primary-container #ff7574` | `--primary: #B93D12` (teja) plano, con sombra cálida `--sh-cta` | El degradado restaba legibilidad al texto blanco en el tramo claro; el plano garantiza 5,62:1 constante |
| Lienzo | `--background: #fff4f4` (rosa pálido), secciones `#ffecee`, tarjetas `#ffffff` | `--bg #FFF8F1` (crema), secciones `--sand #FBEBDC`, tarjetas `#FFFFFF` | Un lienzo cálido y más luminoso separa mejor tarjeta y fondo sin bordes fuertes |
| Tinta | `--on-surface / --foreground: #4c212b` | `--ink #2B1A12` + `--ink-2 #5C4033` | Dos niveles de texto con 16,68:1 y 9,39:1; antes había uno solo |
| Acento de éxito | `success/reserved: #006666` (verde azulado) | `--accent: #2F6F4E` + `--accent-soft #E1F0E7` + `--accent-ink #1F4A33` | El verde azulado se leía como «enlace»; ahora el éxito tiene fondo propio |
| Semántica de prioridad | chips `priority-high #aa2c32`, `priority-medium #6d5a00`, `priority-low #006666`, `price #6d5a00` | fuera: corazones `--primary` + texto («Me encantaría / Le gustaría / Le haría ilusión») y precio en 18 px/800 | Tres chips de color competían con el estado; el corazón dice lo mismo con una forma |
| Bordes | «No 1px borders: depth through tonal layering and tinted ambient shadows» | **Sí hay bordes**: 1 px `--border` (separadores), 1,5 px `--border-strong` (chips y filas), 2 px `--border-control` / `--primary` / `--danger` (controles) | Se invierte a propósito: para todas las edades, un contorno visible define dónde se pulsa mejor que una sombra tenue |
| Cristal | navegación y modales en cristal al 70–80 % con 20 px de desenfoque | superficies **opacas**; única transparencia `rgba(255,248,241,.97)` en la barra de pestañas | El desenfoque baja el contraste del texto y cuesta en móviles modestos |
| Tipografía | `Be Vietnam Pro` (400/600) + `Plus Jakarta Sans` (700/800) | **Nunito** 600/700/800, una sola familia, escala de 13 a 30 px | Una familia redondeada, más cercana y más simple de mantener; la escala sustituye a la ausencia de escala |
| Radios | `rounded 0.5rem`, `rounded-md 0.75rem` (12 px), botones «fully rounded» | 9 tokens: `--r-badge 9` · `--r-xs 12` · `--r-sm 14` · `--r-md 16` · `--r-lg 18` · `--r-card 20` · `--r-dialog 24` · `--r-sheet 28` · `--r-pill 999` | La tarjeta pasa de 12 a **20 px** y aparece una escala completa por tamaño de pieza |
| Sombras | `shadow-ambient` y `shadow-ambient-lg` (dos sombras rosadas apiladas) | 9 tokens, incluidos `--sh-cta`, `--sh-glow`, `--sh-toast`, `--sh-sheet`, `--sh-dialog`, `--sh-bar` | Cada elevación tiene su token y su dirección; sólo tres son cálidas y sólo en el primario |
| Navegación | 3 pestañas: Deseos / Grupos / Perfil; dock flotante de cristal | 4 pestañas: **Inicio / Mi lista / Personas / Avisos**; barra sólida de 72 px; grupos dentro de Personas | S3 y S2: las personas son el mapa, y «Avisos» deja de estar escondido |
| Corte de pantalla | un solo breakpoint en 768 px | móvil 390 (16 px laterales) · escritorio con contenido de 1200 px (T7 tablet pendiente) | El nuevo diseño se dibuja primero en 390 y crece a columnas de 1200 |
| Objetivo táctil | no documentado | `--touch: 48px` como mínimo de cualquier control | Requisito de la dirección: «fácil de usar para todo tipo de edades» |
| Foco | anillo de foco con `--primary` | anillo de 3 px `--primary-dark` con 3 px de separación (6,77–8,19:1), variante clara sobre fondo oscuro | Un anillo que se ve también sobre fondos teja |
| Movimiento | no documentado | `--dur-state .16s ease`, `--dur-spin .9s linear`, movimiento reducido respetado | Ninguna animación es necesaria para entender la interfaz |
| Contenido visual | fotos de producto | **12 iconos de categoría** en 4 familias de color | S3; elimina dependencias de imágenes externas |
| Estado «ya lo tengo» | no existía | `--accent-soft` + píldora «Lo regalas tú» y toast con «Deshacer» | S3: el deseo se mueve a Recibidos y se puede deshacer |

---

## 12. Inconsistencias detectadas y valor canónico

Hallazgos al extraer los tokens de las nueve maquetas. Ninguna se ha corregido en los artboards: la
lista es la propuesta de unificación para la implementación.

### 12.1 Conjunto de tokens

| Hallazgo | Dónde | Canónico |
| --- | --- | --- |
| `--gold: #E7A33C` declarado y **sin ningún uso** | 02–11 · `:root` | se elimina del sistema |
| `--danger` / `--danger-dark` no se declaran | 02 · `:root`, 06 · `:root` | se declaran siempre con `#B42318` / `#7A1A12` |
| 06 usa `#B42318` literal en `.fd-danger` y `.fd-input-err` | 06 | `var(--danger)` |
| Sólo 10 define `.btn-danger` | 10 | el botón de peligro entra en el sistema (§10.3) |

### 12.2 Contorno de controles

Las maquetas dibujan los campos con `--border-strong` (1,59:1 sobre blanco), por debajo del 3:1 que
exige un contorno de control. **Un solo valor canónico:** `--border-control: #B67A50` (3,57:1), que ya
existe en 02 como color de ilustración.

| Dónde | Hoy | Canónico |
| --- | --- | --- |
| 02 · `.alta-input`, `.alta-select`, `.cat-pick`, `.cat-chip` | 2 px `--border-strong` | 2 px `--border-control` |
| 04 · `.gx-select`, `.gx-sw` | 2 px `--border-strong` | 2 px `--border-control` |
| 06 · `.fd-prio-card`, `.fd-opt` | 2 px `--border-strong` | 2 px `--border-control` |
| 07 · `.psn-search-in`, `.psn-code` | 2 px `--border-strong` | 2 px `--border-control` |
| 10 · `.pr-input`, `.pr-select` | 2 px `--border-strong` | 2 px `--border-control` |
| 11 · `.ac-input` | 2 px `--border-strong` | 2 px `--border-control` |

Las filas y tarjetas que se abren con su título completo (persona, grupo, deseo) mantienen
`--border` / `--border-strong`: su contenido ya identifica el control.

### 12.3 Colores derivados que deberían ser token

| Valores hallados | Dónde | Canónico | Motivo |
| --- | --- | --- | --- |
| `#244C36` y `#1F4A33` | 02 · `.helper`, 05 · `.ml-info`, 07 · `.psn-helper`, 08 · `.dd-info` (el primero) frente a 02 · `.state-mine`, 04, 06, 09, 10, 11 (el segundo) | `--accent-ink: #1F4A33` | Dos verdes para el mismo papel; 8,54:1 ambos, se queda el más usado |
| `#BFDCCB`, `#9CC9AF`, `#C4E0CE` | 02 · `.wish.is-mine`, `.dw-state.mine`; 06 · `.fd-banner` | `--accent-line: #B4D5C3` | Cuatro verdes de contorno para el mismo estado |
| `#F4EBE3`, `#F7F0E9`, `#EADFD5`, `#F3E4D8`, `#F8EBE0` | 02 · `.state-other`, `.dw.is-other`, `.dw.is-other .dw-media`; 04 · `.gx-dim-btn`; 08 · `.dd-state-other`; 05 · `.ml-seg` | `--sand-2: #F6EBE2` (filas y pistas) / `--sand: #FBEBDC` (estados) | Cinco neutros cálidos que hacen lo mismo |
| `#FDF7F1`, `#FFFCF9` | 02 · `.wish.is-other`, `.dw` | `--surface-sunken: #FFFCF8` | Ya existe y es el usado en 05 y 09 |
| `#FFFDFB` | 04 · `.gx-dpcard:hover`; 09 · `.av-item:hover`, `.av-celeb:hover`, `.av-group:hover` | `--hover-row: #FFF1E5` | 1,02:1 sobre blanco: el hover no se percibe |
| `#FBDFC6` | 09 · `.av-set:hover` | `--active-soft: #FBD9C4` | Casi el mismo naranja que el hover del botón suave |
| `#E8C3A8` | 02 · `.spinner`; 06 · `.fd-spin` | `--primary-line: #F3CDB6` | Pista de la rueda de carga, decorativa |
| `#FFF6EC` | 09 · `.av-item-unread` | `--unread: #FFF6EC` (nuevo token, `--ink` 15,60:1) | Faltaba en el conjunto; sólo lo usa Avisos |
| `#FFF6EF` | 11 · `.ac-input-off` | `--sand-2` | Campo deshabilitado |
| `#D9A491` + `#4A2C20` | 11 · `.ac-btn-off` | `--sand-2` + `--ink-2` | Un tercer tratamiento de «deshabilitado» |
| `#EEDFD3` + `#6B5A50` + `#E3CDBC` | 10 · `.btn[disabled]` | `--sand-2` + `--ink-2` sin contorno propio | Segundo tratamiento de «deshabilitado»; el de 06 (`--border` + `--ink-2`) queda a un paso |
| `#DE9D97` | 04 · `.gx-srow-danger:hover`; 11 · `.ac-input[aria-invalid]` | `--danger-line` (hover) y `--danger` (campo inválido) | Rojo de contorno sin token |
| `#F0C3BE`, `#FFF8F7` | 06 · `.fd-err-card`, `.fd-input-err` | `--danger-line` + `--danger-soft` | Error dibujado con valores propios |
| `#FFFBFB`, `#FDF3F2`, `#FEF7F6` | 10 · `.pr-input-err`; 07 · `.psn-code-err`; 04 · `.gx-srow-danger:hover`; 11 · `.ac-input[aria-invalid]` | `--danger-soft: #FDECEA` | Cuatro fondos de error distintos para el mismo mensaje |
| `#3A2318`, `#43291C`, `#8E5A3A`, `#D9976A`, `#B67A50` (en SVG), `#1F3A5F` | 02 · ilustración de bienvenida; 10 · `.pr-swatch` | no son tokens | Ilustración y muestra de color de un selector |

### 12.4 Escala tipográfica: medios pasos

La maqueta usa 24 tamaños distintos. La escala canónica tiene 11 pasos; estos valores se normalizan:

| Hallado | Dónde | Canónico |
| --- | --- | --- |
| 12,5 · 13,5 | 02 · `.nav-badge`; 09 · `.av-unread-flag` | `--text-badge` 13 |
| 15,5 | 09 · `.av-meta`, `.av-celeb-d`; 05 · `.ml-rec` | `--text-meta` 15 |
| 16,5 | 09 · `.av-txt`, `.av-group-t`; 10 · `.pr-…` | `--text-small` 16 |
| 19 | 08 · `.dd-blk`, `.dd-more-h`; 09 · `.av-day-h` | `--text-sub` 20 |
| 21 | 04 · `.gx-sheet-h`; 08 · `.dd-dh` | `--text-sheet` 22 |
| 23 | 08 · `.dd-sheet-h` | `--text-sheet` 22 |
| 25 | 02 · `.row-head h2`, `.alta-preview-n` | `--text-section` 24 |
| 27 | 04 · `.gx-name`; 02 · `.welcome` | `--text-screen` 26 |
| 28 | 02 · `.alta-h`; 04 · `.gx-set-h` | `--text-page` 30 |
| 29 | 02 · `.home-hi`; 09 · `.av-title`; 10 · `.pr-h`; 11 · `.ac-h` | `--text-page` 30 |
| 31 · 32 | 02 · `.hero-dt-person .avatar`; 04 · `.gx-dpav` | tamaño de glifo del avatar (§10.7) |
| 36 | 02 · `.alta-av-72`; 10 · `.pr-av-72` | tamaño de glifo del avatar (§10.7) |
| 40 | 02 · `.strip h1` | presentación del artboard, no pantalla |
| `body` 16 px en 02, 04, 06–11 frente a 17 px en 05 | `body{font-size}` | `--text-body` 17 (216 declaraciones explícitas ya usan 17) |
| Peso 500 una vez | 11 · `.ac-alert-d` | 600 |

### 12.5 Radios, sombras y movimiento

| Hallado | Dónde | Canónico |
| --- | --- | --- |
| 10 px | 04 · `.av-set-ic` | `--r-xs` 12 |
| 13 px | 02 · `.mini-tile`, `.dw-media`, `.alta-demo-ic` | `--r-xs` 12 |
| 22 px sin token | 02 · `.cat-how` (relleno), no es radio | — |
| `0 10px 24px rgba(185,61,18,.1)` y `0 12px 30px rgba(185,61,18,.1)` | 02 · `.hero`, `.alta-panel` frente a `.hero-dt` | `--sh-glow` `0 12px 30px rgba(185,61,18,.10)` |
| `0 0 0 3px var(--primary-soft)` mezclado con `box-shadow` de tarjeta | 02 · `.alta-face:has(input:checked)` | anillo de selección, no sombra: se documenta como `--ring-selected` |
| Transiciones a `.16s` en 9 archivos, sin token | 02–11 | `--dur-state` |

### 12.6 Objetivos táctiles

| Hallado | Dónde | Canónico |
| --- | --- | --- |
| 44×44 | 07 · `.psn-search-clear` | 48×48 (`--touch`) |

### 12.7 Bordes de aviso

| Hallado | Dónde | Canónico |
| --- | --- | --- |
| 1,5 px `#EFC9C5` | 10 · `.pr-banner-err` | 2 px `--danger-line` (como 11 · `.ac-alert`) |

---

## 13. Preguntas para el propietario

1. **Timing del toast.** Las maquetas lo dibujan estático. ¿Cuánto tiempo debe quedar «Deshacer» a la
   vista antes de desaparecer? Propuesta: 10 s, o hasta que se pulse, para que dé tiempo a leerlo.
2. **Nunito, ¿única familia?** La escala está pensada para una sola familia (600/700/800). Si se
   quiere una display distinta para los títulos, hay que volver a medir la escala (§2.1).
3. **`--border-control #B67A50` en los campos.** Es la corrección de contraste más visible de esta
   ficha: oscurece el contorno de todos los campos respecto a las maquetas. ¿Se acepta el cambio en
   los artboards 02, 04, 06, 07, 10 y 11?
4. **Tablet (T7).** El sistema deja escrito el móvil (390) y el escritorio (1200); la franja de tablet
   sigue pendiente y puede pedir una escala intermedia de 20/24 px en los títulos.
