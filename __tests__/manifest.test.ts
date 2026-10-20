import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest: any = JSON.parse(readFileSync(path.join(ROOT, 'public', 'manifest.json'), 'utf8'));

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

/**
 * Share Target (T6 de `odd/tasks/compartir-producto.md`).
 *
 * El manifest es lo que hace que Android ofrezca la app en la hoja de «Compartir»: si esta
 * declaración se cae o cambia de forma, el feature entero deja de existir **sin que ningún test
 * de la app se entere**, porque nadie ejecuta el manifest. De ahí que se afirme el contrato
 * completo y no solo la presencia de la clave.
 */
describe('share_target del manifest', () => {
  const shareTarget = manifest.share_target;

  it('declara la acción dentro del ámbito de la app, con POST multipart', () => {
    expect(shareTarget).toBeDefined();
    // Relativa: la app se publica bajo `/<repo>/`, así que una ruta absoluta (`/compartir`)
    // apuntaría fuera de su ámbito en GitHub Pages.
    expect(shareTarget.action).toBe('./compartir');
    expect(shareTarget.method).toBe('POST');
    expect(shareTarget.enctype).toBe('multipart/form-data');
  });

  it('mapea los tres campos que la hoja de compartir puede entregar', () => {
    expect(shareTarget.params).toEqual({ title: 'title', text: 'text', url: 'url' });
  });

  it('no pide ficheros: la hoja de compartir no trae la imagen del producto', () => {
    // Sin `files`, Android no ofrece la app para compartir una foto suelta de la galería. Eso
    // se decidió así a propósito: la imagen se extrae de la página, y aceptar un fichero que
    // luego se ignora abriría un formulario vacío sin explicación.
    expect(shareTarget.files).toBeUndefined();
  });
});
