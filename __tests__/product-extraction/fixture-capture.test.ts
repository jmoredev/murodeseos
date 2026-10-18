import { describe, expect, it } from 'vitest';
import { buildBrowserHeaders, decodeHtml, resolveDiscoveredUrl, FIXTURE_SEEDS } from '../../scripts/lib/fixture-capture';

describe('decodeHtml', () => {
    it('decodifica UTF-8 cuando no hay charset declarado', () => {
        const bytes = new TextEncoder().encode('<title>Auriculares Sony WH-1000XM5 — 1.234,56 €</title>');
        expect(decodeHtml(bytes, 'text/html')).toContain('Auriculares Sony WH-1000XM5 — 1.234,56 €');
    });

    it('respeta el charset del Content-Type y conserva las tildes de una página latin-1', () => {
        // `ó` en windows-1252/latin-1 es el byte 0xF3, que en UTF-8 es inválido.
        const bytes = new Uint8Array([0x50, 0x72, 0x65, 0x63, 0x69, 0xf3, 0x6e]);
        expect(decodeHtml(bytes, 'text/html; charset=windows-1252')).toBe('Preción');
        expect(decodeHtml(bytes, 'text/html; charset=ISO-8859-1')).toBe('Preción');
    });

    it('cae a UTF-8 si el charset es desconocido, en vez de tirar', () => {
        const bytes = new TextEncoder().encode('precio');
        expect(decodeHtml(bytes, 'text/html; charset=iso-8859-99')).toBe('precio');
        expect(decodeHtml(bytes, null)).toBe('precio');
    });
});

describe('resolveDiscoveredUrl', () => {
    const listing = '<html><body><a href="/es/product/_altavoz-1542796.html">Echo Dot</a></body></html>';

    it('resuelve un href relativo contra la URL de la lista', () => {
        expect(resolveDiscoveredUrl(listing, 'https://www.mediamarkt.es/es/search.html', '/es/product/_[^"]+')).toBe(
            'https://www.mediamarkt.es/es/product/_altavoz-1542796.html'
        );
    });

    it('acepta una URL absoluta y devuelve el primer grupo de captura si existe', () => {
        const html = '<a href="https://www.ikea.com/es/es/p/mesa-123/">';
        // El `href` del fixture no lleva barra final y el patrón tampoco: se devuelve tal cual,
        // sin normalizar la ruta (las redirecciones las sigue la captura, no este helper).
        expect(
            resolveDiscoveredUrl(html, 'https://www.ikea.com/es/es/', '(https://www\\.ikea\\.com/es/es/p/[a-z0-9-]+)')
        ).toBe('https://www.ikea.com/es/es/p/mesa-123');
    });

    it('devuelve null cuando no hay coincidencia', () => {
        expect(resolveDiscoveredUrl('<html></html>', 'https://x.es/', '/product/_[^"]+')).toBeNull();
    });

    it('rechaza esquemas que no sean http(s), incluido javascript:', () => {
        expect(resolveDiscoveredUrl('<a href="javascript:alert(1)">', 'https://x.es/', 'javascript:[^"]+')).toBeNull();
        expect(resolveDiscoveredUrl('<a href="/p/1">', 'ftp://x.es/f', '/p/[0-9]+')).toBeNull();
    });
});

describe('buildBrowserHeaders', () => {
    it('manda los headers que destraban las tiendas que responden 403 sin ellos', () => {
        const headers = buildBrowserHeaders();
        expect(headers['accept-language']).toMatch(/^es-ES/);
        expect(headers['user-agent']).toMatch(/Mozilla\/5\.0/);
        expect(headers['accept']).toContain('text/html');
        expect(headers['sec-fetch-mode']).toBe('navigate');
        expect(headers['upgrade-insecure-requests']).toBe('1');
    });
});

describe('FIXTURE_SEEDS', () => {
    it('no repite ids y usa https en todas las URLs', () => {
        const ids = FIXTURE_SEEDS.map((seed) => seed.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const seed of FIXTURE_SEEDS) {
            expect(seed.url.startsWith('https://')).toBe(true);
            if (seed.discover) expect(seed.discover.from.startsWith('https://')).toBe(true);
        }
    });
});
