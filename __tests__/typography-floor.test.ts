import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Suelo tipográfico del proyecto: a 360px nada se lee por debajo de 12px (`text-xs`). */
const FLOOR_PX = 12;

/**
 * Elimina comentarios `//` y `/* ... *\/` de forma best-effort para que un
 * token citado en un comentario explicativo (p. ej. «antes usábamos
 * text-[8px]») no dispare un falso positivo.
 *
 * Limitación conocida, en dirección de falsos NEGATIVOS: no entiende
 * literales de cadena. Un `//` dentro de una cadena (una URL, un esquema)
 * trunca el resto de su línea, y un `/*` dentro de una cadena abre un bloque
 * hasta el siguiente `*\/`: un `text-[10px]` genuino situado en esa línea o
 * dentro de ese bloque NO se reporta. El riesgo no es fabricar un falso
 * positivo — truncar no puede inventar un token —, sino que un sub-suelo real
 * pase desapercibido. Es un punto ciego documentado, no una cobertura.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

export interface SubFloorHit {
  token: string;
  value: number;
}

/**
 * Escáner puro (sin tocar el repositorio): reporta clases de tamaño
 * arbitrarias `text-[Npx]` y tamaños inline `fontSize: N` cuyo valor en px
 * queda por debajo del suelo de 12px. `text-xs` y `text-[12px]` pasan.
 *
 * Puntos ciegos declarados (una verificación independiente los enumeró y
 * comprobó que hoy ninguna de estas rutas tiene un valor por debajo del suelo):
 * 1. tamaños arbitrarios que no sean px — `text-[0.625rem]`, `text-[10em]`;
 * 2. la prop JSX `fontSize={10}` (el escáner solo lee `fontSize: N` de objetos);
 * 3. `fontSize` con expresión o con unidad — `fontSize: '0.75rem'`,
 *    `fontSize: size * 0.5`;
 * 4. tamaños inyectados por helpers, invisibles a un grep de texto:
 *    `emojiInCircle(n)` y `circleGlyphTextBase` (`lib/circle-glyph-styles.ts`);
 * 5. encogimientos por `lineHeight` o por el shorthand `font`.
 * Ampliar el escáner a estos casos exige visitar el AST, no expresiones
 * regulares: queda como deuda conocida, no como cobertura implícita.
 */
export function findSubFloorTextSizes(source: string): SubFloorHit[] {
  const code = stripComments(source);
  const hits: SubFloorHit[] = [];

  for (const m of code.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
    const value = Number.parseFloat(m[1]);
    if (value < FLOOR_PX) hits.push({ token: m[0], value });
  }

  for (const m of code.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)\b/g)) {
    const value = Number.parseFloat(m[1]);
    if (value < FLOOR_PX) hits.push({ token: m[0], value });
  }

  return hits;
}

