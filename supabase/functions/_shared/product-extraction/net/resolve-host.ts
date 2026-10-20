import type { ResolveHost } from './safe-fetch.ts';

/** Familia de registro DNS que interesa para contrastar una URL. */
export type DnsRecordType = 'A' | 'AAAA';

/**
 * Firma inyectable de resolución por familia. La Edge Function la satisface con
 * `Deno.resolveDns`; los tests, con un doble que no toca la red.
 */
export type ResolveDnsFn = (host: string, type: DnsRecordType) => Promise<string[]>;

/**
 * Resolvedor de DNS de la Edge Function, como **fábrica con la resolución inyectada**.
 *
 * `safeFetch` (T4) acepta un `resolveHost` para cerrar el SSRF basado en DNS: cada dirección que
 * devuelve se contrasta contra `blockedIpReason`. Esta es la mitad que se puede probar en Node
 * sin red —recibe una función por familia y decide— y la Edge Function la cablea con
 * `Deno.resolveDns`.
 *
 * Garantías:
 *
 * - Pide `A` y `AAAA` a la vez: una familia lenta no frena a la otra.
 * - **Fallo cerrado**: si no queda ninguna dirección, tira. `safeFetch` convierte ese throw en
 *   `dns-failed`, así que un nombre que no resuelve no se llega a pedir.
 * - Que una familia falle **no** invalida la otra: una tienda puede no publicar IPv6, y las
 *   direcciones que sí llegaron alcanzan para contrastar (bloquear por eso perdería tiendas
 *   reales). Solo se tira cuando *ninguna* familia dio direcciones.
 */
export function createResolveHost(resolveDns: ResolveDnsFn): ResolveHost {
    return async (host) => {
        const [a, aaaa] = await Promise.allSettled([resolveDns(host, 'A'), resolveDns(host, 'AAAA')]);

        const direcciones = [
            ...(a.status === 'fulfilled' ? a.value : []),
            ...(aaaa.status === 'fulfilled' ? aaaa.value : []),
        ];

        if (direcciones.length === 0) {
            throw new Error(`No se pudo resolver «${host}»: ninguna familia devolvió direcciones.`);
        }

        return direcciones;
    };
}
