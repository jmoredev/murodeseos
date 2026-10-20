import { formatPrice } from './format-price';
import { supabase } from './supabase';

/**
 * Cliente de la Edge Function `extract-product` (T5) para el compartir de un producto (T6 de
 * `odd/tasks/compartir-producto.md`).
 *
 * El servidor **siempre responde `200`** a una petición válida, con un cuerpo discriminado:
 * `{ ok: true, draft }` cuando pudo pedir la página y `{ ok: false, reason }` cuando el
 * transporte la bloqueó. Esta capa traduce eso, y nada más: no decide qué hacer con el fallo
 * —eso es del formulario, que se abre igual con el enlace (S2)— y **nunca tira**, porque un
 * fallo al compartir no puede dejar al usuario sin formulario.
 *
 * El contrato del servidor vive en `supabase/functions/extract-product/index.ts`; los tipos de
 * acá son la parte que la app necesita, no una copia del borrador completo.
 */

export type ExtractedProductDraft = {
    title: string | null;
    /** El precio ya formateado con la convención del repo, que es lo que come el formulario. */
    priceText: string | null;
    imageUrl: string | null;
    // Las notas **no** forman parte del borrador: las escribe el usuario. La descripción de la
    // página se extrae igual, pero no es una nota y no se auto-rellena.
};

export type ExtractionResult =
    | { status: 'ok'; draft: ExtractedProductDraft }
    | { status: 'unavailable'; reason: string };

/** Se inyecta en los tests: así el cliente se prueba sin red ni Supabase. */
export type InvokeExtract = (url: string) => Promise<unknown>;

async function invokeExtractProduct(url: string): Promise<unknown> {
    const { data, error } = await supabase.functions.invoke('extract-product', { body: { url } });
    if (error) throw error;
    return data;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

/**
 * Un campo de la cascada es `{ value, source }` o `null`. Se lee `value` y se exige texto con
 * algo dentro: un `''` del servidor es «no se pudo leer» y tiene que llegar como `null` para que
 * no pise nada en el formulario.
 */
function fieldValue(field: unknown): string | null {
    const value = asRecord(field)?.value;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function priceTextOf(price: unknown): string | null {
    const amount = asRecord(price)?.amount;
    if (typeof amount !== 'number') return null;
    return formatPrice(amount);
}

function readDraft(value: unknown): ExtractedProductDraft | null {
    const draft = asRecord(value);
    if (!draft) return null;

    return {
        title: fieldValue(draft.title),
        priceText: priceTextOf(draft.price),
        imageUrl: fieldValue(draft.imageUrl),
    };
}

/**
 * Pide el borrador de una URL de producto.
 *
 * Devuelve `{ status: 'unavailable', reason }` —sin tirar— cuando no hay URL, cuando la llamada
 * falló (red, CORS, error del servidor) o cuando la respuesta no tiene la forma del contrato. El
 * `reason` se conserva para poder explicarlo; el formulario decide qué hacer con él.
 */
export async function requestProductDraft(
    url: string,
    invoke: InvokeExtract = invokeExtractProduct,
): Promise<ExtractionResult> {
    const target = typeof url === 'string' ? url.trim() : '';
    if (!target) return { status: 'unavailable', reason: 'no-url' };

    let response: unknown;
    try {
        response = await invoke(target);
    } catch {
        return { status: 'unavailable', reason: 'request-failed' };
    }

    const body = asRecord(response);
    if (!body) return { status: 'unavailable', reason: 'unexpected' };

    if (body.ok === false) {
        const reason = typeof body.reason === 'string' && body.reason ? body.reason : 'unexpected';
        return { status: 'unavailable', reason };
    }

    const draft = body.ok === true ? readDraft(body.draft) : null;
    if (!draft) return { status: 'unavailable', reason: 'unexpected' };

    return { status: 'ok', draft };
}
