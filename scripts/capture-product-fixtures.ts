/**
 * Captura fixtures de páginas de producto reales para los tests de extracción.
 *
 * Uso:
 *   npx tsx scripts/capture-product-fixtures.ts                 # todas las semillas
 *   npx tsx scripts/capture-product-fixtures.ts --only=zara-es  # una o varias (separadas por coma)
 *   npx tsx scripts/capture-product-fixtures.ts --max-bytes=8000000 --delay-ms=1500
 *
 * Qué escribe, en `test/fixtures/product-pages/`:
 *   `<id>.html.gz`   la página **completa** comprimida (página entera, sin recortar)
 *   `manifest.json`  un registro por id: URL pedida, URL final, estado, tamaño, sha256 y motivo
 *
 * Por qué comprimida y entera: recortar el HTML (por ejemplo, quedarse con el `<head>`)
 * perdería los JSON-LD que muchas tiendas escriben al final del `<body>`, que es justo lo que
 * la cascada lee. Entera y comprimida ocupa ~15-25% del original y no hay reconstrucción
 * sintética de por medio.
 *
 * Semántica del manifiesto: `ok` significa **se congeló un fixture**, no «la página sirvió».
 * Un 403 de Cloudflare y una cáscara de SPA **también** se congelan: son testigos negativos
 * del comportamiento que hay que aguantar. `failure` dice por qué ese fixture no es una página
 * útil, y `sha256` es el de los bytes **antes** de comprimir (descomprimir el `.html.gz` y
 * hashear debe dar ese valor).
 *
 * También hace de barrera de cortesía: una petición por semilla, con pausa, y nunca reintenta.
 * No corre en CI (la suite unitaria no toca la red).
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import {
    FIXTURE_SEEDS,
    buildBrowserHeaders,
    decodeHtml,
    fixtureFileName,
    resolveDiscoveredUrl,
    type FixtureManifest,
    type FixtureRecord,
    type FixtureSeed,
} from './lib/fixture-capture';

const OUT_DIR = path.join('test', 'fixtures', 'product-pages');

const DEFAULT_MAX_BYTES = 8_000_000;
const DEFAULT_DELAY_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 30_000;

type Options = {
    only: string[] | null;
    maxBytes: number;
    delayMs: number;
    timeoutMs: number;
    outDir: string;
};

function parseOptions(argv: string[]): Options {
    const value = (name: string): string | null => {
        const prefixed = argv.find((arg) => arg.startsWith(`--${name}=`));
        if (prefixed) return prefixed.slice(name.length + 3);
        const index = argv.indexOf(`--${name}`);
        return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
    };

    const only = value('only');
    const number = (name: string, fallback: number): number => {
        const raw = value(name);
        if (!raw) return fallback;
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    return {
        only: only ? only.split(',').map((id) => id.trim()).filter(Boolean) : null,
        maxBytes: number('max-bytes', DEFAULT_MAX_BYTES),
        delayMs: number('delay-ms', DEFAULT_DELAY_MS),
        timeoutMs: number('timeout-ms', DEFAULT_TIMEOUT_MS),
        outDir: value('out') ?? OUT_DIR,
    };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** SHA-256 del HTML decodificado (los bytes que hay **antes** de comprimir). */
function sha256Of(html: string): string {
    return createHash('sha256').update(Buffer.from(html, 'utf8')).digest('hex');
}

type CappedBody = { bytes: Uint8Array; truncated: boolean };

/**
 * Lee el cuerpo con tope. Un `response.arrayBuffer()` a secas acepta cualquier tamaño, y una
 * página que empiece a mandar gigabytes dejaría la captura colgada sin límite.
 */
async function readCapped(response: Response, maxBytes: number): Promise<CappedBody> {
    const reader = response.body?.getReader();
    if (!reader) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        return { bytes, truncated: false };
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    let truncated = false;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        if (total + value.length > maxBytes) {
            chunks.push(value.subarray(0, maxBytes - total));
            truncated = true;
            await reader.cancel();
            break;
        }

        chunks.push(value);
        total += value.length;
    }

    const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }

    return { bytes, truncated };
}

async function fetchWithHeaders(url: string, options: Options): Promise<Response> {
    return fetch(url, {
        headers: buildBrowserHeaders(),
        redirect: 'follow',
        signal: AbortSignal.timeout(options.timeoutMs),
    });
}

