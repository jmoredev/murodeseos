import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Umbral WCAG AA para texto normal. */
const AA_TARGET = 4.5;

/** Color opaco en formato `#rrggbb`. */
export type Hex = string;

/** Linealiza un canal sRGB 0..255 según la WCAG 2.x. */
function linearizeChannel(channel: number): number {
  const v = channel / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex: Hex): [number, number, number] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance(rgb: [number, number, number]): number {
  return 0.2126 * linearizeChannel(rgb[0]) + 0.7152 * linearizeChannel(rgb[1]) + 0.0722 * linearizeChannel(rgb[2]);
}

/**
 * Mezcla `fg` sobre un fondo opaco `bg` con opacidad `alpha` (0..1): el canal
 * resultante es `alpha * fg + (1 - alpha) * bg`, que es exactamente lo que un
 * navegador compone para `rgba(fg, alpha)` pintado sobre `bg` opaco.
 */
export function blendOver(fg: Hex, bg: Hex, alpha: number): Hex {
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);
  const mixed = fgRgb.map((channel, i) => alpha * channel + (1 - alpha) * bgRgb[i]) as [number, number, number];
  return (
    '#' +
    mixed
      .map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Ratio de contraste WCAG entre el primer plano compuesto (`fg` mezclado con
 * opacidad `alpha` sobre `bg`) y ese mismo fondo:
 * (L_clara + 0.05) / (L_oscura + 0.05).
 */
export function contrastRatio(fg: Hex, bg: Hex, alpha = 1): number {
  if (fg.length !== 7 || bg.length !== 7) throw new TypeError('Se esperaban colores `#rrggbb`.');
  const bgLuminance = relativeLuminance(hexToRgb(bg));
  const composedLuminance = relativeLuminance(hexToRgb(blendOver(fg, bg, alpha)));
  const lightest = Math.max(composedLuminance, bgLuminance);
  const darkest = Math.min(composedLuminance, bgLuminance);
  return (lightest + 0.05) / (darkest + 0.05);
}

/**
 * La MENOR opacidad en pasos de uno por ciento (la escala que usa Tailwind)
 * con la que `fg` mezclado sobre `bg` alcanza `target`. Devuelve `NaN` si ni
 * siquiera opaco llega. Se barre ASCENDENTEMENTE y con composición entera de
 * 8 bits, tal como la hace un navegador real: el primer paso de la retícula
 * que pasa es la frontera exacta (p. ej. 0.66 sobre #fff4f4), y son los
 * píxeles realmente pintados los que se miden, no un promedio algebraico.
 */
export function minAlphaFor(fg: Hex, bg: Hex, target: number): number {
  if (contrastRatio(fg, bg, 1) < target) return Number.NaN;
  for (let step = 1; step <= 100; step += 1) {
    if (contrastRatio(fg, bg, step / 100) >= target) return step / 100;
  }
  return 1;
}

/* ---------------------------------------------------------------------- */
/* Umbrales derivados de los valores REALES de tailwind.config.cjs —         */
/* ninguna constante de color hardcodeada en este fichero.                   */
/* ---------------------------------------------------------------------- */

interface ConfigTokens {
  onSurface: Hex;
  surfaces: Hex[];
}

export function readConfigTokens(): ConfigTokens {
  const moduleText = readFileSync(path.join(ROOT, 'tailwind.config.cjs'), 'utf8');

  const onSurface = moduleText.match(/'on-surface':\s*'(#[0-9a-fA-F]{6})'/)?.[1];
  if (!onSurface) throw new Error('No se encontró el token `on-surface` en tailwind.config.cjs.');

  const surfaceTokens = [
    'surface',
    'surface-bright',
    'surface-container-lowest',
    'surface-container-low',
    'surface-container-high',
    'surface-container-highest',
  ];

  const surfaces: Hex[] = [];
  for (const token of surfaceTokens) {
    // El fichero mezcla claves citadas (`'on-surface'`) y no citadas (`surface`):
    // se aceptan ambas formas, con ancla de inicio de línea para que `surface`
    // no coincida dentro de `surface-container-*`.
    const hex =
      moduleText.match(new RegExp(`(?:^|\\n)\\s*'${token}':\\s*'(#[0-9a-fA-F]{6})'`))?.[1] ??
      moduleText.match(new RegExp(`(?:^|\\n)\\s*${token}:\\s*'(#[0-9a-fA-F]{6})'`))?.[1];
    if (!hex) throw new Error(`No se encontró el token \`${token}\` en tailwind.config.cjs.`);
    surfaces.push(hex);
  }

  return { onSurface, surfaces };
}

const config = readConfigTokens();
const ON_SURFACE = config.onSurface;
const SURFACES = config.surfaces;

/**
 * El peor caso real de la familia NO es trivial: para identificar el fondo
 * que obliga a una opacidad mayor, se DERIVA el suelo token a token y se
 * queda el máximo — no se adivina cuál será el peor por su luminancia. Como
 * efecto secundario útil, `WORST_CASE_BG` es el fondo cuyo suelo es el que
 * manda (el relleno de inputs `surface-container-highest`, #ecd8e0, el más
 * oscuro de la familia: es el que empuja el suelo global a /70).
 */
export function deriveOpacityFloor(values: Hex[], fg: Hex, target: number): { floor: number; bindingBg: Hex } {
  let floor = 0;
  let bindingBg = values[0];
  for (const candidate of values) {
    const required = minAlphaFor(fg, candidate, target);
    if (Number.isNaN(required)) continue; // opaco no basta sobre ese fondo
    if (required > floor) {
      floor = required;
      bindingBg = candidate;
    }
  }
  return { floor, bindingBg };
}

export const { floor: OPACITY_FLOOR, bindingBg: WORST_CASE_BG } = deriveOpacityFloor(
  SURFACES,
  ON_SURFACE,
  AA_TARGET,
);

/* ---------------------------------------------------------------------- */
/* Sin exenciones.                                                          */
/*                                                                          */
/* WCAG exime los controles deshabilitados y lo puramente decorativo, así que */
/* este guardián tuvo una lista de excepciones. Se retiró: estaba indexada    */
/* por `<fichero>:<línea>:<clase>`, de modo que cada edición del código        */
/* desplazaba las líneas, las claves dejaban de casar y el guardián fallaba    */
/* por una razón ajena al color — un bucle que costó una sesión entera.        */
/* Los cuatro usos que se pretendían eximir resultaron no necesitarlo: los dos */
/* placeholders 🎁 son emoji (en un emoji la propiedad `color` no pinta nada), */
/* y el chevron › y la inicial de reserva del avatar simplemente se leen mejor */
/* al suelo. La regla es ahora absoluta: por debajo del suelo es un defecto,   */
/* en cualquier fichero y con cualquier forma.                               */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* Escáner puro                                                              */
/* ---------------------------------------------------------------------- */

export interface OnSurfaceUsage {
  line: number;
  class: string;
  alpha: number;
  /** Ratio REAL del color compuesto sobre el fondo del peor caso. */
  ratio: number;
  /** true si queda por debajo del suelo (el defecto que este test persigue). */
  subFloor: boolean;
}

/**
 * Escáner puro sobre el texto de un fichero: localiza CADA `text-on-surface/NN`
 * (por encima, en o bajo el suelo — el llamador decide qué hacer con cada uno)
 * con línea, alpha y ratio real sobre el fondo del peor caso. No hay lista de
 * excepciones: por debajo del suelo, `subFloor` es `true`, sin más.
 */
export function findTextOnSurfaceUsages(source: string, floor: number): OnSurfaceUsage[] {
  const hits: OnSurfaceUsage[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const match of line.matchAll(/text-on-surface\/(\d{1,3})\b/g)) {
      const alpha = Number.parseInt(match[1], 10) / 100;
      hits.push({
        line: i + 1,
        class: match[0],
        alpha,
        ratio: contrastRatio(ON_SURFACE, WORST_CASE_BG, alpha),
        subFloor: alpha < floor,
      });
    }
  }
  return hits;
}

