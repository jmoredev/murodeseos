import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// Se evalúa el script real de postbuild (CommonJS) como módulo: gracias al guard
// `require.main === module` el require no ejecuta `main()` ni toca el sistema de archivos.
const require = createRequire(import.meta.url);
const postbuild = require('../scripts/postbuild.cjs');

const SAMPLE_HTML = [
  '<!DOCTYPE html>',
  '<html lang="es">',
  '<head>',
  '  <meta charSet="utf-8" />',
  '</head>',
  '<body></body>',
  '</html>',
].join('\n');

describe('postbuild: normalizeBasePath', () => {
  it('devuelve "" para base vacía o undefined', () => {
    expect(postbuild.normalizeBasePath('')).toBe('');
    expect(postbuild.normalizeBasePath(undefined)).toBe('');
    expect(postbuild.normalizeBasePath('   ')).toBe('');
  });

  it('normaliza la base de producción "/murodeseos"', () => {
    expect(postbuild.normalizeBasePath('/murodeseos')).toBe('/murodeseos');
  });

  it('elimina barras sobrantes al inicio y al final', () => {
    expect(postbuild.normalizeBasePath('/murodeseos/')).toBe('/murodeseos');
    expect(postbuild.normalizeBasePath('murodeseos')).toBe('/murodeseos');
    expect(postbuild.normalizeBasePath('//murodeseos//')).toBe('/murodeseos');
  });

  it('normaliza la raíz "/" a "" para no producir hrefs "//"', () => {
    expect(postbuild.normalizeBasePath('/')).toBe('');
    expect(postbuild.normalizeBasePath('///')).toBe('');
  });
});

describe('postbuild: inyección base-aware de links PWA', () => {
  it('inyecta hrefs absolutos con la base de GitHub Pages en index.html y 404.html', () => {
    for (const base of ['/murodeseos', '/murodeseos/']) {
      const out = postbuild.injectPwaHeadLinks(SAMPLE_HTML, base);
      expect(out).toContain('href="/murodeseos/favicon.ico"');
      expect(out).toContain('href="/murodeseos/apple-touch-icon.png"');
      expect(out).toContain('href="/murodeseos/manifest.json"');
      expect(out).toContain('data-murodeseos-pwa="1"');
      expect(out).not.toContain('href="./favicon.ico"');
    }
  });

  it('con base vacía produce hrefs absolutos en la raíz (sin barra doble)', () => {
    const out = postbuild.injectPwaHeadLinks(SAMPLE_HTML, '');
    expect(out).toContain('href="/favicon.ico"');
    expect(out).toContain('href="/apple-touch-icon.png"');
    expect(out).toContain('href="/manifest.json"');
    expect(out).not.toContain('href="//');
  });

  it('es idempotente: ejecutarlo dos veces no duplica el bloque', () => {
    const once = postbuild.injectPwaHeadLinks(SAMPLE_HTML, '/murodeseos');
    const twice = postbuild.injectPwaHeadLinks(once, '/murodeseos');
    expect(twice).toBe(once);
    expect(twice.match(/data-murodeseos-pwa="1"/g)).toHaveLength(3);
  });

  it('no toca el atributo lang del <html> (vive en app/+html.tsx)', () => {
    const out = postbuild.injectPwaHeadLinks(SAMPLE_HTML, '/murodeseos');
    expect(out).toContain('<html lang="es">');
    expect(out.match(/<html[^>]*>/g)).toHaveLength(1);
  });

  it('no inyecta nada si no hay </head>', () => {
    const out = postbuild.injectPwaHeadLinks('<html lang="es"><body></body></html>', '/murodeseos');
    expect(out).toBe('<html lang="es"><body></body></html>');
  });
});
