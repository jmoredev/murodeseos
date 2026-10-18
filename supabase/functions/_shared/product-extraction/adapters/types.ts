/**
 * Contrato de un adaptador por dominio.
 *
 * Un adaptador es una capa más de la cascada, y la de **mayor precedencia** cuando su host
 * coincide: está calibrado contra el marcado de esa tienda, así que donde habla gana. No es un
 * reemplazo de la cascada, sino un aporte campo por campo: un campo en `null` deja que las capas
 * genéricas sigan como siempre.
 *
 * Garantía dura: **nunca tira**. Si la tienda cambió su HTML y el ancla ya no está, el adaptador
 * devuelve `null` en ese campo y la extracción continúa.
 */

export type DomainAdapterFields = {
    title: string | null;
    price: string | null;
    currency: string | null;
    image: string | null;
};

export type DomainAdapter = {
    /** Nombre estable para telemetría y para leer los tests. */
    name: string;
    /** `true` si reclama este host. El host llega en minúsculas y sin `www.`. */
    claimsHost: (host: string) => boolean;
    /** Campos que el adaptador reconoce; los que no, van en `null`. */
    extract: (html: string) => DomainAdapterFields;
};
