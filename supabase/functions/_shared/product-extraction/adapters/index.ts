import { amazonAdapter } from './amazon.ts';
import type { DomainAdapter } from './types.ts';

/**
 * Registro de adaptadores por dominio.
 *
 * No es un diccionario `host → adaptador` porque un mismo adaptador cubre decenas de locales
 * (todos los Amazon comparten marcado): cada adaptador **declara qué hosts reclama** y gana el
 * primero que responda. Solo se mira el host, nunca la ruta ni el contenido.
 *
 * Un host que ningún adaptador reclama devuelve `null` y la cascada genérica sigue intacta.
 */
const ADAPTADORES: readonly DomainAdapter[] = [amazonAdapter];

/** Adaptador que reclama el host de `url`, o `null` si ninguno lo hace. */
export function findAdapter(url: string): DomainAdapter | null {
    const host = hostDe(url);
    if (host === null) return null;
    return ADAPTADORES.find((adaptador) => adaptador.claimsHost(host)) ?? null;
}

/** Host en minúsculas y sin `www.`, que es como comparan los adaptadores. `null` si no es URL. */
function hostDe(url: string): string | null {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host.startsWith('www.') ? host.slice(4) : host;
    } catch {
        return null;
    }
}

export type { DomainAdapter, DomainAdapterFields } from './types.ts';
