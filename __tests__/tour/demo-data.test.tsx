import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WishListTab } from '@/components/WishListTab';
import { GroupsTab } from '@/components/GroupsTab';
import GroupDetailsPage from '@/app/groups/[id]/index';
import UserWishlistPage from '@/app/wishlist/[id]/index';
import {
    DEMO_GROUP,
    DEMO_GROUP_MEMBERS,
    DEMO_GROUPS,
    DEMO_MEMBER,
    DEMO_MEMBER_WISHES,
    DEMO_WISHES,
} from '@/lib/tour/demo-data';
import { supabase } from '@/lib/supabase';

/**
 * Los parámetros de ruta y el `push` del navegador, mutables por prueba: las dos pantallas del tour
 * leen el id de la URL (`/groups/tour-group`, `/wishlist/tour-member-1`) y hay que poder apuntar a
 * una y a otra en el mismo fichero.
 */
const { params, routerPush } = vi.hoisted(() => ({
    params: {} as Record<string, string>,
    routerPush: vi.fn(),
}));

// El mock global de `vitest.setup.ts` devuelve parámetros vacíos; estas pruebas necesitan los del
// tour, así que se sustituye entero y se conserva la forma que ya consumen las listas de la portada.
vi.mock('expo-router', () => ({
    Link: ({ children }: any) => children,
    useRouter: () => ({ push: routerPush, replace: vi.fn(), back: vi.fn(), setParams: vi.fn() }),
    useFocusEffect: (callback: any) => {
        React.useEffect(callback, [callback]);
    },
    useSegments: () => [],
    usePathname: () => '/',
    useLocalSearchParams: () => params,
    useGlobalSearchParams: () => params,
}));

// Las dos pantallas del grupo y del miembro sólo preguntan al tour si está en marcha (D5), y lo
// preguntan al estado del tour, no al host: el host monta el velo y no hace falta aquí.
vi.mock('@/components/tour/TourState', () => ({ useTourActive: () => true }));

// El chrome (pestañas, campana, menú de notificaciones) no es lo que se mide aquí y consulta sus
// propias tablas; con el tour abierto la página queda inerte, así que no aporta nada a la prueba.
vi.mock('@/components/ResponsiveLayout', () => ({
    ResponsiveLayout: ({ children }: any) => children,
}));

/**
 * Los datos de demostración del tour (S4, D1): con la propiedad puesta, las dos listas pintan sus
 * registros y **no** preguntan a Supabase. No se prueban aquí los caminos sin propiedad —con la
 * lista vacía, el cargando y las interacciones de verdad— porque ya los cubren
 * `__tests__/WishListTab.test.tsx` y `__tests__/GroupsTab.test.tsx`, y esa es justo la regresión que
 * hay que dejar intacta.
 *
 * La segunda mitad de cada bloque comprueba lo que no se puede tocar: un deseo de demostración no
 * lleva «Ya lo tengo» ni «Reservar», y un grupo de demostración no lleva menú de administración, ni
 * lápices de apodo, ni reparte un código de invitación de un grupo que no existe.
 */

const userId = 'user-123';

