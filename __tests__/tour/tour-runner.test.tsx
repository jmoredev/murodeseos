import React, { useEffect, useMemo } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TourStep } from '@/lib/tour/engine';
import type { Tab } from '@/lib/tabs';
import type { TargetRect } from '@/lib/tour/targets';
import { TourRunner } from '@/components/tour/TourRunner';
import { TourTargetProvider, useTourTargetRegistry } from '@/components/tour/TourTargetProvider';

/**
 * El corredor del tour: dueño del estado y de la navegación entre paradas (S3).
 *
 * Lo que se prueba aquí es el contrato que T6 necesita: pedir el destino **una vez por parada** y
 * no en cada render (si no, el efecto navegaría en bucle cada vez que llega un repintado), que
 * Siguiente/Anterior/Saltar muevan el catálogo de verdad y que el final se anuncie una sola vez.
 *
 * `reanimated` se sustituye por una implementación mínima: en jsdom no hay hilo de animación y lo
 * que importa aquí es el orden del recorrido, no los fotogramas.
 */
// El corredor lee el pathname de expo-router: en las pruebas no hay navegador, se fija.
vi.mock('expo-router', () => ({ usePathname: () => '/' }));

vi.mock('react-native-reanimated', async () => {
    const React = await import('react');
    const { View } = await import('react-native');

    return {
        __esModule: true,
        default: { View },
        useSharedValue: (inicial: number) => React.useRef({ value: inicial }).current,
        useAnimatedStyle: () => ({}),
        withTiming: vi.fn((valor: number) => valor),
        cancelAnimation: vi.fn(),
    };
});

const RECT: TargetRect = { x: 12, y: 40, width: 240, height: 56 };

/** Dos paradas con dos páginas la primera: alcanza para cruzar una frontera de paso. */
const PASOS: readonly TourStep[] = [
    {
        id: 'bienvenida',
        targetId: 'objetivo',
        tab: 'wishlist',
        pages: ['Bienvenido al tour', 'La lista de deseos'],
    },
    {
        id: 'nuevo',
        targetId: 'objetivo',
        route: '/wishlist/add',
        pages: ['Añade un deseo'],
    },
];

/** Una medida estable entre repintados: es lo que el `ref` del registro espera. */
const MEDIDAS: Readonly<Record<string, TargetRect | null>> = { objetivo: RECT };

/**
 * Sub-ruta y luego paradas de la portada: el camino de vuelta, dos veces. La primera vuelta la
 * crea el tour (él abrió la sub-ruta); la segunda no, porque la vuelta ya se gastó.
 */
const PASOS_DE_VUELTA: readonly TourStep[] = [
    {
        id: 'formulario',
        targetId: 'objetivo',
        route: '/wishlist/add',
        pages: ['Añade un deseo'],
    },
    {
        id: 'grupos',
        targetId: 'objetivo',
        tab: 'groups',
        pages: ['Tus grupos'],
    },
    {
        id: 'lista-grupos',
        targetId: 'objetivo',
        tab: 'groups',
        pages: ['La lista de grupos'],
    },
];

/** La segunda parada apunta a un objetivo que todavía no se ha medido. */
const PASOS_CON_HUECO: readonly TourStep[] = [
    { id: 'bienvenida', targetId: 'presente', tab: 'wishlist', pages: ['Bienvenido al tour'] },
    { id: 'ausente', targetId: 'ausente', tab: 'wishlist', pages: ['Esta pantalla tarda'] },
];

const MEDIDAS_CON_HUECO: Readonly<Record<string, TargetRect | null>> = {
    presente: RECT,
    ausente: null,
};

/**
 * Los objetivos, como los daría de alta una pantalla: un registro por id y una medida fija. Aquí
 * se estuban a propósito —lo que se prueba es el corredor—, y con la medida en un `ref` de módulo
 * no hay efectos que se reabran en cada render.
 */
function Objetivo({
    medidas,
    onMedir,
}: {
    medidas: Readonly<Record<string, TargetRect | null>>;
    onMedir?: (id: string) => void;
}) {
    const registro = useTourTargetRegistry();
    const ids = useMemo(() => Object.keys(medidas), [medidas]);

    useEffect(() => {
        for (const id of ids) {
            registro.register(id, () => {
                onMedir?.(id);

                return medidas[id] ?? null;
            });
        }

        return () => {
            for (const id of ids) registro.unregister(id);
        };
    }, [registro, ids, medidas, onMedir]);

    return null;
}

type ArnesProps = {
    pasos?: readonly TourStep[];
    tab?: Tab;
    pathname?: string;
    medidas?: Readonly<Record<string, TargetRect | null>>;
    onNavigate?: (destino: unknown) => void;
    onFinish?: (estado: string) => void;
    onMedir?: (id: string) => void;
};