/** Recolecta recursivamente los .ts/.tsx de un árbol, saltando node_modules. */
function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTsFiles(full, out);
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('suelo tipográfico de 12px', () => {
  it('el escáner detecta una clase y un tamaño inline por debajo del suelo (positivo)', () => {
    const hits = findSubFloorTextSizes(
      'className="text-[10px] tracking-widest"' +
      " style={{ fontSize: 8 }}" +
      ' className="text-xs" style={{ fontSize: 16 }}',
    );

    expect(hits).toEqual(
      expect.arrayContaining([
        { token: 'text-[10px]', value: 10 },
        { token: 'fontSize: 8', value: 8 },
      ]),
    );
    // Y nada más: los que están en o sobre el suelo no se reportan aquí.
    expect(hits).toHaveLength(2);
  });

  it('el escáner no reporta tamaños en o por encima del suelo, ni tokens citados en comentarios (negativo)', () => {
    const source = [
      'className="text-xs text-[12px] text-sm"',
      'style={{ fontSize: 16 }}',
      '// legado: esto era text-[8px] antes del suelo',
      '/* y esto otro text-[11px] en un bloque */',
    ].join('\n');

    expect(findSubFloorTextSizes(source)).toEqual([]);
  });

  it('punto ciego documentado: un `//` dentro de una cadena oculta un token real posterior en su línea', () => {
    // Punto ciego conocido, NO conducta deseada: `stripComments` no entiende
    // literales de cadena, así que el `//` de la URL trunca el resto de la
    // línea y el `text-[10px]` genuino que la sigue nunca se reporta. El test
    // documenta la limitación; no la aprueba.
    const source = "const u = 'https://x'; const c = 'text-[10px]';";

    expect(findSubFloorTextSizes(source)).toEqual([]);
  });

  it('barre todo el código de la app y no encuentra nada por debajo del suelo', () => {
    const files = [
      ...collectTsFiles(path.join(ROOT, 'app')),
      ...collectTsFiles(path.join(ROOT, 'components')),
      ...collectTsFiles(path.join(ROOT, 'lib')),
    ];

    // Guardia de no-vacuidad: si el barrido deja de ver el árbol, que falle.
    expect(files.length).toBeGreaterThan(20);

    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      for (const hit of findSubFloorTextSizes(readFileSync(file, 'utf8'))) {
        offenders.push(`${rel}: ${hit.token}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

/* ---------------------------------------------------------------------- */
/* Familia canónica: Nunito (sistema-nuevo.md §2, S6)                      */
/* ---------------------------------------------------------------------- */

/** Bloque `fontFamily: { ... }` de tailwind.config.cjs, sin comentarios. */
export function readFontFamilyTokens(): Record<string, string[]> {
  const config = readFileSync(path.join(ROOT, 'tailwind.config.cjs'), 'utf8');
  const start = config.indexOf('fontFamily: {');
  if (start === -1) throw new Error('No se encontró `fontFamily` en tailwind.config.cjs.');
  const block = config.slice(start, config.indexOf('},', start));
  const tokens: Record<string, string[]> = {};
  for (const match of block.matchAll(/['"]?([\w-]+)['"]?:\s*\[([^\]]+)\]/g)) {
    tokens[match[1]] = [...match[2].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }
  return tokens;
}

describe('familia canónica Nunito (§2)', () => {
  it('cada token de fontFamily apunta a una familia Nunito cargada por expo-font', () => {
    const tokens = readFontFamilyTokens();
    // Guardia de no-vacuidad: la app usa sans / sans-medium / sans-semibold /
    // sans-bold / display / display-extrabold.
    expect(Object.keys(tokens).length).toBeGreaterThanOrEqual(6);
    for (const [token, families] of Object.entries(tokens)) {
      expect(families[0], `fontFamily.${token}`).toMatch(/^Nunito_\d{3}/);
    }
  });

  it('`app/_layout.tsx` carga Nunito con useFonts y ya no importa las familias antiguas', () => {
    const layout = readFileSync(path.join(ROOT, 'app', '_layout.tsx'), 'utf8');
    expect(layout).toMatch(/from '@expo-google-fonts\/nunito'/);
    expect(layout).toMatch(/useFonts\(\{/);
    for (const weight of ['Nunito_600SemiBold', 'Nunito_700Bold', 'Nunito_800ExtraBold']) {
      expect(layout, `falta ${weight} en useFonts`).toContain(weight);
    }
    expect(layout).not.toMatch(/BeVietnamPro|PlusJakartaSans/);
    expect(layout).not.toMatch(/@expo-google-fonts\/(be-vietnam-pro|plus-jakarta-sans)/);
  });

  it('`app/global.css` declara --font-app con Nunito como primera familia', () => {
    const css = readFileSync(path.join(ROOT, 'app', 'global.css'), 'utf8');
    const fontApp = css.match(/--font-app:\s*'([^']+)'/)?.[1];
    expect(fontApp).toBe('Nunito');
  });

  it('no queda ninguna referencia a Be Vietnam Pro ni a Plus Jakarta Sans en el código', () => {
    const files = [
      ...collectTsFiles(path.join(ROOT, 'app')),
      ...collectTsFiles(path.join(ROOT, 'components')),
      ...collectTsFiles(path.join(ROOT, 'lib')),
    ];
    const offenders = files
      .filter((file) => /BeVietnamPro|PlusJakartaSans/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file).split(path.sep).join('/'));

    expect(offenders).toEqual([]);
  });

  it('las dependencias de fuentes son sólo la familia canónica', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const fontPackages = Object.keys(pkg.dependencies).filter((name) =>
      name.startsWith('@expo-google-fonts/'),
    );
    expect(fontPackages).toEqual(['@expo-google-fonts/nunito']);
  });
});
