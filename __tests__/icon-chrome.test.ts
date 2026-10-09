import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Guardián del «chrome de control» (Unidad U6 de ui-polish).
 *
 * Los controles de la interfaz (tab bar, cerrar/back, confirmar/cancelar,
 * compartir/editar/menú, placeholders de imagen) llevaban una mezcla de emoji
 * (🎁 👥 👤) y glifos de texto (✓ ✕ ⋮ ✎ ↗ ←): cada uno tenía su propia fuente,
 * su propio peso y su propio tipo de paleta. Esta unidad los reemplaza por un
 * ÚNICO set de iconos — Feather, vía `@expo/vector-icons` — a través de UN
 * envoltorio compartido, `components/ui/AppIcon.tsx`.
 *
 * Mismo patrón que `contrast-floor.test.ts` y `typography-floor.test.ts`:
 * barrido de fuentes con guardia de no-vacuidad y cero glifos de texto suelto;
 * el régimen de comentarios es el de la casa en los test-guardianes (ver
 * `contrast-floor.test.ts` y `typography-floor.test.ts`).
 */

/** Ficheros donde se ha retirado el chrome; si se añade otro sitio con icono, añádelo aquí. */
const CHROME_FILES = [
    'app/groups/[id]/index.tsx',
    'app/wishlist/[id]/index.tsx',
    'components/GroupCard.tsx',
    'components/GroupsTab.tsx',
    'components/ResponsiveLayout.tsx',
    'components/WishDetailModal.tsx',
    'components/WishListTab.tsx',
    'components/WishlistCard.tsx',
    'components/ui/AppIcon.tsx',
];

/** Glifos prohibidos en el chrome: mezcla de emoji y de texto que el envoltorio sustituye. */
const GLIFOS_PROHIBIDOS = ['🎁', '👥', '👤', '✓', '✕', '⋮', '✎', '↗', '←'];

/**
 * El icono de grupo NO es chrome: es un dato (`groups.icon` de la base de
 * datos), el usuario lo elige y en `app/groups/[id]/index.tsx` se renderiza el
 * valor de BD con `🎁` como fallback del dato. Se excluye SOLO ese fichero,
 * no por línea — el patrón de excepciones indexadas por línea desplazaba
 * las claves en cada edición y provocaba bucles (ver el comentario de
 * "retirada de exenciones" en `contrast-floor.test.ts`).
 */
const EXCEPCIONES = new Set(['app/groups/[id]/index.tsx']);

/** Recolecta recursivamente los .ts/.tsx de un árbol usado para buscar importaciones prohibidas. */
function collectTsFiles(dir: string, out: string[] = []): string[] {
    let entries: Dirent[];
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries as Dirent[]) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectTsFiles(full, out);
        else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
}

/**
 * Glifos prohibidos presentes en texto de la interfaz (nodos de cadena y de
 * texto JSX del AST), con su línea.
 *
 * Se recorre el AST y no el texto crudo por una razón pagada: un comentario que
 * EXPLICA por qué se retiró el glifo no es chrome, y con un barrido de líneas el
 * guardián se ponía rojo por su propia documentación. Prohibirlo en la prosa
 * empujaría a escribir comentarios crípticos, así que la regla es «en código, no
 * en prosa» — y en el AST un comentario nunca es un nodo.
 */