describe('Deseos de demostración', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    it('pinta los tres deseos del tour y no pregunta a Supabase', () => {
        render(<WishListTab userId={userId} demoData={{ wishes: DEMO_WISHES }} />);

        for (const deseo of DEMO_WISHES) {
            expect(screen.getByText(deseo.title)).toBeInTheDocument();
        }

        // Ni estado de carga ni lista vacía: la pantalla ya tiene lo que iba a pedir.
        expect(screen.queryByText('Cargando deseos...')).toBeNull();
        expect(screen.queryByText('Tu lista está vacía')).toBeNull();
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('no deja al alcance ningún control que escriba', () => {
        render(<WishListTab userId={userId} demoData={{ wishes: DEMO_WISHES }} />);

        // «Ya lo tengo» borra el deseo y «Reservar» escribe una reserva: ninguno de los dos existe.
        expect(screen.queryByTestId('wish-already-have')).toBeNull();
        expect(screen.queryByLabelText('Marcar como ya lo tengo')).toBeNull();
        expect(screen.queryByTestId('wish-reserve-button')).toBeNull();
        expect(screen.queryByTestId('wish-cancel-reserve-button')).toBeNull();

        // Tocar la tarjeta no abre el formulario de edición: sin manejador no hay nada que guardar.
        fireEvent.click(screen.getByLabelText(/^Auriculares con cancelación de ruido/));

        expect(screen.queryByText('Editar deseo')).toBeNull();
        expect(screen.queryByText('Nuevo deseo')).toBeNull();
        expect(supabase.from).not.toHaveBeenCalled();
    });
});

describe('Grupo de demostración', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    it('pinta el grupo del tour con sus tres miembros y no pregunta a Supabase', () => {
        render(<GroupsTab userId={userId} demoData={{ groups: DEMO_GROUPS }} />);

        expect(screen.getByText(DEMO_GROUP.name)).toBeInTheDocument();
        expect(screen.getByText('4 participantes')).toBeInTheDocument();

        for (const miembro of DEMO_GROUP.members) {
            expect(screen.getByText(miembro.name)).toBeInTheDocument();
            expect(screen.getByText(miembro.avatar as string)).toBeInTheDocument();
        }

        expect(screen.queryByText('Cargando grupos...')).toBeNull();
        expect(screen.queryByText('No tienes grupos aún')).toBeNull();
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('no deja al alcance ningún control que escriba', () => {
        render(<GroupsTab userId={userId} demoData={{ groups: DEMO_GROUPS }} />);

        // Renombrar y eliminar el grupo viven en el menú de administración; los apodos, en los lápices.
        expect(screen.queryByLabelText('Opciones de grupo')).toBeNull();
        expect(screen.queryByLabelText('Editar alias del grupo')).toBeNull();
        expect(screen.queryByLabelText(`Editar alias de ${DEMO_GROUP.members[0].name}`)).toBeNull();
        expect(screen.queryByText('Cambiar nombre')).toBeNull();
        expect(screen.queryByText('Eliminar grupo')).toBeNull();

        // Compartir no escribe, pero tampoco puede repartir el código de un grupo inventado.
        fireEvent.click(screen.getByLabelText('Compartir grupo'));

        expect(screen.queryByText('Toca para copiar')).toBeNull();
        expect(supabase.from).not.toHaveBeenCalled();
    });
});

describe('Detalle del grupo de demostración', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        params.id = DEMO_GROUP.id;
        delete params.name;
    });

    it('pinta el grupo del tour con sus miembros y no pregunta a Supabase', () => {
        render(<GroupDetailsPage />);

        // El nombre sale dos veces: en la cabecera y en la tarjeta del grupo.
        expect(screen.getAllByText(DEMO_GROUP.name).length).toBeGreaterThan(0);
        for (const miembro of DEMO_GROUP_MEMBERS) {
            expect(screen.getByText(miembro.profiles.display_name)).toBeInTheDocument();
        }

        // Ni el grupo ni sus miembros existen en la base de datos (D1): pedirlos daría una pantalla
        // de error, así que no se pide nada, ni siquiera la sesión.
        expect(screen.queryByText('No se pudo cargar el grupo')).toBeNull();
        expect(supabase.from).not.toHaveBeenCalled();
        expect(supabase.auth.getUser).not.toHaveBeenCalled();
    });

    it('cada miembro lleva a su lista de deseos', () => {
        render(<GroupDetailsPage />);

        fireEvent.click(screen.getByText(DEMO_MEMBER.profiles.display_name));

        expect(routerPush).toHaveBeenCalledWith({
            pathname: '/wishlist/[id]',
            params: {
                id: DEMO_MEMBER.user_id,
                name: DEMO_MEMBER.profiles.display_name,
            },
        });
    });
});

describe('Lista del miembro de demostración', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        params.id = DEMO_MEMBER.user_id;
        delete params.name;
    });

    it('pinta los deseos de Marta, incluido el reservado, y no pregunta a Supabase', () => {
        render(<UserWishlistPage />);

        expect(screen.getByText(`Lista de ${DEMO_MEMBER.profiles.display_name}`)).toBeInTheDocument();
        for (const deseo of DEMO_MEMBER_WISHES) {
            expect(screen.getByText(deseo.title)).toBeInTheDocument();
        }

        // El estado de reserva llega a la tarjeta tal cual: el deseo reservado se anuncia y se tapa
        // como el de una persona de verdad, para que nadie regale dos veces lo mismo.
        const reservado = DEMO_MEMBER_WISHES.find((deseo) => deseo.reservationState === 'reserved_by_other');

        expect(reservado).toBeDefined();
        expect(screen.getByText('🔒 Reservado')).toBeInTheDocument();
        expect(screen.getByLabelText(new RegExp(`^${reservado!.title}.*\\. Reservado\\.$`))).toBeInTheDocument();

        expect(screen.queryByText('Lista vacía')).toBeNull();
        expect(supabase.from).not.toHaveBeenCalled();
        expect(supabase.auth.getUser).not.toHaveBeenCalled();
    });

    it('no deja al alcance ningún control que escriba', () => {
        render(<UserWishlistPage />);

        // Reservar y cancelar escriben en la base de datos: en un miembro de ejemplo no existen.
        expect(screen.queryByTestId('wish-reserve-button')).toBeNull();
        expect(screen.queryByTestId('wish-cancel-reserve-button')).toBeNull();

        fireEvent.click(screen.getByText(DEMO_MEMBER_WISHES[0].title));

        expect(supabase.from).not.toHaveBeenCalled();
    });
});
