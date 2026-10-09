import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOW = readFileSync(join(__dirname, '..', '.github', 'workflows', 'deploy.yml'), 'utf8');

/**
 * Guardián del despliegue, y existe porque este fallo es **mudo**.
 *
 * `actions/upload-pages-artifact` excluye por defecto los ficheros que empiezan
 * por punto (`--exclude=.[^/]*`), así que `.nojekyll` no llegaba al sitio. Sin
 * `.nojekyll`, GitHub Pages procesa el sitio con **Jekyll**, y Jekyll descarta
 * `node_modules` por defecto. Y `node_modules` es donde están **todas** las
 * fuentes (`assets/node_modules/…`), así que en producción daban 404 y los
 * iconos salían como recuadros vacíos.
 *
 * Estuvo así desde que se publica con Actions (2026-09-24) y nadie lo notó: una
 * fuente que falta no da error, el navegador usa la del sistema. Se descubrió
 * cuando el cromo pasó de emoji a glifos de una fuente propia.
 *
 * Por eso se vigila la **configuración**, no el resultado: el resultado no se
 * puede comprobar sin publicar.
 */

/**
 * El bloque del paso que sube el artefacto de Pages, o `null` si no está.
 *
 * El bloque se corta por **sangría**, no buscando el siguiente `- uses:`: si no
 * hay otro paso detrás, esa búsqueda se tragaría el resto del fichero y el
 * guardián pasaría leyendo una opción de cualquier otra parte del workflow. Es
 * decir, sería un guardián vano —justo lo que este test vigila.
 */
function bloqueDeSubida(yaml: string): string | null {
    const lineas = yaml.split('\n');
    const inicio = lineas.findIndex((l) => l.includes('uses: actions/upload-pages-artifact'));

    if (inicio === -1) return null;

    const sangriaDelPaso = lineas[inicio].search(/\S/);
    const bloque: string[] = [lineas[inicio]];

    for (const linea of lineas.slice(inicio + 1)) {
        const vacia = linea.trim() === '';
        // Comentario a la misma altura o menos: pertenece al workflow, no al paso.
        const sangria = linea.search(/\S/);
        if (!vacia && sangria <= sangriaDelPaso) break;
        bloque.push(linea);
    }

    return bloque.join('\n');
}

/** ¿El paso de subida incluye los ficheros ocultos? Sin eso, `.nojekyll` no viaja. */
function incluyeOcultos(yaml: string): boolean {
    const bloque = bloqueDeSubida(yaml);
    return bloque !== null && /include-hidden-files:\s*true/.test(bloque);
}

describe('workflow de despliegue: las fuentes tienen que llegar al sitio', () => {
    it('el paso que sube el artefacto incluye los ficheros ocultos', () => {
        expect(
            incluyeOcultos(WORKFLOW),
            'El paso `actions/upload-pages-artifact` no pone `include-hidden-files: true`. Sin eso excluye `.nojekyll`, Pages procesa el sitio con Jekyll, Jekyll descarta `node_modules` y TODAS las fuentes dan 404: los iconos vuelven a salir como recuadros vacíos.',
        ).toBe(true);
    });

    it('control negativo: sin la opción, el guardián lo dice', () => {
        // El caso real: el workflow tal y como estaba cuando el fallo llegó a producción.
        const sinLaOpcion = WORKFLOW.replace(/^(\s*)include-hidden-files:\s*true\s*$/m, '');

        expect(sinLaOpcion).not.toBe(WORKFLOW); // la opción existía antes de quitarla
        expect(incluyeOcultos(sinLaOpcion)).toBe(false);
    });

    it('control negativo: si desaparece el paso entero, el guardián también lo dice', () => {
        // Que el paso no exista no puede contar como «está bien configurado».
        expect(incluyeOcultos(WORKFLOW.replace(/upload-pages-artifact/g, 'otro-action'))).toBe(false);
        expect(bloqueDeSubida('no hay nada aquí')).toBeNull();
    });

    it('control negativo: no se deja engañar por la opción puesta en OTRO paso', () => {
        // El bloque se corta por sangría a propósito. Si se cortara buscando el
        // siguiente `- uses:`, un `include-hidden-files: true` en cualquier otra
        // parte del workflow haría pasar el guardián sin que el paso correcto lo
        // tuviera: un guardián que lee de más es un guardián vano.
        const conLaOpcionEnOtroSitio =
            WORKFLOW.replace(/^\s*include-hidden-files:\s*true\s*$/m, '') +
            '\n  otro-job:\n    steps:\n      - uses: actions/algo@v1\n        with:\n          include-hidden-files: true\n';

        expect(incluyeOcultos(conLaOpcionEnOtroSitio)).toBe(false);
    });

    it('tras publicar se comprueba que una fuente se sirve de verdad', () => {
        // La configuración puede estar bien y el sitio seguir roto por otra causa
        // (una exclusión distinta, un cambio de Pages). Esta es la red que lo caza.
        expect(
            WORKFLOW,
            'Falta la comprobación de que una fuente se sirve tras publicar: es lo único que detecta el síntoma real.',
        ).toMatch(/\.ttf/);
    });
});