/** Resuelve la URL del producto: la semilla, o la primera coincidencia en su listado. */
async function resolveProductUrl(seed: FixtureSeed, options: Options): Promise<{ url: string } | { failure: string }> {
    if (!seed.discover) return { url: seed.url };

    let response: Response;
    try {
        response = await fetchWithHeaders(seed.discover.from, options);
    } catch (error) {
        return { failure: `discovery-network: ${describeError(error)}` };
    }

    if (!response.ok) return { failure: `discovery-http-${response.status}` };

    const html = decodeHtml(new Uint8Array(await response.arrayBuffer()), response.headers.get('content-type'));
    const discovered = resolveDiscoveredUrl(html, response.url || seed.discover.from, seed.discover.pattern);

    // El descubrimiento es una petición **más** a la tienda: se paga la cortesía también acá.
    await sleep(options.delayMs);

    return discovered ? { url: discovered } : { failure: 'discovery-no-match' };
}

function describeError(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
}

async function captureSeed(seed: FixtureSeed, options: Options): Promise<FixtureRecord> {
    const base: FixtureRecord = {
        id: seed.id,
        shop: seed.shop,
        url: seed.url,
        finalUrl: null,
        capturedAt: new Date().toISOString(),
        status: null,
        ok: false,
        bytes: 0,
        sha256: null,
        charset: null,
        failure: null,
    };

    const resolved = await resolveProductUrl(seed, options);
    if ('failure' in resolved) return { ...base, failure: resolved.failure };

    let response: Response;
    try {
        response = await fetchWithHeaders(resolved.url, options);
    } catch (error) {
        return { ...base, failure: `network: ${describeError(error)}` };
    }

    const contentType = response.headers.get('content-type');
    const { bytes, truncated } = await readCapped(response, options.maxBytes);
    const html = decodeHtml(bytes, contentType);

    await writeFile(path.join(options.outDir, fixtureFileName(seed.id)), gzipSync(Buffer.from(html, 'utf8')));

    return {
        ...base,
        finalUrl: response.url || resolved.url,
        status: response.status,
        ok: true,
        bytes: bytes.length,
        sha256: sha256Of(html),
        charset: contentType,
        failure: truncated
            ? `truncated-at-${options.maxBytes}`
            : response.ok
              ? null
              : `http-${response.status}`,
    };
}

/** Fusiona con el manifiesto anterior: una captura parcial no borra los fixtures ya congelados. */
async function readPreviousManifest(outDir: string): Promise<FixtureManifest | null> {
    try {
        return JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8')) as FixtureManifest;
    } catch {
        return null;
    }
}

function printSummary(records: FixtureRecord[]): void {
    for (const record of records) {
        const state = record.ok ? `ok  ${String(record.status ?? '-')}` : 'FALLA';
        const size = `${(record.bytes / 1024).toFixed(0)} KB`;
        console.log(`${record.id.padEnd(20)} ${state.padEnd(9)} ${size.padStart(8)}  ${record.failure ?? ''}`);
    }
}

async function main(): Promise<void> {
    const options = parseOptions(process.argv.slice(2));
    const seeds = options.only ? FIXTURE_SEEDS.filter((seed) => options.only?.includes(seed.id)) : FIXTURE_SEEDS;

    if (seeds.length === 0) {
        console.error('No hay semillas que capturar: revisá --only.');
        process.exitCode = 1;
        return;
    }

    await mkdir(options.outDir, { recursive: true });
    const previous = await readPreviousManifest(options.outDir);

    console.log(`Capturando ${seeds.length} fixture(s) en ${options.outDir} …`);
    const captured: FixtureRecord[] = [];

    for (const seed of seeds) {
        const record = await captureSeed(seed, options);
        captured.push(record);
        printSummary([record]);
        await sleep(options.delayMs);
    }

    const merged = new Map<string, FixtureRecord>();
    for (const record of previous?.fixtures ?? []) merged.set(record.id, record);
    for (const record of captured) merged.set(record.id, record);

    const manifest: FixtureManifest = {
        format: 'html.gz',
        capturedAt: new Date().toISOString(),
        fixtures: [...merged.values()],
    };

    await writeFile(path.join(options.outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 4)}\n`);

    const written = captured.filter((record) => record.ok).length;
    console.log(`\n${written}/${seeds.length} fixture(s) escritos en esta corrida.`);
    if (written === 0) {
        console.error('Ningún fixture se pudo escribir: eso es un fallo, no una lista vacía.');
        process.exitCode = 1;
    }
}

// Sin top-level await: `tsx` compila a CJS (el `package.json` no declara `"type": "module"`) y
// ahí el await de nivel superior no existe. El error se ve igual, con código distinto de cero.
main().catch((error: unknown) => {
    console.error('La captura falló:', error);
    process.exitCode = 1;
});
