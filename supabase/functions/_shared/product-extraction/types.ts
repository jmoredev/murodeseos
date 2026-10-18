/**
 * Contrato del núcleo de extracción de una página de producto.
 *
 * La cascada es **campo por campo**, no «gana la primera capa que traiga algo»: el título puede
 * venir de JSON-LD y la imagen de Open Graph en la misma página. Por eso cada campo viaja con su
 * `source` (procedencia) y el precio además con `ambiguous` (si la lectura dependió de una
 * convención) y `raw` (el texto tal cual, para poder enseñarlo).
 *
 * Un campo en `null` significa «no se pudo leer», no «no existe»: el deseo se crea igual y el
 * usuario lo completa a mano (S5). Los `notes` guardan el motivo honesto de lo que faltó.
 */

/** De dónde salió un campo. El orden de esta unión es el orden de prioridad de la cascada. */
export type FieldSource = 'json-ld' | 'open-graph' | 'microdata' | 'heuristic';

export type Field<T> = {
    value: T;
    source: FieldSource;
};

export type DraftPrice = {
    amount: number;
    /** Código ISO 4217, o `null` si no se puede saber (un `$` suelto es USD, ARS, MXN…). */
    currency: string | null;
    ambiguous: boolean;
    /** El texto tal como lo declaró la página. */
    raw: string;
    source: FieldSource;
};

export type ProductDraft = {
    url: string;
    title: Field<string> | null;
    price: DraftPrice | null;
    imageUrl: Field<string> | null;
    siteName: Field<string> | null;
    description: Field<string> | null;
    notes: string[];
};