/** Recolecta recursivamente los .ts/.tsx de un árbol, saltando node_modules. */
function collectTsFiles(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTsFiles(full, out);
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/* ---------------------------------------------------------------------- */
/* Aritmética: pura, probada contra sí misma para que una implementación     */
/* vacía o alucinada no pueda colar.                                        */
/* ---------------------------------------------------------------------- */

describe('aritmética WCAG del guardián de contraste', () => {
  it('contrastRatio llega a ~21 para negro sobre blanco, ~1 contra sí mismo', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeGreaterThan(20.9);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#4c212b', '#4c212b')).toBeCloseTo(1, 5);
  });

  it('minAlphaFor reproduce el borde real sobre el token de superficie: /65 no pasa, /66 sí', () => {
    expect(contrastRatio(ON_SURFACE, '#fff4f4', 0.65)).toBeLessThan(AA_TARGET);
    expect(contrastRatio(ON_SURFACE, '#fff4f4', 0.66)).toBeGreaterThanOrEqual(AA_TARGET);
    expect(minAlphaFor(ON_SURFACE, '#fff4f4', AA_TARGET)).toBe(0.66);
  });

  it('control negativo: el defecto real del repositorio — /45 NO llega a AA, /70 sí', () => {
    expect(contrastRatio(ON_SURFACE, WORST_CASE_BG, 0.45)).toBeLessThan(AA_TARGET);
    expect(contrastRatio(ON_SURFACE, WORST_CASE_BG, 0.7)).toBeGreaterThanOrEqual(AA_TARGET);
    // Y el suelo global, con la peor superficie real, es exactamente /70.
    expect(OPACITY_FLOOR).toBe(0.7);
    // El que manda es el fondo MÁS OSCURO de la familia (el relleno de
    // inputs, surface-container-highest #ecd8e0): contra él /69 aún falla.
    expect(contrastRatio(ON_SURFACE, WORST_CASE_BG, 0.69)).toBeLessThan(AA_TARGET);
    expect(WORST_CASE_BG.toLowerCase()).toBe('#ecd8e0');
  });

  it('los tokens se LEYEN de tailwind.config.cjs, no van hardcodeados aquí', () => {
    expect(config.onSurface).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(config.surfaces.length).toBeGreaterThanOrEqual(6);
    // Si la paleta cambia, el suelo se re-deriva — el valor no depende de
    // este fichero. Prueba de independencia: un primer plano distinto pide
    // una opacidad distinta sobre el mismo fondo.
    expect(minAlphaFor(ON_SURFACE, '#ffffff', AA_TARGET)).not.toBe(
      minAlphaFor('#000000', '#ffffff', AA_TARGET),
    );
  });
});

