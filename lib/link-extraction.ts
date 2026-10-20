import { normalizeWishLink } from './wish-link-utils';

/**
 * Extraer los datos de un enlace **pegado en el formulario** (T9 de
 * `odd/tasks/compartir-producto.md`), sin guardar el deseo.
 *
 * Reusa el mismo extractor que la hoja de compartir (`requestProductDraft` → Edge Function de
 * T5), así que aquí solo vive la parte que decide **cuándo vale la pena preguntar**. Importa
 * porque cada pregunta gasta cuota del usuario y sale a la red: una regla generosa dispararía
 * una extracción por cada tecla.
 */

/**
 * Cuánto se espera desde el último cambio del campo antes de pedir la página.
 *
 * Un pegado llega de una sola vez y esto solo agrega una pausa imperceptible; escribir a mano
 * espera a que la persona deje de teclear. Sin esta pausa, la URL se dispararía en cada prefijo
 * («https://tienda.com» es válido y casi nunca es la página del producto).
 */
export const LINK_EXTRACTION_DELAY_MS = 700;

/** Un esquema explícito al principio: `https:`, `mailto:`, `javascript:`, `ftp:`… */
const CON_ESQUEMA = /^[a-z][a-z0-9+.-]*:/i;
const HTTP = /^https?:/i;

/**
 * El enlace que se puede pedir, ya normalizado, o `null` si no hay nada que pedir.
 *
 * La normalización es la misma del guardado (`normalizeWishLink`: agrega `https://` cuando falta),
 * para que lo que se extrae sea exactamente lo que se va a guardar.
 */
export function extractableLink(value: string): string | null {
    const recortado = typeof value === 'string' ? value.trim() : '';
    if (!recortado) return null;

    // Otro esquema no se convierte en un host: `mailto:a@b.c` con `https://` delante se parsea
    // como usuario `mailto:a` y host `b.c`, una URL perfectamente válida y ajena a lo que se pegó.
    if (CON_ESQUEMA.test(recortado) && !HTTP.test(recortado)) return null;

    const normalizado = normalizeWishLink(recortado);
    if (!normalizado) return null;

    let url: URL;
    try {
        url = new URL(normalizado);
    } catch {
        return null;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    // Un host de una sola etiqueta no es un producto en internet: es un host interno o un tecleo
    // a medias. La guarda SSRF del servidor lo bloquearía igual, pero no vale la pena la llamada.
    if (!url.hostname.includes('.')) return null;

    return normalizado;
}
