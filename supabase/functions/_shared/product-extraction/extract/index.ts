import { findAdapter } from '../adapters/index.ts';
import type { DomainAdapterFields } from '../adapters/types.ts';
import { detectCurrency, parsePriceText } from '../normalize/price.ts';
import type { DraftPrice, Field, FieldSource, ProductDraft } from '../types.ts';
import { extractHeuristics, normalizeTitle, type HeuristicFields } from './heuristics.ts';
import { extractJsonLd, type JsonLdProduct } from './json-ld.ts';
import { extractMicrodata, type MicrodataFields } from './microdata.ts';
import { extractOpenGraph, type OpenGraphFields } from './open-graph.ts';

/**
 * El núcleo de extracción: una página de producto entra, un borrador de deseo sale.
 *
 * La cascada es **campo por campo** y no «gana la primera capa que traiga algo»: una tienda puede
 * declarar el título en JSON-LD y no publicar `product:price`, y en la misma página el precio
 * está en una metaetiqueta de Open Graph. El orden de prioridad es
 * `domain-adapter > json-ld > open-graph > microdata > heurística` para cada campo por separado.
 *
 * El adaptador por dominio va **primero** porque está calibrado contra el marcado de su host:
 * donde habla, gana; donde devuelve `null`, la cascada genérica sigue como si no existiera.
 *
 * Garantías duras:
 *
 * - **Nunca tira**, con ninguna entrada (HTML vacío, basura, `url` que no se puede resolver).
 *   Un deseo sin datos es mejor que un fallo al compartir; cada extractor va aislado por si uno
 *   se rompe con un HTML raro.
 * - **Siempre devuelve la `url`** con la que se llamó.
 * - La imagen sale **absoluta** (`new URL(value, url)`) y solo `http(s)`; una imagen que no se
 *   puede resolver no invalida el borrador, simplemente baja a la capa siguiente.
 */

const OG_VACIO: OpenGraphFields = {
    title: null,
    image: null,
    price: null,
    currency: null,
    siteName: null,
    description: null
};

const MICRODATA_VACIO: MicrodataFields = { name: null, price: null, currency: null, image: null };

const HEURISTICA_VACIA: HeuristicFields = {
    title: null,
    description: null,
    price: null,
    currency: null,
    priceNote: null
};

const ADAPTADOR_VACIO: DomainAdapterFields = {
    title: null,
    price: null,
    currency: null,
    image: null
};

