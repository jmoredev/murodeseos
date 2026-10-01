import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'public', 'manifest.json'), 'utf8'));

/** Lee el tamaño de un PNG desde su cabecera IHDR (bytes 16-24, big-endian). */
function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('manifest de la PWA', () => {
  it('declara idioma y orientación', () => {
    expect(manifest.lang).toBe('es');
    expect(manifest.orientation).toBe('portrait');
  });

  it('conserva los iconos "any" previos', () => {
    const anyIcons = manifest.icons.filter((i: { purpose: string }) => i.purpose === 'any');
    expect(anyIcons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512', '1024x1024']),
    );
  });

  it('incluye un icono maskable de 512x512 que existe en disco con el tamaño declarado', () => {
    const maskable = manifest.icons.find((i: { purpose: string }) => i.purpose === 'maskable');
    expect(maskable).toBeDefined();
    expect(maskable.sizes).toBe('512x512');
    expect(maskable.src).toBe('./AppIcons/maskable-icon-512.png');

    const file = path.join(ROOT, 'public', 'AppIcons', 'maskable-icon-512.png');
    expect(existsSync(file)).toBe(true);
    expect(pngSize(file)).toEqual({ width: 512, height: 512 });
  });

  it('tiene apple-touch-icon.png (180x180) en la raíz de public/', () => {
    const file = path.join(ROOT, 'public', 'apple-touch-icon.png');
    expect(existsSync(file)).toBe(true);
    expect(pngSize(file)).toEqual({ width: 180, height: 180 });
  });
});