function Arnes({
    pasos = PASOS,
    tab = 'groups',
    pathname = '/',
    medidas = { objetivo: RECT },
    onNavigate = () => {},
    onFinish = () => {},
    onMedir,
}: ArnesProps) {
    return (
        <TourTargetProvider>
            <Objetivo medidas={medidas} onMedir={onMedir} />
            <TourRunner
                steps={pasos}
                tab={tab}
                pathname={pathname}
                onNavigate={onNavigate}
                onFinish={onFinish}
            />
        </TourTargetProvider>
    );
}

describe('TourRunner: navegación entre paradas', () => {
    it('pide el destino de la primera parada al montar', async () => {
        const onNavigate = vi.fn();
        render(<Arnes onNavigate={onNavigate} />);

        // El overlay ya está pintado: los efectos del corredor han corrido.
        await screen.findByText('Bienvenido al tour');

        expect(onNavigate).toHaveBeenCalledTimes(1);
        expect(onNavigate).toHaveBeenCalledWith({ kind: 'tab', tab: 'wishlist' });
    });

    it('no vuelve a pedir el destino al repintar la misma parada', async () => {
        const onNavigate = vi.fn();
        const { rerender } = render(<Arnes onNavigate={onNavigate} />);

        await screen.findByText('Bienvenido al tour');

        // El padre reacciona a la navegación y vuelve a pintar: si el efecto no recordara la parada
        // ya atendida, esto sería un bucle de «navega → render → navega».
        rerender(<Arnes onNavigate={onNavigate} pathname="/?tab=wishlist" />);
        rerender(<Arnes onNavigate={onNavigate} pathname="/wishlist/add" />);

        expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('no pide navegación cuando el destino es la pantalla en la que ya estamos', async () => {
        const onNavigate = vi.fn();
        render(<Arnes onNavigate={onNavigate} tab="wishlist" pathname="/" />);

        await screen.findByText('Bienvenido al tour');

        expect(onNavigate).not.toHaveBeenCalled();
    });

    it('al cruzar a la parada siguiente pide su destino, y sólo una vez', async () => {
        const onNavigate = vi.fn();
        render(<Arnes onNavigate={onNavigate} />);

        // Primera página → segunda página: misma parada, no hay nada que navegar.
        fireEvent.click(await screen.findByLabelText('Siguiente página del tour'));
        expect(onNavigate).toHaveBeenCalledTimes(1);

        // Segunda página → parada nueva: la ruta del formulario de alta.
        fireEvent.click(screen.getByLabelText('Siguiente página del tour'));
        expect(onNavigate).toHaveBeenCalledTimes(2);
        expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'route', route: '/wishlist/add' });
    });

    it('refresca los objetivos una vez al llegar a una parada sin medida, no en cada render', async () => {
        const onMedir = vi.fn();
        const { rerender } = render(
            <Arnes
                pasos={PASOS_CON_HUECO}
                medidas={MEDIDAS_CON_HUECO}
                onMedir={onMedir}
            />
        );

        // La primera parada ya está medida: el overlay se pinta y no hay nada que reintentar.
        fireEvent.click(await screen.findByLabelText('Siguiente página del tour'));

        const medidasDeLaAusente = () => onMedir.mock.calls.filter(([id]) => id === 'ausente').length;

        expect(medidasDeLaAusente()).toBe(1);

        // Un repintado no vuelve a medir: el aviso del overlay es por parada, y el corredor
        // recuerda cuál ya reintentó.
        rerender(
            <Arnes
                pasos={PASOS_CON_HUECO}
                medidas={MEDIDAS_CON_HUECO}
                onMedir={onMedir}
            />
        );

        expect(medidasDeLaAusente()).toBe(1);
    });
});

