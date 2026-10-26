import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import {
    TourTargetProvider,
    useTourTarget,
    useTourTargetRegistry,
} from '@/components/tour/TourTargetProvider';
import type { TargetRegistry } from '@/lib/tour/targets';

/**
 * Los objetivos de las pestañas de la portada no pueden morir porque otra pantalla pinte el mismo
 * layout (S7, D5).
 *
 * El registro de objetivos guarda **una** medida por id y dar de baja un id lo borra: no hay forma de
 * que dos pantallas registren el mismo `tab-*` y sobreviva el alta de la que se queda. Por eso los tres
 * ids son de la portada y de nadie más. El detalle de un grupo y la lista de una persona pintan la
 * misma barra —el dock del móvil, la tablist del escritorio— pero no son la portada, y al desmontarse
 * (el tour vuelve con un `back`, D5) se llevaban por delante la medida que la portada necesitaba para
 * su hueco. La parada `perfil` se quedaba sin tarjeta: sin medida, el velo no pinta nada.
 *
 * La prueba no mira el registro por dentro: monta la portada como la monta `app/index.tsx`, monta
 * encima una sub-ruta como las monta el tour y comprueba lo único que importa —que al volver, los tres
 * objetivos siguen medibles—. Y la comprueba en las dos formas de pestaña, porque el guion no sabe en
 * cuál está.
 */

const RAIZ_PORTADA = 'la portada';
const RAIZ_DETALLE = 'el detalle del grupo';

const IDS = ['tab-deseos', 'tab-grupos', 'tab-perfil'] as const;

// `ResponsiveLayout` monta el menú de notificaciones, que pide las notificaciones y abre un canal de
// realtime al montar. Aquí no se prueba nada de eso —ya tiene sus propios tests—, así que se sustituye
// por dobles locales para que la pantalla se pinte sin red, igual que en `tab-targets.test.tsx`.
vi.mock('@/lib/supabase', () => ({
    supabase: {
        channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
        removeChannel: vi.fn(),
    },
}));

vi.mock('@/lib/notification-utils', () => ({
    getNotifications: vi.fn(async () => []),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
}));

vi.mock('@/lib/reminder-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/reminder-utils')>();

    return { ...actual, ensureBirthdayReminders: vi.fn(async () => {}) };
});

const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

function anchoDeVentana(width: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

afterEach(() => {
    if (originalInnerWidth) {
        Object.defineProperty(window, 'innerWidth', originalInnerWidth);
    } else {
        delete (window as unknown as Record<string, unknown>).innerWidth;
    }
});

/** Deja el registro del proveedor a mano del test, sin preguntar por dentro de la pantalla. */
function Sonda({ registroRef }: { registroRef: { current: TargetRegistry | null } }) {
    const registro = useTourTargetRegistry();

    useEffect(() => {
        registroRef.current = registro;
    }, [registroRef, registro]);

    return null;
}

/**
 * La portada: es la dueña de los tres ids y se los pasa al layout, como hace `app/index.tsx`.
 *
 * Los enganches viven aquí, en la pantalla que es la portada, y no dentro de `ResponsiveLayout`, para
 * que una sub-ruta que pinta el mismo layout no reclame los mismos ids.
 */
function Portada() {
    const deseos = useTourTarget('tab-deseos');
    const grupos = useTourTarget('tab-grupos');
    const perfil = useTourTarget('tab-perfil');

    return (
        <ResponsiveLayout
            userId="user-1"
            activeTab="wishlist"
            setActiveTab={vi.fn()}
            onSignOut={vi.fn()}
            objetivosPestanas={{ deseos, grupos, perfil }}
        >
            <div>{RAIZ_PORTADA}</div>
        </ResponsiveLayout>
    );
}

/** Una sub-ruta: pinta la misma barra para verse igual, pero sus pestañas no son objetivo de nadie. */
function Detalle() {
    return (
        <ResponsiveLayout
            userId="user-1"
            activeTab="groups"
            setActiveTab={vi.fn()}
            onSignOut={vi.fn()}
        >
            <div>{RAIZ_DETALLE}</div>
        </ResponsiveLayout>
    );
}

/** Se mide lo que hay registrado ahora mismo: es lo que el velo usa para dibujar el hueco. */
async function medirLosTres(registro: TargetRegistry, momento: string) {
    await act(async () => {
        await registro.refresh();
    });

    for (const id of IDS) {
        expect(registro.measure(id), `«${id}» quedó sin medida ${momento}`).not.toBeNull();
    }
}

describe.each([
    { ancho: 1280, forma: 'escritorio' },
    { ancho: 375, forma: 'móvil' },
])('ResponsiveLayout: los objetivos de la portada sobreviven a otra pantalla ($forma)', ({ ancho }) => {
    it('siguen medibles cuando se desmonta la pantalla que pintaba el mismo layout', async () => {
        anchoDeVentana(ancho);

        const registroRef: { current: TargetRegistry | null } = { current: null };

        const conPortada = (
            <TourTargetProvider>
                <Sonda registroRef={registroRef} />
                <Portada />
            </TourTargetProvider>
        );

        const { rerender } = render(conPortada);

        // El tour empuja el detalle de un grupo encima de la portada: dos pantallas, el mismo layout.
        rerender(
            <TourTargetProvider>
                <Sonda registroRef={registroRef} />
                <Portada />
                <Detalle />
            </TourTargetProvider>
        );
        await medirLosTres(registroRef.current!, 'mientras la otra pantalla está montada');

        // Y vuelve con un `back`: ésta es la baja que se llevaba por delante el alta de la portada.
        rerender(conPortada);

        await medirLosTres(registroRef.current!, 'después de desmontar la otra pantalla');
    });
});
