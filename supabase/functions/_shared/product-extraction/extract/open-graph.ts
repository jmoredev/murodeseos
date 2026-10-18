import { collapseWhitespace, decodeHtmlEntities, parseAttributes } from './text.ts';

/**
 * Lectura de Open Graph / Twitter cards y de las metaetiquetas de producto.
 *
 * La medición de las páginas reales fija dos tolerancias que no se pueden dar por hechas:
 *
 * 1. **La clave puede ir en `property=` o en `name=`.** Lo correcto para `og:*` es `property=`,
 *    pero IKEA publica `og:title` con `name=`, así que se miran las dos y gana `property=`.
 * 2. **El orden de los atributos y el tipo de comillas son libres.** La regex de `parseAttributes`
 *    los lee igual.
 *
 * `description` entra acá además de en la heurística porque la metaetaqueta normal
 * (`name="description"`) es la misma que leen casi todas las tiendas y no tiene sentido esperar a
 * la última capa para leerla.
 */

export type OpenGraphFields = {
    title: string | null;
    image: string | null;
    price: string | null;
    currency: string | null;
    siteName: string | null;
    description: string | null;
};

export function extractOpenGraph(html: string): OpenGraphFields {
    const porPropiedad = new Map<string, string>();
    const porNombre = new Map<string, string>();

    const patron = /<meta\b([^>]*)>/gi;
    let coincidencia: RegExpExecArray | null;

    while ((coincidencia = patron.exec(html)) !== null) {
        const atributos = parseAttributes(coincidencia[1]);
        const propiedad = atributos.get('property')?.trim().toLowerCase();
        const nombre = atributos.get('name')?.trim().toLowerCase();
        const contenido = atributos.get('content');
        if (contenido === undefined) continue;

        const valor = collapseWhitespace(decodeHtmlEntities(contenido));
        if (valor === '') continue;

        if (propiedad && !porPropiedad.has(propiedad)) porPropiedad.set(propiedad, valor);
        if (nombre && !porNombre.has(nombre)) porNombre.set(nombre, valor);
    }

    /** Busca las claves en orden; dentro de cada clave, `property` gana sobre `name`. */
    const meta = (...claves: string[]): string | null => {
        for (const clave of claves) {
            const valor = porPropiedad.get(clave) ?? porNombre.get(clave);
            if (valor) return valor;
        }
        return null;
    };

    return {
        title: meta('og:title', 'twitter:title'),
        image: meta('og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'),
        price: meta('product:price:amount'),
        currency: meta('product:price:currency', 'og:price:currency'),
        siteName: meta('og:site_name'),
        description: meta('og:description', 'description')
    };
}
