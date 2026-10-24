import { describe, expect, it } from 'vitest';
import {
    createTourState,
    current,
    next,
    previous,
    skip,
    type TourState,
    type TourStep,
} from '../../lib/tour/engine';

/**
 * El motor del tour es una máquina de estados **pura**: recibe un estado y devuelve otro. No sabe
 * de React, del DOM, de temporizadores ni de animaciones, así que aquí se puede recorrer el tour
 * entero sin montar nada. El overlay (T3) y las paradas por pantalla (T5) sólo leen lo que este
 * fichero produce.
 */

const PASOS: TourStep[] = [
    {
        id: 'deseos',
        targetId: 'tab-deseos',
        pages: [
            'Tus deseos viven en este muro',
            'Los de tus grupos también aparecen, sin mezclarse',
            'Reserva el que te toque y deja de estar disponible',
        ],
    },
    {
        id: 'anadir-deseo',
        targetId: 'boton-anadir-deseo',
        route: '/wishlist/add',
        pages: ['Pega el enlace y la app rellena el título, la foto y el precio'],
    },
    {
        id: 'grupos',
        targetId: 'tab-grupos',
        pages: ['Aquí están tus grupos', 'Únete al de alguien con su código'],
    },
];

/**
 * Coloca el estado en una parada concreta sin encadenar `next`: si un fallo en `next` se usara
 * para preparar los demás casos, un solo error tumbaría casi todos los tests y costaría más
 * encontrar la causa.
 */
function posicion(stepIndex: number, pageIndex: number): TourState {
    return { ...createTourState(PASOS), stepIndex, pageIndex };
}

describe('createTourState', () => {
    it('empieza en el primer paso, la primera página y activo', () => {
        const estado = createTourState(PASOS);

        expect(estado.status).toBe('active');
        expect(estado.stepIndex).toBe(0);
        expect(estado.pageIndex).toBe(0);
        expect(estado.steps).toEqual(PASOS);
    });

    it('sin pasos está terminado desde el principio y las ayudas no hacen nada', () => {
        const vacio = createTourState([]);

        expect(vacio.status).toBe('completed');
        expect(vacio.stepIndex).toBe(0);
        expect(vacio.pageIndex).toBe(0);
        // Ni lanzan ni cambian nada: la pantalla que las llame no tiene que defenderse.
        expect(next(vacio)).toEqual(vacio);
        expect(previous(vacio)).toEqual(vacio);
        expect(skip(vacio)).toEqual(vacio);
        expect(current(vacio)).toBeNull();
    });

    it('un paso sin páginas es un error de programación y el mensaje nombra el paso', () => {
        // No es entrada del usuario: es un paso mal escrito en el catálogo del tour, y quien lo
        // lea tiene que saber cuál arreglar sin abrir el depurador.
        const malo: TourStep = { id: 'perfil', targetId: 'tab-perfil', pages: [] };

        expect(() => createTourState([...PASOS, malo])).toThrow(Error);
        expect(() => createTourState([...PASOS, malo])).toThrow(/perfil/);
    });
});

describe('next', () => {
    it('dentro de un paso avanza una página', () => {
        const estado = next(posicion(0, 0));

        expect(estado.status).toBe('active');
        expect(estado.stepIndex).toBe(0);
        expect(estado.pageIndex).toBe(1);
    });

    it('en la última página de un paso pasa a la primera página del siguiente', () => {
        const estado = next(posicion(0, 2));

        expect(estado.status).toBe('active');
        expect(estado.stepIndex).toBe(1);
        expect(estado.pageIndex).toBe(0);
    });

    it('en la última página del último paso termina sin perder la posición', () => {
        const estado = next(posicion(2, 1));

        expect(estado.status).toBe('completed');
        // Los índices se quedan donde estaban para que el cierre conserve el contexto.
        expect(estado.stepIndex).toBe(2);
        expect(estado.pageIndex).toBe(1);
    });
});

describe('previous', () => {
    it('dentro de un paso vuelve una página', () => {
        const estado = previous(posicion(2, 1));

        expect(estado.status).toBe('active');
        expect(estado.stepIndex).toBe(2);
        expect(estado.pageIndex).toBe(0);
    });

    it('en la primera página de un paso va a la última página del anterior', () => {
        const estado = previous(posicion(1, 0));

        expect(estado.status).toBe('active');
        expect(estado.stepIndex).toBe(0);
        expect(estado.pageIndex).toBe(2);
    });

    it('en la primera página del primer paso no hace nada y devuelve el mismo estado', () => {
        const inicial = createTourState(PASOS);

        expect(() => previous(inicial)).not.toThrow();
        expect(previous(inicial)).toBe(inicial);
    });
});

describe('skip', () => {
    it('salta desde cualquier posición activa y conserva los índices', () => {
        const desdeElPrincipio = skip(posicion(0, 0));
        const desdeElFinal = skip(posicion(2, 1));

        expect(desdeElPrincipio.status).toBe('skipped');
        expect(desdeElPrincipio.stepIndex).toBe(0);
        expect(desdeElPrincipio.pageIndex).toBe(0);
        expect(desdeElFinal.status).toBe('skipped');
        expect(desdeElFinal.stepIndex).toBe(2);
        expect(desdeElFinal.pageIndex).toBe(1);
    });
});

describe('estados terminales', () => {
    const AYUDAS = { next, previous, skip } as const;

    it('terminado y saltado son terminales e idempotentes: las tres ayudas devuelven lo mismo', () => {
        const terminado = next(posicion(2, 1));
        const saltado = skip(posicion(0, 1));

        for (const terminal of [terminado, saltado]) {
            for (const [nombre, ayuda] of Object.entries(AYUDAS)) {
                expect(ayuda(terminal), `${nombre} sobre ${terminal.status}`).toBe(terminal);
            }
        }
    });
});

describe('current', () => {
    it('entrega la parada y las etiquetas listas para pintar, sin recalcular nada', () => {
        const actual = current(posicion(2, 1));

        expect(actual).not.toBeNull();
        expect(actual?.step).toBe(PASOS[2]);
        expect(actual?.page).toBe('Únete al de alguien con su código');
        expect(actual?.stepIndex).toBe(2);
        expect(actual?.pageIndex).toBe(1);
        expect(actual?.stepCount).toBe(3);
        expect(actual?.pageCount).toBe(2);
        expect(actual?.stepLabel).toBe('Paso 3 de 3');
        expect(actual?.pageLabel).toBe('Página 2 de 2');
    });

    it('cuenta desde uno, como las lee el usuario', () => {
        const actual = current(createTourState(PASOS));

        expect(actual?.stepLabel).toBe('Paso 1 de 3');
        expect(actual?.pageLabel).toBe('Página 1 de 3');
    });
});

describe('inmutabilidad', () => {
    it('las ayudas devuelven un estado nuevo y no tocan el que reciben', () => {
        const inicial = createTourState(PASOS);
        const esperado = { ...inicial };

        const avanzado = next(inicial);
        previous(posicion(1, 0));
        skip(inicial);
        current(inicial);

        // Objeto nuevo cuando hay cambio, para que React pueda usarlo como estado sin más.
        expect(avanzado).not.toBe(inicial);
        expect(avanzado.pageIndex).toBe(1);
        expect(inicial).toEqual(esperado);
        expect(PASOS[0].pages).toHaveLength(3);
    });
});