describe('escáner de text-on-surface/NN', () => {
  it('detecta un uso sub-suelo con su ratio real', () => {
    const hits = findTextOnSurfaceUsages(
      '<Text className="text-on-surface/55 text-xs">hola</Text>',
      OPACITY_FLOOR,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].class).toBe('text-on-surface/55');
    expect(hits[0].line).toBe(1);
    expect(hits[0].subFloor).toBe(true);
    expect(hits[0].ratio).toBeLessThan(AA_TARGET);
  });

  it('ve los usos en el suelo o por encima, marcándolos como conformes', () => {
    const hits = findTextOnSurfaceUsages(
      '<Text className="text-on-surface/70 text-on-surface/80 text-primary">hola</Text>',
      OPACITY_FLOOR,
    );
    expect(hits).toHaveLength(2);
    expect(hits.every((h) => !h.subFloor)).toBe(true);
  });

  it('el uso justo debajo del suelo sí se marca como defecto', () => {
    const hits = findTextOnSurfaceUsages('<Text className="text-on-surface/65">x</Text>', 0.7);
    expect(hits).toHaveLength(1);
    expect(hits[0].subFloor).toBe(true);
  });

  it('la regla es ABSOLUTA: no hay exención, ni para un emoji ni para un glifo decorativo', () => {
    // Hubo una lista de exenciones indexada por línea y resultó frágil: cada
    // edición desplazaba las líneas, las claves dejaban de casar y el guardián
    // fallaba por algo ajeno al color. Los cuatro usos que se pretendían eximir
    // se subieron al suelo (dos placeholders 🎁, donde `color` no pinta nada por
    // ser emoji; el chevron › y la inicial de reserva del avatar).
    for (const source of [
      '<Text style={{ fontSize: 40 }} className="text-on-surface/20">🎁</Text>',
      '<Text className="text-on-surface/30 ml-2">›</Text>',
      '<Text className="text-on-surface/35">{initial}</Text>',
    ]) {
      const hits = findTextOnSurfaceUsages(source, OPACITY_FLOOR);
      expect(hits).toHaveLength(1);
      expect(hits[0].subFloor).toBe(true);
    }
  });
});

describe('suelo de contraste AA en text-on-surface/NN (escaneo del repositorio)', () => {
  it('barre todo el código de la app y no encuentra nada por debajo del suelo', () => {
    const files = [
      ...collectTsFiles(path.join(ROOT, 'app')),
      ...collectTsFiles(path.join(ROOT, 'components')),
    ];

    // Guardia de no-vacuidad: si el barrido deja de ver el árbol, que falle.
    expect(files.length).toBeGreaterThan(20);

    let usagesSeen = 0;
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      for (const hit of findTextOnSurfaceUsages(readFileSync(file, 'utf8'), OPACITY_FLOOR)) {
        usagesSeen += 1;
        if (hit.subFloor) {
          offenders.push(
            `${rel}:${hit.line}: ${hit.class} — ratio ${hit.ratio.toFixed(2)} < ${AA_TARGET} (AA no)`,
          );
        }
      }
    }

    // Guardia de no-vacuidad (2): se cuenta TODO lo visto por el escáner, no
    // sólo los defectos. El defecto que originó este test tenía 89 usos de
    // `text-on-surface/NN`; si el recuento cae por debajo de eso (o llega a
    // cero) el glob, la ruta o el patrón se han roto y el test debe fallar
    // ruidosamente en su guardia, no pasar silenciosamente.
    expect(
      usagesSeen,
      `el escáner cree haber visto ${usagesSeen} usos de text-on-surface/NN en app/ + components/ (el defecto original eran ${'89'}); si hay menos, el escaneo está roto, no el código`,
    ).toBeGreaterThan(80);

    expect(
      offenders,
      `Usos de text-on-surface/NN por debajo del suelo de ${AA_TARGET}:1:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