export function extractProduct({ html, url }: { html: string; url: string }): ProductDraft {
    const draft: ProductDraft = {
        url,
        title: null,
        price: null,
        imageUrl: null,
        siteName: null,
        description: null,
        notes: []
    };

    try {
        const pagina = typeof html === 'string' ? html : '';

        // El adaptador por dominio corre antes que todo lo demás y aporta campo por campo. Si su
        // host no coincide o su HTML cambió, devuelve `null` en cada campo y no cambia nada.
        const adaptador = intentar(() => findAdapter(url), null);
        const adaptado = adaptador
            ? intentar(() => adaptador.extract(pagina), ADAPTADOR_VACIO)
            : ADAPTADOR_VACIO;

        const jsonLd = intentar(() => extractJsonLd(pagina), null);
        const graph = intentar(() => extractOpenGraph(pagina), OG_VACIO);
        const microdata = intentar(() => extractMicrodata(pagina), MICRODATA_VACIO);
        const heuristica = intentar(() => extractHeuristics(pagina), HEURISTICA_VACIA);

        // El nombre del sitio es lo que el usuario ve como «tienda». `og:site_name` es la única
        // fuente que significa eso; el `brand` del JSON-LD solo se usa si la página no lo publica
        // (El Corte Inglés no lo publica y aun así declara su marca).
        draft.siteName = graph.siteName
            ? { value: graph.siteName, source: 'open-graph' }
            : jsonLd?.brand
              ? { value: jsonLd.brand, source: 'json-ld' }
              : null;

        draft.title = primerTitulo(adaptado, jsonLd, graph, microdata, heuristica, draft.siteName?.value ?? null);
        draft.description = primerTexto([
            [jsonLd?.description ?? null, 'json-ld'],
            [graph.description, 'open-graph'],
            [heuristica.description, 'heuristic']
        ]);
        // La imagen **solo** de fuentes declaradas: no hay capa heurística de imagen a propósito
        // (ver `heuristics.ts`: en una página que no declara la foto, la imagen más grande del
        // HTML es una miniatura de reseña, un sprite de navegación o una URL armada con texto de
        // un `<script>`, y una foto equivocada es peor que ninguna).
        draft.imageUrl = primeraImagen(
            [
                [adaptado.image, 'domain-adapter'],
                [jsonLd?.image ?? null, 'json-ld'],
                [graph.image, 'open-graph'],
                [microdata.image, 'microdata']
            ],
            url
        );

        let notaDePrecio = heuristica.priceNote;
        for (const [raw, declarada, source] of candidatosDePrecio(adaptado, jsonLd, graph, microdata, heuristica)) {
            if (raw === null || raw === undefined) continue;

            const leido = parsePriceText(raw);
            if (!leido) {
                // La capa declaró un precio que no se puede leer (un rango, un formato raro): se
                // guarda el motivo y se sigue bajando, porque otra capa puede traerlo mejor.
                notaDePrecio ??= `El precio no se pudo interpretar: «${String(raw)}».`;
                continue;
            }

            const precio: DraftPrice = {
                amount: leido.amount,
                currency: detectCurrency({ declared: declarada, text: leido.raw }) ?? leido.currency,
                ambiguous: leido.ambiguous,
                raw: leido.raw,
                source
            };
            draft.price = precio;
            notaDePrecio = null;
            break;
        }

        if (draft.price === null) {
            draft.notes.push(notaDePrecio ?? 'No se encontró el precio en la página.');
        }
        if (draft.imageUrl === null) {
            draft.notes.push('No se encontró la imagen en la página.');
        }
    } catch {
        // Red de seguridad: la extracción nunca puede romper la creación del deseo.
    }

    return draft;
}

function intentar<T>(fn: () => T, porDefecto: T): T {
    try {
        return fn();
    } catch {
        return porDefecto;
    }
}

function candidatosDePrecio(
    adaptado: DomainAdapterFields,
    jsonLd: JsonLdProduct | null,
    graph: OpenGraphFields,
    microdata: MicrodataFields,
    heuristica: HeuristicFields
): [string | number | null, string | null, FieldSource][] {
    return [
        [adaptado.price, adaptado.currency, 'domain-adapter'],
        [jsonLd?.price ?? null, jsonLd?.currency ?? null, 'json-ld'],
        [graph.price, graph.currency, 'open-graph'],
        [microdata.price, microdata.currency, 'microdata'],
        [heuristica.price, heuristica.currency, 'heuristic']
    ];
}

function primerTitulo(
    adaptado: DomainAdapterFields,
    jsonLd: JsonLdProduct | null,
    graph: OpenGraphFields,
    microdata: MicrodataFields,
    heuristica: HeuristicFields,
    siteName: string | null
): Field<string> | null {
    const candidatos: [string | null, FieldSource][] = [
        [adaptado.title, 'domain-adapter'],
        [jsonLd?.title ?? null, 'json-ld'],
        [graph.title, 'open-graph'],
        [microdata.name, 'microdata'],
        [heuristica.title, 'heuristic']
    ];

    for (const [raw, source] of candidatos) {
        if (!raw) continue;
        const value = normalizeTitle(raw, siteName);
        if (value !== '') return { value, source };
    }

    return null;
}

function primerTexto(candidatos: [string | null, FieldSource][]): Field<string> | null {
    for (const [raw, source] of candidatos) {
        if (raw) return { value: raw, source };
    }
    return null;
}

function primeraImagen(
    candidatos: [string | null, FieldSource][],
    base: string
): Field<string> | null {
    for (const [raw, source] of candidatos) {
        if (!raw) continue;
        const value = resolverImagen(raw, base);
        if (value) return { value, source };
    }
    return null;
}

/** Absolutiza la imagen contra la URL de la página y descarta lo que no sea `http(s)`. */
function resolverImagen(valor: string, base: string): string | null {
    try {
        const url = new URL(valor, base);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return url.href;
    } catch {
        return null;
    }
}
