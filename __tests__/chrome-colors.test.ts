import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Los colores del chrome (manifest de la PWA, `app.json` y las meta que inyecta
 * `app/_layout.tsx`) no los pinta NativeWind: son literales repartidos en cuatro
 * ficheros. Este guardián los ata a los tokens de `tailwind.config.cjs` para que
 * un cambio de paleta no deje la barra del navegador, el splash o el icono de
 * Android con el color viejo — que es exactamente lo que nadie ejecuta hasta que
 * se instala la app.
 */

function tokenHex(name: string): string {
  const config = readFileSync(path.join(ROOT, 'tailwind.config.cjs'), 'utf8');
  const quoted = config.match(new RegExp(`(?:^|\\n)\\s*'${name}':\\s*'(#[0-9a-fA-F]{6})'`))?.[1];
  const bare = config.match(new RegExp(`(?:^|\\n)\\s*${name}:\\s*'(#[0-9a-fA-F]{6})'`))?.[1];
  const hex = quoted ?? bare;
  if (!hex) throw new Error(`No se encontró el token \`${name}\` en tailwind.config.cjs.`);
  return hex.toLowerCase();
}

const PRIMARY = tokenHex('primary');
const CANVAS = tokenHex('surface');

const manifest = JSON.parse(readFileSync(path.join(ROOT, 'public', 'manifest.json'), 'utf8'));
const appJson = JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
const layout = readFileSync(path.join(ROOT, 'app', '_layout.tsx'), 'utf8');

describe('colores del chrome atados a los tokens', () => {
  it('los tokens se LEEN de tailwind.config.cjs (guardia de no-vacuidad)', () => {
    expect(PRIMARY).toMatch(/^#[0-9a-f]{6}$/);
    expect(CANVAS).toMatch(/^#[0-9a-f]{6}$/);
    expect(PRIMARY).not.toBe(CANVAS);
  });

  it('el manifest usa el primario como theme_color y el lienzo como background_color', () => {
    expect(String(manifest.theme_color).toLowerCase()).toBe(PRIMARY);
    expect(String(manifest.background_color).toLowerCase()).toBe(CANVAS);
  });

  it('app.json (web, splash y icono adaptativo) usa los mismos dos colores', () => {
    expect(String(appJson.web.themeColor).toLowerCase()).toBe(PRIMARY);
    expect(String(appJson.web.backgroundColor).toLowerCase()).toBe(CANVAS);
    expect(String(appJson.splash.backgroundColor).toLowerCase()).toBe(CANVAS);
    expect(String(appJson.android.adaptiveIcon.backgroundColor).toLowerCase()).toBe(CANVAS);
  });

  it('`app/_layout.tsx` inyecta las mismas meta y pinta el mismo fondo de arranque', () => {
    const themeColor = layout.match(/const THEME_COLOR = '(#[0-9a-fA-F]{6})'/)?.[1];
    const surfaceBg = layout.match(/const SURFACE_BG = '(#[0-9a-fA-F]{6})'/)?.[1];
    expect(themeColor?.toLowerCase()).toBe(PRIMARY);
    expect(surfaceBg?.toLowerCase()).toBe(CANVAS);
  });
});
