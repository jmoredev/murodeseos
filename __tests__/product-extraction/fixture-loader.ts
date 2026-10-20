import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

/**
 * Carga de los fixtures de páginas de producto **sin red**.
 *
 * El fixture es la página entera comprimida con gzip (`<id>.html.gz`) y el manifiesto guarda el
 * `sha256` de los bytes **antes** de comprimir. Ese hash es lo que convierte al fixture en
 * evidencia: si alguien lo toca a mano, el test de integridad se cae.
 */

const DIRECTORIO = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'test',
    'fixtures',
    'product-pages'
);

export type FixtureManifestEntry = {
    id: string;
    shop: string;
    url: string;
    finalUrl: string | null;
    status: number | null;
    ok: boolean;
    bytes: number;
    sha256: string | null;
    charset: string | null;
    failure: string | null;
};

export type FixtureManifest = {
    format: string;
    capturedAt: string;
    fixtures: FixtureManifestEntry[];
};

export function loadManifest(): FixtureManifest {
    return JSON.parse(readFileSync(path.join(DIRECTORIO, 'manifest.json'), 'utf8')) as FixtureManifest;
}

/** Bytes **descomprimidos**: los mismos que verifica el `sha256` del manifiesto. */
export function loadFixtureBytes(id: string): Buffer {
    return gunzipSync(readFileSync(path.join(DIRECTORIO, `${id}.html.gz`)));
}

export function loadFixtureHtml(id: string): string {
    return loadFixtureBytes(id).toString('utf8');
}

export function sha256(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
}

/** URL con la que se prueba el extractor: la final tras redirecciones, si la captura la guardó. */
export function fixtureUrl(entry: FixtureManifestEntry): string {
    return entry.finalUrl ?? entry.url;
}
