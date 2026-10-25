import { describe, expect, it } from 'vitest';
import type { TourStep } from '@/lib/tour/engine';
import { stepDestination } from '@/lib/tour/navigation';

/**
 * A dónde hay que ir para llegar a una parada (S3: el tour pasa por todas las pantallas).
 *
 * Esto se decide sin React a propósito: la navegación de verdad —`router.push`/`replace`— se queda
 * fuera y aquí sólo se responde «a qué pestaña» o «a qué ruta», o `null` cuando ya estamos. Así el
 * motor del recorrido no depende de expo-router y el caso raro (una parada en una sub-ruta, un
 * pathname con barra final) se prueba con cadenas, sin montar la app.
 */

function paso(extra: Partial<TourStep>): TourStep {
    return { id: 'parada', targetId: 'objetivo', pages: ['Una página'], ...extra };
}

describe('stepDestination: paradas con ruta', () => {
    it('no navega si ya estamos en la ruta de la parada', () => {
        const destino = stepDestination(paso({ route: '/wishlist/add' }), {
            tab: 'wishlist',
            pathname: '/wishlist/add',
        });

        expect(destino).toBeNull();
    });

    it('la barra final no cuenta: la misma ruta con una barra de más sigue siendo la misma', () => {
        const destino = stepDestination(paso({ route: '/wishlist/add' }), {
            tab: 'wishlist',
            pathname: '/wishlist/add/',
        });

        expect(destino).toBeNull();
    });

    it('navega a la ruta cuando estamos en otra', () => {
        const destino = stepDestination(paso({ route: '/groups/join' }), {
            tab: 'groups',
            pathname: '/',
        });

        expect(destino).toEqual({ kind: 'route', route: '/groups/join' });
    });

    it('salir de una sub-ruta también navega, aunque la pestaña coincida', () => {
        // Estamos en la pantalla de añadir y la parada vive en la lista: la pestaña activa no
        // basta, hay que volver a la raíz.
        const destino = stepDestination(paso({ route: '/' }), {
            tab: 'wishlist',
            pathname: '/wishlist/add',
        });

        expect(destino).toEqual({ kind: 'route', route: '/' });
    });

    it('la ruta manda sobre la pestaña cuando la parada declara las dos', () => {
        const destino = stepDestination(paso({ tab: 'groups', route: '/wishlist/add' }), {
            tab: 'groups',
            pathname: '/',
        });

        expect(destino).toEqual({ kind: 'route', route: '/wishlist/add' });
    });
});

describe('stepDestination: paradas con pestaña', () => {
    it('en la raíz, la pestaña de la parada ya está puesta: no se navega', () => {
        const destino = stepDestination(paso({ tab: 'wishlist' }), {
            tab: 'wishlist',
            pathname: '/',
        });

        expect(destino).toBeNull();
    });

    it('en la raíz, otra pestaña se pide por estado, sin recargar la ruta', () => {
        // En la raíz la pantalla ya está montada: cambiar de pestaña es un estado, no una ruta
        // nueva, y así no se duplica el documento que ya se está midiendo.
        const destino = stepDestination(paso({ tab: 'groups' }), {
            tab: 'wishlist',
            pathname: '/',
        });

        expect(destino).toEqual({ kind: 'tab', tab: 'groups' });
    });

    it('desde una sub-ruta se vuelve a la raíz conservando la pestaña', () => {
        // La pestaña de la parada es la misma que la que había: `/?tab=` sobra y la URL queda
        // corta, que es la que el usuario reconoce.
        const destino = stepDestination(paso({ tab: 'wishlist' }), {
            tab: 'wishlist',
            pathname: '/wishlist/add',
        });

        expect(destino).toEqual({ kind: 'route', route: '/' });
    });

    it('desde una sub-ruta con otra pestaña se pide la pestaña en la URL', () => {
        const destino = stepDestination(paso({ tab: 'groups' }), {
            tab: 'wishlist',
            pathname: '/wishlist/add',
        });

        expect(destino).toEqual({ kind: 'route', route: '/?tab=groups' });
    });

    it('una sub-ruta con barra final sigue siendo una sub-ruta', () => {
        const destino = stepDestination(paso({ tab: 'groups' }), {
            tab: 'groups',
            pathname: '/groups/join/',
        });

        expect(destino).toEqual({ kind: 'route', route: '/' });
    });

    it('la pestaña de perfil también se pide en la URL cuando hace falta', () => {
        const destino = stepDestination(paso({ tab: 'profile' }), {
            tab: 'groups',
            pathname: '/groups/join',
        });

        expect(destino).toEqual({ kind: 'route', route: '/?tab=profile' });
    });
});

describe('stepDestination: paradas sin destino', () => {
    it('una parada sin pestaña ni ruta ya se cumple donde estemos', () => {
        // Ni se navega ni se pide nada: la parada es del sitio en el que ya está el usuario.
        expect(stepDestination(paso({}), { tab: 'wishlist', pathname: '/wishlist/add' })).toBeNull();
    });
});