describe('TourRunner: volver a la portada', () => {
    it('pide volver atrás cuando fue el tour quien empujó la ruta en la que está', async () => {
        const onNavigate = vi.fn();
        const { rerender } = render(
            <Arnes
                pasos={PASOS_DE_VUELTA}
                tab="wishlist"
                pathname="/"
                medidas={MEDIDAS}
                onNavigate={onNavigate}
            />
        );

        expect(await screen.findByText('Añade un deseo')).toBeInTheDocument();
        // El tour abre la sub-ruta: el push es suyo y lo recuerda.
        expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'route', route: '/wishlist/add' });

        rerender(
            <Arnes
                pasos={PASOS_DE_VUELTA}
                tab="wishlist"
                pathname="/wishlist/add"
                medidas={MEDIDAS}
                onNavigate={onNavigate}
            />
        );
        fireEvent.click(screen.getByLabelText('Siguiente página del tour'));

        // Debajo de esta sub-ruta está la portada que dejó el propio tour: se deshace el push, con
        // la pestaña de la parada en la ruta, en vez de empujar una segunda copia del muro. El
        // segundo argumento es el permiso de volver, y sólo lo da quien empujó esta ruta.
        expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'route', route: '/?tab=groups' }, true);
    });

    it('desde un enlace directo que el tour no empujó pide la portada, nunca retroceder', async () => {
        const onNavigate = vi.fn();
        render(
            <Arnes
                pasos={PASOS_DE_VUELTA}
                tab="wishlist"
                pathname="/wishlist/add"
                medidas={MEDIDAS}
                onNavigate={onNavigate}
            />
        );

        // El usuario ya estaba en la sub-ruta: el tour no ha empujado nada.
        expect(await screen.findByText('Añade un deseo')).toBeInTheDocument();
        expect(onNavigate).not.toHaveBeenCalled();

        fireEvent.click(screen.getByLabelText('Siguiente página del tour'));

        // Debajo de esta pantalla no hay una portada que el tour haya abierto: se empuja la parada,
        // y se pide sin el permiso de volver (un solo argumento: nadie autorizó el `back`).
        expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'route', route: '/?tab=groups' });
        expect(onNavigate.mock.lastCall).toHaveLength(1);
    });

    it('da una vuelta por cada empujón: la vuelta gastada no se repite', async () => {
        const onNavigate = vi.fn();
        const { rerender } = render(
            <Arnes
                pasos={PASOS_DE_VUELTA}
                tab="wishlist"
                pathname="/"
                medidas={MEDIDAS}
                onNavigate={onNavigate}
            />
        );

        expect(await screen.findByText('Añade un deseo')).toBeInTheDocument();

        rerender(
            <Arnes
                pasos={PASOS_DE_VUELTA}
                tab="wishlist"
                pathname="/wishlist/add"
                medidas={MEDIDAS}
                onNavigate={onNavigate}
            />
        );
        fireEvent.click(screen.getByLabelText('Siguiente página del tour'));
        expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'route', route: '/?tab=groups' }, true);

        // La vuelta ya se consumió: la siguiente parada de la portada pide su ruta, no otra vuelta.
        fireEvent.click(screen.getByLabelText('Siguiente página del tour'));
        expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'route', route: '/?tab=groups' });
        expect(onNavigate.mock.lastCall).toHaveLength(1);
    });
});

describe('TourRunner: el recorrido', () => {
    it('Siguiente y Anterior mueven páginas y paradas', async () => {
        render(<Arnes />);

        expect(await screen.findByText('Bienvenido al tour')).toBeInTheDocument();
        expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Siguiente página del tour'));
        expect(screen.getByText('La lista de deseos')).toBeInTheDocument();
        expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Siguiente página del tour'));
        expect(screen.getByText('Añade un deseo')).toBeInTheDocument();
        expect(screen.getByText('Paso 2 de 2')).toBeInTheDocument();

        // En la última página del último paso el botón es «Terminar».
        expect(screen.getByText('Terminar')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Página anterior del tour'));
        expect(screen.getByText('La lista de deseos')).toBeInTheDocument();
    });

    it('al terminar el catálogo avisa una sola vez con «completed»', async () => {
        const onFinish = vi.fn();
        render(<Arnes onFinish={onFinish} />);

        fireEvent.click(await screen.findByLabelText('Siguiente página del tour'));
        fireEvent.click(screen.getByLabelText('Siguiente página del tour'));
        fireEvent.click(screen.getByLabelText('Terminar el tour'));

        expect(onFinish).toHaveBeenCalledTimes(1);
        expect(onFinish).toHaveBeenCalledWith('completed');
    });

    it('saltar avisa con «skipped» sin recorrer el resto', async () => {
        const onFinish = vi.fn();
        render(<Arnes onFinish={onFinish} />);

        fireEvent.click(await screen.findByLabelText('Saltar el tour'));

        expect(onFinish).toHaveBeenCalledTimes(1);
        expect(onFinish).toHaveBeenCalledWith('skipped');
    });

    it('al terminar o saltar se lleva el velo: no queda un tour cerrado oscureciendo la pantalla', async () => {
        render(<Arnes />);

        // Sin saltar, el velo está: es lo que hace visible el hueco.
        expect(await screen.findByTestId('tour-scrim-top')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Saltar el tour'));

        expect(screen.queryByTestId('tour-scrim-top')).not.toBeInTheDocument();
        expect(screen.queryByTestId('tour-card')).not.toBeInTheDocument();
    });
});

describe('TourRunner: sin registro de objetivos', () => {
    it('avisa en vez de quedarse con un overlay mudo', () => {
        // Sin `TourTargetProvider` no hay dónde medir: un tour que no pinta nada es más caro de
        // diagnosticar que un mensaje que dice qué falta (mismo criterio que `useTourTargetRegistry`).
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() =>
            render(
                <TourRunner
                    steps={PASOS}
                    tab="wishlist"
                    pathname="/"
                    onNavigate={() => {}}
                    onFinish={() => {}}
                />
            )
        ).toThrow(/TourTargetProvider/);

        error.mockRestore();
    });
});
