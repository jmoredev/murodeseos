import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOUR_STEPS, MAX_CARACTERES_PAGINA, MAX_PAGINAS_POR_PARADA } from '@/lib/tour/steps';
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
    'components/ResponsiveLayout.tsx',
    'components/WishListTab.tsx',
    'components/GroupsTab.tsx',
    'components/NotificationMenu.tsx',
    'app/wishlist/add/index.tsx',
    'app/groups/join/index.tsx',
];

/** El fichero de página que expo-router necesita para servir una ruta. */
function ficheroDeRuta(route: string): string {
    return path.join(RAIZ, 'app', route.replace(/^\//, ''), 'index.tsx');
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

            const fichero = ficheroDeRuta(paso.route);

            expect(existsSync(fichero), `La parada «${paso.id}» apunta a ${paso.route}, que no existe (${fichero})`).toBe(true);
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
            '/groups/join',
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

    it('el detalle de grupo se explica con palabras, sin navegar a él (D1)', () => {
        // Abrir un grupo de verdad es imposible con los datos de demostración, así que la parada
        // de la lista de grupos lleva una página que cuenta qué se vería dentro. Sin esa página el
        // recorrido prometería una pantalla que no enseña.
        const lista = TOUR_STEPS.find((paso) => paso.targetId === 'grupos-lista');

        expect(lista).toBeDefined();
        expect(lista?.route).toBeUndefined();

        const texto = (lista?.pages ?? []).join(' ').toLowerCase();

        expect(texto).toContain('miembros');
        expect(texto).toContain('reservas');
    });
});
