import { parseSharedPayload, type SharedPayload } from './share-target';

/**
 * El puente entre un compartir y el formulario de deseo (T6 de
 * `odd/tasks/compartir-producto.md`).
 *
 * El compartir viaja en **dos saltos**: el service worker lo deja en Cache Storage y la ruta
 * `/compartir` lo lee (por eso Cache Storage y no `sessionStorage`). Desde ahí, la app puede
 * tardar en llegar al formulario —el usuario tiene que iniciar sesión, o la extracción de la
 * página tarda—, así que el segundo salto va en `sessionStorage`: **sobrevive al login** y muere
 * con la pestaña, que es exactamente la vida de un compartir que se está usando.
 */

/** Clave del compartir pendiente. Con prefijo propio para no chocar con nada del navegador. */
export const PENDING_SHARE_KEY = 'murodeseos:pending-share';

/**
 * Clave del **borrador** pendiente, que es otra cosa que un compartir.
 *
 * La escribe la pantalla del enlace (`/wishlist/add`) cuando ya decidió si hay enlace y qué se
 * pudo leer de la página. Es un espacio independiente a propósito: un compartir del sistema y
 * un borrador de esa pantalla no se pisan, y cada uno tiene su propia política de consumo.
 */
export const PENDING_DRAFT_KEY = 'murodeseos:pending-wish-draft';

/** Los campos del formulario que un compartir puede prellenar. */
export type WishDraftFields = {
    title?: string;
    notes?: string;
    imageUrl?: string;
    links?: string[];
    priceText?: string;
    /** Moneda ISO 4217 que trajo la extracción, si la página la declaraba. */
    currency?: string | null;
};

const DRAFT_FIELDS = ['title', 'notes', 'imageUrl', 'links', 'priceText', 'currency'] as const;

/** Guarda el compartir para el siguiente montaje del formulario. */
export function savePendingShare(payload: SharedPayload): void {
    try {
        sessionStorage?.setItem(PENDING_SHARE_KEY, JSON.stringify(payload));
    } catch {
        // Sin almacenamiento el compartir se pierde, pero la app no se rompe: el usuario abre
        // el formulario a mano, que es el comportamiento de antes de esta funcionalidad.
    }
}

/**
 * Devuelve el compartir pendiente y lo borra.
 *
 * Se borra **antes** de validar: un pendiente corrupto no se arregla reintentando, y dejarlo
 * ahí haría que cada apertura fallara igual.
 */
export function takePendingShare(): SharedPayload | null {
    let raw: string | null;
    try {
        // La comprobación va **dentro** del `try` a propósito: con el almacenamiento bloqueado
        // (iframe de terceros, cookies desactivadas) **acceder** a `sessionStorage` lanza
        // `SecurityError`, y eso es un fallo de almacenamiento como cualquier otro: aquí se
        // degrada a «no hay nada pendiente» en vez de tumbar la pantalla que llama.
        if (typeof sessionStorage === 'undefined' || !sessionStorage) return null;

        raw = sessionStorage.getItem(PENDING_SHARE_KEY);
        if (raw === null) return null;
        sessionStorage.removeItem(PENDING_SHARE_KEY);
    } catch {
        return null;
    }

    try {
        return parseSharedPayload(JSON.parse(raw));
    } catch {
        return null;
    }
}

/**
 * Guarda el borrador que abrirá el formulario en su siguiente montaje.
 *
 * Acepta `{}` y eso es un caso de uso, no un descuido: significa «abre el formulario vacío»
 * (botón «No tengo enlace»), que es distinto de no tener nada pendiente.
 */
export function savePendingDraft(fields: WishDraftFields): void {
    try {
        sessionStorage?.setItem(PENDING_DRAFT_KEY, JSON.stringify(fields));
    } catch {
        // Sin almacenamiento el borrador se pierde, pero el formulario se abre igual: el
        // usuario completa a mano, que es el comportamiento de antes de esta pantalla.
    }
}

function asDraftRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

/**
 * Devuelve el borrador pendiente y lo borra.
 *
 * Misma política que `takePendingShare`: se borra **antes** de validar, porque un pendiente
 * corrupto no se arregla reintentando y dejarlo ahí haría que cada apertura fallara igual.
 * La diferencia es que un objeto vacío sí es un borrador válido: es el que deja «No tengo
 * enlace».
 */
export function takePendingDraft(): WishDraftFields | null {
    let raw: string | null;
    try {
        // Misma razón que en `takePendingShare`: acceder a `sessionStorage` puede lanzar, y eso
        // se comporta igual que un almacenamiento vacío.
        if (typeof sessionStorage === 'undefined' || !sessionStorage) return null;

        raw = sessionStorage.getItem(PENDING_DRAFT_KEY);
        if (raw === null) return null;
        sessionStorage.removeItem(PENDING_DRAFT_KEY);
    } catch {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }

    const record = asDraftRecord(parsed);
    if (!record) return null;

    // Se copia campo a campo y con el tipo comprobado: esto viene de `sessionStorage`, o sea
    // de fuera del programa, y el formulario no puede recibir un `title` numérico.
    const draft: WishDraftFields = {};
    for (const field of DRAFT_FIELDS) {
        const value = record[field];
        if (value === undefined) continue;

        if (field === 'links') {
            if (Array.isArray(value) && value.every((link) => typeof link === 'string')) {
                draft.links = [...value] as string[];
            }
            continue;
        }

        if (typeof value === 'string') draft[field] = value;
    }

    return draft;
}

/**
 * El borrador **inmediato** que se puede armar sin red: título y enlace.
 *
 * Sin enlace, el texto compartido pasa a ser el título porque es lo único que hay (el usuario
 * compartió un nombre, no una página). Con enlace **no** se usa el texto como título: las apps
 * de compras lo rellenan con «Mira esto https://…», y eso escrito en el deseo es peor que
 * vacío. El título lo trae la extracción.
 */
export function draftFromShare(payload: SharedPayload): WishDraftFields {
    const title = (payload.title || (payload.url ? '' : payload.text)).trim();

    return {
        title,
        links: payload.url ? [payload.url] : [],
    };
}

function isEmptyDraftValue(value: WishDraftFields[keyof WishDraftFields]): boolean {
    if (value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    return value === '';
}

function sameDraftValue(
    a: WishDraftFields[keyof WishDraftFields],
    b: WishDraftFields[keyof WishDraftFields],
): boolean {
    if (Array.isArray(a) || Array.isArray(b)) {
        return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
    }
    return (a ?? '') === (b ?? '');
}

/**
 * Aplica lo que leyó la extracción **sin pisar lo que el usuario ya escribió**.
 *
 * La extracción tarda (una petición a la red) y el formulario se abre al instante, así que hay
 * una ventana real en la que el usuario puede estar escribiendo. Un campo se rellena solo si
 * sigue exactamente como lo dejó el compartir (`prefilled`); si cambió, es del usuario. Un campo
 * vacío en la extracción nunca borra nada.
 */
export function mergeUntouchedWishFields({
    current,
    prefilled,
    extracted,
}: {
    current: WishDraftFields;
    prefilled: WishDraftFields;
    extracted: WishDraftFields;
}): WishDraftFields {
    const next: WishDraftFields = { ...current };

    for (const field of DRAFT_FIELDS) {
        const value = extracted[field];
        if (isEmptyDraftValue(value)) continue;
        if (!sameDraftValue(current[field], prefilled[field])) continue;
        // El índice y el valor vienen del mismo bucle, así que el tipo es el del campo.
        (next as Record<string, WishDraftFields[keyof WishDraftFields]>)[field] = value;
    }

    return next;
}
