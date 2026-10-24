import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WishListTab } from '@/components/WishListTab';
import { GroupsTab } from '@/components/GroupsTab';
import { DEMO_GROUP, DEMO_GROUPS, DEMO_WISHES } from '@/lib/tour/demo-data';
import { supabase } from '@/lib/supabase';

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
