import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOUR_STEPS, MAX_CARACTERES_PAGINA, MAX_PAGINAS_POR_PARADA } from '@/lib/tour/steps';
import { DEMO_GROUP } from '@/lib/tour/demo-data';
import { TABS } from '@/lib/tabs';

/**
 * El guion del recorrido (S3 y S7).
 *
 * Dos comprobaciones que no se pueden hacer «a ojo» y que se rompen en silencio:
 *
 * 1. **Que cada ruta exista.** Una parada con `route: '/groups/unirse'` no falla al compilar: falla
 *    en el móvil del usuario, a mitad del tour, con la app en una pantalla que no existe. Aquí se
 *    lee el sistema de archivos y se exige el fichero de página de expo-router.
 * 2. **Que cada objetivo esté registrado.** La decisión S7 es que las coordenadas no se escriben a
 *    mano: cada parada apunta a un `targetId` que alguna pantalla da de alta con `useTourTarget`.
 *    Un id con una letra cambiada deja el tour esperando una medida que no llega nunca, así que el
 *    test lee las pantallas que registran objetivos y comprueba que todos los del guion están.
 */

const RAIZ = process.cwd();

/** Las pantallas que dan de alta objetivos del tour. Si una se muda, este test la delata. */
const PANTALLAS_CON_OBJETIVOS = [
    // Los tres `tab-*` los da de alta la portada y no `ResponsiveLayout`: una sub-ruta pinta el mismo
    // layout y, si registrara los mismos ids, su desmontaje borraría el alta de la portada.
    'app/index.tsx',
    'components/WishListTab.tsx',
    'components/GroupsTab.tsx',
    'components/NotificationMenu.tsx',
    'app/wishlist/add/index.tsx',
    'app/groups/join/index.tsx',
    'app/groups/[id]/index.tsx',
    'app/wishlist/[id]/index.tsx',
];

/**
 * Los ficheros de página con los que expo-router puede servir una ruta.
 *
 * Una ruta con un identificador concreto (`/groups/tour-group`) no tiene por qué existir como
 * carpeta literal: la sirve el segmento dinámico que ya conoce la app (`app/groups/[id]/`). Se
 * acepta cualquiera de las dos formas, segmento a segmento, para no exigir una carpeta por cada id
 * de ejemplo ni dar por buena una ruta que no existe.
 */