function glyphOffenders(rel: string, source: string): string[] {
    const sourceFile = ts.createSourceFile(rel, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
    const offenders: string[] = [];

    const inspect = (text: string, position: number) => {
        for (const glyph of GLIFOS_PROHIBIDOS) {
            const at = text.indexOf(glyph);
            if (at === -1) continue;
            const line = sourceFile.getLineAndCharacterOfPosition(position + at).line + 1;
            offenders.push(
                `${rel}:${line}: ${glyph} — usa <AppIcon> en su lugar (familia Feather vía @expo/vector-icons)`,
            );
        }
    };

    const visit = (node: ts.Node): void => {
        // El texto visible de JSX (`<Text>✓</Text>`) y cualquier cadena
        // (`'🎁'`, `data-x="🎁"`) son los dos únicos sitios donde un glifo llega
        // a la interfaz.
        if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
            inspect(node.getText(sourceFile), node.getStart(sourceFile));
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    return offenders;
}

const PAQUETE_ICONOS = '@expo/vector-icons';

/**
 * Usos DIRECTOS de la familia fuera del envoltorio: una etiqueta `<Feather>` o
 * **una importación del paquete**, que es la vía que el guardián anterior
 * dejaba pasar.
 *
 * El hueco era real y estaba arriba del todo: mirar sólo etiquetas JSX no caza
 * `import Ionicons from '@expo/vector-icons'`, con la que se llega a la familia
 * sin escribir nunca `<Feather>`. Hoy la familia única la sostenía el `grep`,
 * no el guardián. Se cubren las cuatro formas de entrar (defecto, nombrada,
 * espacio de nombres y `require`), porque todas traen la familia al bundle.
 */
function directFeatherOffenders(rel: string, source: string): string[] {
    const sourceFile = ts.createSourceFile(rel, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
    const offenders: string[] = [];

    const esDelPaquete = (specifier: string) =>
        specifier === PAQUETE_ICONOS || specifier.startsWith(`${PAQUETE_ICONOS}/`);

    const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            if (esDelPaquete(node.moduleSpecifier.text)) {
                offenders.push(`${rel}: import '${node.moduleSpecifier.text}'`);
            }
        }

        // `require` no es un nodo de importación, pero trae la familia igual.
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
            const [first] = node.arguments;
            if (first && ts.isStringLiteral(first) && esDelPaquete(first.text)) {
                offenders.push(`${rel}: require('${first.text}')`);
            }
        }

        // La etiqueta directa sigue prohibida: alguien podría definir su propio
        // `Feather` sin importar nada.
        if (
            (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
            node.tagName.getText(sourceFile) === 'Feather'
        ) {
            offenders.push(`${rel}: <Feather>`);
        }

        ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    return offenders;
}

describe('guardián del chrome de iconos (U6 ui-polish)', () => {
    it('la lista de ficheros es real: ≥ 8 ficheros, cada uno leído y no vacío', () => {
        expect(CHROME_FILES.length).toBeGreaterThanOrEqual(8);

        // No-vacuidad: cada fichero debe existir, leerse y tener contenido. Si
        // el barrido dejara de ver el árbol (ruta mal, glob roto), este test
        // fallaría en su guardia — nunca en silencio.
        for (const rel of CHROME_FILES) {
            const source = readFileSync(path.join(ROOT, rel), 'utf8');
            expect(source.length, `${rel} está vacío — no-vacuidad del barrido`).toBeGreaterThan(0);
        }
    });

    it('cero glifos de chrome prohibidos en los ficheros del chrome', () => {
        const offenders = CHROME_FILES.filter((rel) => !EXCEPCIONES.has(rel)).flatMap((rel) =>
            glyphOffenders(rel, readFileSync(path.join(ROOT, rel), 'utf8')),
        );

        expect(
            offenders,
            `Glifos de chrome prohibidos — deben ser <AppIcon />:\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('control negativo: el glifo dentro de un comentario NO cuenta, el mismo glifo en JSX SÍ', () => {
        // Este falso positivo se pagó en la primera edición de la unidad: el
        // comentario que EXPLICA por qué el glifo se retiró puso el guardián en
        // rojo. Prohibirlo en prosa empujaría a escribir comentarios crípticos,
        // así que la regla es «en código, no en prosa».
        expect(glyphOffenders('falso.tsx', '// el glifo ✓ se retiró de aquí\n')).toEqual([]);
        expect(glyphOffenders('falso.tsx', '{/* el glifo ✓ se retiró */}\n')).toEqual([]);
        expect(glyphOffenders('falso.tsx', '<Text>✓</Text>\n')).toHaveLength(1);
    });

    it('la familia entra SÓLO por AppIcon.tsx: fuera de él, ni `<Feather>` ni importaciones del paquete', () => {
        const offenders: string[] = [];

        for (const dir of ['app', 'components'] as const) {
            for (const file of collectTsFiles(path.join(ROOT, dir))) {
                const rel = path.relative(ROOT, file).split(path.sep).join('/');
                if (rel === 'components/ui/AppIcon.tsx') continue;
                offenders.push(...directFeatherOffenders(rel, readFileSync(file, 'utf8')));
            }
        }

        expect(
            offenders,
            `Los usos directos de la familia están prohibidos: usa <AppIcon> (familia, peso y color en un solo punto):\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('control negativo: caza la importación del paquete, no sólo la etiqueta', () => {
        // Es el hueco que este endurecimiento cierra. Sin estos casos, el
        // guardián volvería a ser una promesa que sólo mira JSX.
        expect(directFeatherOffenders('falso.tsx', "import Ionicons from '@expo/vector-icons';\n")).toHaveLength(1);
        expect(directFeatherOffenders('falso.tsx', "import { Feather } from '@expo/vector-icons';\n")).toHaveLength(1);
        expect(directFeatherOffenders('falso.tsx', "import Feather from '@expo/vector-icons/Feather';\n")).toHaveLength(1);
        expect(directFeatherOffenders('falso.tsx', "const Icons = require('@expo/vector-icons');\n")).toHaveLength(1);
        expect(directFeatherOffenders('falso.tsx', '<Feather name="gift" />\n')).toHaveLength(1);

        // Y no debe dar falsos positivos: el envoltorio de la casa y una
        // mención en prosa no son usos directos.
        expect(directFeatherOffenders('falso.tsx', "import { AppIcon } from '@/components/ui/AppIcon';\n")).toEqual([]);
        expect(directFeatherOffenders('falso.tsx', "// antes se usaba '@expo/vector-icons' aquí\n")).toEqual([]);
    });

    it('el fichero AppIcon.tsx existe, registra la familia Feather y su clase de color viene del className del llamador', () => {
        const source = readFileSync(path.join(ROOT, 'components/ui/AppIcon.tsx'), 'utf8');

        // Una única familia: el import de Feather y su paso al envoltorio.
        expect(source).toContain('@expo/vector-icons');
        // El color NO va hardcodeado: el llamador pasa su clase NativeWind.
        // (regex con clase de carácter para que el apóstrofe tipográfico ' de
        // un comentario en español no valga.)
        expect(source).not.toMatch(/color:[\s]*["']#/);
    });
});
