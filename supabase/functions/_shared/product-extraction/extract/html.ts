/**
 * Único punto de contacto con `node-html-parser`.
 *
 * El aislamiento es deliberado: la Edge Function corre en **Deno**, donde el especificador de
 * este import puede tener que ser `npm:node-html-parser` en lugar del nombre pelado
 * `node-html-parser`. Con el import concentrado acá, T5 cambia esa única línea en vez de
 * refactorizar todos los adaptadores.
 *
 * Los selectores aceptan el HTML crudo **o** un documento ya parseado (`parseHtml`): un
 * adaptador que necesita varios nodos parsea la página una sola vez y reparte el documento,
 * porque una página de tienda real puede pesar megabytes.
 */
import { parse, type HTMLElement } from 'node-html-parser';

export type HtmlDocument = HTMLElement;
export type HtmlNode = HTMLElement;

/** Parsea el HTML a un documento consultable. Nunca tira: un HTML raro no rompe la extracción. */
export function parseHtml(html: string): HtmlDocument {
    return parse(typeof html === 'string' ? html : '');
}

/** Todos los nodos que casan con el selector, en orden de documento. */
export function selectAll(html: string | HtmlDocument, selector: string): HTMLElement[] {
    const document = typeof html === 'string' ? parseHtml(html) : html;
    return document.querySelectorAll(selector);
}

/** El primer nodo que casa, o `null`. */
export function selectOne(html: string | HtmlDocument, selector: string): HTMLElement | null {
    const document = typeof html === 'string' ? parseHtml(html) : html;
    return document.querySelector(selector) ?? null;
}

/** Texto del nodo con las entidades ya resueltas; `''` si el nodo no existe. */
export function textOf(node: HtmlNode | null): string {
    return node?.text ?? '';
}

/** Valor de un atributo, o `null` si el nodo o el atributo no existen. */
export function attributeOf(node: HtmlNode | null, name: string): string | null {
    if (!node) return null;
    return node.getAttribute(name) ?? null;
}