function ficherosDeRuta(route: string): string[] {
    const segmentos = route.replace(/^\//, '').split('/');
    const candidatos = new Set<string>([path.join(RAIZ, 'app', ...segmentos, 'index.tsx')]);

    for (const [indice] of segmentos.entries()) {
        for (const forma of ['[id]', '[...id]']) {
            const copia = [...segmentos];

            copia[indice] = forma;
            candidatos.add(path.join(RAIZ, 'app', ...copia, 'index.tsx'));
        }
    }

    return [...candidatos];
}

function objetivosRegistrados(): Set<string> {
    const ids = new Set<string>();

    for (const pantalla of PANTALLAS_CON_OBJETIVOS) {
        const fuente = readFileSync(path.join(RAIZ, pantalla), 'utf8');

        for (const [, id] of fuente.matchAll(/useTourTarget\('([^']+)'\)/g)) ids.add(id);
    }

    return ids;
}

describe('TOUR_STEPS: el guion', () => {
    it('tiene paradas, y cada una con identidad propia', () => {
        expect(TOUR_STEPS.length).toBeGreaterThan(0);

        const ids = TOUR_STEPS.map((paso) => paso.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    it('cada parada tiene al menos una página con texto', () => {
        for (const paso of TOUR_STEPS) {
            expect(paso.pages.length).toBeGreaterThanOrEqual(1);

            for (const pagina of paso.pages) {
                expect(pagina.trim().length).toBeGreaterThan(0);
            }
        }
    });

    it('cada parada dice dónde vive: su objetivo y una pestaña o una ruta', () => {
        for (const paso of TOUR_STEPS) {
            expect(paso.targetId.trim().length).toBeGreaterThan(0);

            const tieneDestino = paso.tab !== undefined || paso.route !== undefined;

            expect(tieneDestino, `La parada «${paso.id}» no dice cómo llegar`).toBe(true);
        }
    });

    it('las pestañas del guion son pestañas de verdad', () => {
        for (const paso of TOUR_STEPS) {
            if (paso.tab === undefined) continue;

            expect(TABS).toContain(paso.tab);
        }
    });

    it('cada ruta declarada tiene su página en `app/`', () => {
        for (const paso of TOUR_STEPS) {
            if (paso.route === undefined) continue;

            const ficheros = ficherosDeRuta(paso.route);

            expect(
                ficheros.some((fichero) => existsSync(fichero)),
                `La parada «${paso.id}» apunta a ${paso.route}, que no existe (${ficheros.join(', ')})`
            ).toBe(true);
        }
    });

    it('cada objetivo del guion lo registra alguna pantalla (S7)', () => {
        const registrados = objetivosRegistrados();

        for (const paso of TOUR_STEPS) {
            expect(
                registrados.has(paso.targetId),
                `Nadie registra «${paso.targetId}» con useTourTarget`
            ).toBe(true);
        }
    });

    it('recorre las pantallas en el orden del recorrido (S3)', () => {
        // `route` manda sobre `tab` al navegar, así que el ancla de cada parada es la ruta si la
        // hay. Se comprueba el orden entero: es el guion que el usuario va a leer.
        expect(TOUR_STEPS.map((paso) => paso.route ?? paso.tab)).toEqual([
            'wishlist',
            'wishlist',
            'wishlist',
            '/wishlist/add',
            'groups',
            'groups',
            `/groups/${DEMO_GROUP.id}`,
            `/wishlist/${DEMO_GROUP.members[0].id}`,
            'groups',
            '/groups/join',
            'groups',
            'profile',
            'profile',
        ]);
    });

    it('ninguna página pasa del presupuesto: lo largo se reparte en más páginas (S3)', () => {
        // La tarjeta del tour se adapta al texto, pero un cartel con un párrafo deja de ser un
        // cartel. Este tope es de redacción; que no haya desplazamiento de verdad lo comprueba
        // `e2e/tour.spec.ts`, que recorre las páginas y mide el alto sobrante.
        for (const paso of TOUR_STEPS) {
            expect(
                paso.pages.length,
                `La parada «${paso.id}» tiene ${paso.pages.length} páginas`
            ).toBeLessThanOrEqual(MAX_PAGINAS_POR_PARADA);

            for (const [indice, pagina] of paso.pages.entries()) {
                expect(
                    pagina.length,
                    `La página ${indice + 1} de «${paso.id}» ocupa ${pagina.length} caracteres: «${pagina}»`
                ).toBeLessThanOrEqual(MAX_CARACTERES_PAGINA);
            }
        }
    });

    it('el grupo y el miembro de ejemplo se abren de verdad (D5)', () => {
        // El recorrido entra en el grupo de demostración y en la lista de una de sus personas para
        // enseñar un deseo ya reservado (D5). Las dos rutas llevan los identificadores de los datos
        // de ejemplo: si alguien los cambia en un sitio y no en el otro, el tour abriría una lista
        // vacía o una pantalla que no existe.
        const detalle = TOUR_STEPS.find((paso) => paso.id === 'detalle-grupo');

        expect(detalle?.route).toBe(`/groups/${DEMO_GROUP.id}`);
        expect(detalle?.targetId).toBe('grupo-participantes');
        expect((detalle?.pages ?? []).join(' ').toLowerCase()).toContain('miembros');

        const miembro = TOUR_STEPS.find((paso) => paso.id === 'deseos-miembro');

        expect(miembro?.route).toBe(`/wishlist/${DEMO_GROUP.members[0].id}`);
        expect(miembro?.targetId).toBe('deseos-miembro');
        expect((miembro?.pages ?? []).join(' ').toLowerCase()).toContain('reservado');
    });

    it('la lista de grupos ya no dice que el tour no puede abrir el grupo (D5)', () => {
        // La página antigua prometía lo contrario justo antes de entrar en él: era cierta con D1 y
        // deja de serlo con D5. Sin esta comprobación, el guion se contradiría a sí mismo.
        const lista = TOUR_STEPS.find((paso) => paso.targetId === 'grupos-lista');

        expect(lista).toBeDefined();
        expect(lista?.route).toBeUndefined();

        const texto = (lista?.pages ?? []).join(' ').toLowerCase();

        expect(texto).not.toContain('no puede abrirlo');
        expect(texto).toContain('miembros');
        expect(texto).toContain('reservados');
    });
});
