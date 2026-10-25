import React, { useEffect, useRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTourState, current, type TourCurrent, type TourStep } from '@/lib/tour/engine';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { TourTargetProvider, useTourTargetRegistry } from '@/components/tour/TourTargetProvider';
import type { TargetRect } from '@/lib/tour/targets';
import { cancelAnimation, withTiming } from 'react-native-reanimated';

/**
 * El overlay no decide el orden del tour: pinta lo que el motor ya decidió. Por eso los casos se
 * preparan con `current(state)` del motor de verdad y aquí sólo se comprueba la presentación —que
 * sin medida no se pinta nada, que los botones son los que toca, que la tarjeta es un modal que
 * anuncia la página nueva, que el velo bloquea la página de detrás y que `reduceMotion` no anima—.
 *
 * `reanimated` se sustituye por una implementación mínima: en jsdom no hay hilo de animación, y lo
 * que hay que probar es que se le pide animar (o no), no los fotogramas.
 */
vi.mock('react-native-reanimated', async () => {
    const React = await import('react');
    const { View } = await import('react-native');

    return {
        __esModule: true,
        default: { View },
        // Estable entre renders, como el de verdad: si cambiara de identidad, el efecto volvería a
        // animar en cada render y el test de «no anima» mediría ruido.
        useSharedValue: (inicial: number) => React.useRef({ value: inicial }).current,
        useAnimatedStyle: () => ({}),
        withTiming: vi.fn((valor: number) => valor),
        cancelAnimation: vi.fn(),
    };
});

const PASOS: TourStep[] = [
    {
        id: 'deseos',
        targetId: 'objetivo',
        pages: ['Tus deseos viven en este muro', 'Los de tus grupos también aparecen'],
    },
    {
        id: 'grupos',
        targetId: 'objetivo',
        pages: ['Aquí están tus grupos'],
    },
];

const RECT: TargetRect = { x: 40, y: 120, width: 200, height: 60 };
const OTRO_RECT: TargetRect = { x: 0, y: 600, width: 320, height: 56 };

function parada(stepIndex: number, pageIndex: number): TourCurrent {
    const actual = current({ ...createTourState(PASOS), stepIndex, pageIndex });

    if (!actual) throw new Error('El catálogo de prueba no tiene paradas');

    return actual;
}

/**
 * El objetivo, como lo haría una pantalla: se registra una vez y su caja se vuelve a medir cuando
 * cambia. Registrar de nuevo en cada cambio de caja sería otro caso —un nodo que se remonta— y aquí
 * lo que se prueba es la transición entre paradas.
 */
function Objetivo({ rect }: { rect: TargetRect | null }) {
    const registro = useTourTargetRegistry();
    const medida = useRef<TargetRect | null>(rect);

    useEffect(() => {
        medida.current = rect;

        void registro.refresh('objetivo');
    }, [registro, rect]);

    useEffect(() => {
        registro.register('objetivo', () => medida.current);
        void registro.refresh('objetivo');

        return () => registro.unregister('objetivo');
    }, [registro]);

    return null;
}

type ArnesProps = {
    actual: TourCurrent | null;
    rect?: TargetRect | null;
    reduceMotion?: boolean;
    onNext?: () => void;
    onPrevious?: () => void;
    onSkip?: () => void;
    onTargetMissing?: () => void;
};

function Arnes({
    actual,
    rect = RECT,
    reduceMotion = false,
    onNext = () => {},
    onPrevious = () => {},
    onSkip = () => {},
    onTargetMissing,
}: ArnesProps) {
    return (
        <TourTargetProvider>
            <Objetivo rect={rect} />
            <TourOverlay
                current={actual}
                onNext={onNext}
                onPrevious={onPrevious}
                onSkip={onSkip}
                reduceMotion={reduceMotion}
                onTargetMissing={onTargetMissing}
            />
        </TourTargetProvider>
    );
}

describe('TourOverlay: el hueco, el anillo y la tarjeta', () => {
    beforeEach(() => {
        vi.mocked(withTiming).mockClear();
        vi.mocked(cancelAnimation).mockClear();
    });

    it('sin medida del objetivo no pinta nada: nunca una tarjeta sobre un punto desconocido', () => {
        const { container } = render(<Arnes actual={parada(0, 0)} rect={null} />);

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByText('Siguiente')).toBeNull();
    });

    it('sin parada actual tampoco pinta nada', () => {
        const { container } = render(<Arnes actual={null} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('avisa cuando el objetivo no aparece, una sola vez por objetivo ausente', () => {
        const aviso = vi.fn();
        const { rerender } = render(<Arnes actual={parada(0, 0)} rect={null} onTargetMissing={aviso} />);

        expect(aviso).toHaveBeenCalledTimes(1);

        // Un render más no vuelve a avisar: si no, el padre entraría en un bucle de reintentos.
        rerender(<Arnes actual={parada(0, 0)} rect={null} onTargetMissing={aviso} />);

        expect(aviso).toHaveBeenCalledTimes(1);
    });

    it('pinta la página y las etiquetas que ya calculó el motor', async () => {
        render(<Arnes actual={parada(0, 1)} />);

        await screen.findByText('Los de tus grupos también aparecen');
        expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
        expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    });

    it('en la primera página del tour no hay «Anterior»; después sí', async () => {
        const { rerender } = render(<Arnes actual={parada(0, 0)} />);

        await screen.findByText('Tus deseos viven en este muro');
        expect(screen.queryByText('Anterior')).toBeNull();

        rerender(<Arnes actual={parada(0, 1)} />);

        expect(screen.getByText('Anterior')).toBeInTheDocument();
    });

    it('«Siguiente» en medio y «Terminar» en la última página del último paso', async () => {
        const { rerender } = render(<Arnes actual={parada(0, 1)} />);

        await screen.findByText('Siguiente');
        expect(screen.queryByText('Terminar')).toBeNull();

        rerender(<Arnes actual={parada(1, 0)} />);

        expect(screen.getByText('Terminar')).toBeInTheDocument();
        expect(screen.queryByText('Siguiente')).toBeNull();
    });

    it('«Saltar» está siempre, también en el final', async () => {
        render(<Arnes actual={parada(1, 0)} />);

        expect(await screen.findByText('Saltar')).toBeInTheDocument();
    });

    it('los botones llaman a lo que les pasa el padre, nunca avanzan solos', async () => {
        const onNext = vi.fn();
        const onPrevious = vi.fn();
        const onSkip = vi.fn();
        render(<Arnes actual={parada(0, 1)} onNext={onNext} onPrevious={onPrevious} onSkip={onSkip} />);

        fireEvent.click(await screen.findByLabelText('Página anterior del tour'));
        fireEvent.click(screen.getByLabelText('Siguiente página del tour'));
        fireEvent.click(screen.getByLabelText('Saltar el tour'));

        expect(onPrevious).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('la tarjeta es un modal para lectores de pantalla y anuncia la página nueva', async () => {
        render(<Arnes actual={parada(0, 0)} />);

        const pagina = await screen.findByText('Tus deseos viven en este muro');

        expect(screen.getByTestId('tour-card')).toHaveAttribute('aria-modal', 'true');
        expect(pagina).toHaveAttribute('aria-live', 'polite');
    });

    it('el velo bloquea la página de detrás', async () => {
        render(<Arnes actual={parada(0, 0)} />);

        await screen.findByText('Tus deseos viven en este muro');

        // Cuatro piezas de velo y una capa que se come los toques: la página no se puede usar.
        expect(screen.getByTestId('tour-scrim-blocker')).toBeInTheDocument();
        expect(screen.getByTestId('tour-scrim-top')).toBeInTheDocument();
        expect(screen.getByTestId('tour-scrim-bottom')).toBeInTheDocument();
        expect(screen.getByTestId('tour-scrim-left')).toBeInTheDocument();
        expect(screen.getByTestId('tour-scrim-right')).toBeInTheDocument();
        expect(screen.getByTestId('tour-ring')).toBeInTheDocument();
    });

    it('en web, Escape salta el tour', async () => {
        const onSkip = vi.fn();
        render(<Arnes actual={parada(0, 0)} onSkip={onSkip} />);

        await screen.findByText('Tus deseos viven en este muro');
        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('sin reduceMotion anima el cambio de parada', async () => {
        const { rerender } = render(<Arnes actual={parada(0, 0)} />);

        await screen.findByText('Tus deseos viven en este muro');

        rerender(<Arnes actual={parada(1, 0)} rect={OTRO_RECT} />);

        await waitFor(() => expect(withTiming).toHaveBeenCalled());
    });

    it('la primera aparición no anima: llegar no es moverse', async () => {
        render(<Arnes actual={parada(0, 0)} />);

        await screen.findByText('Tus deseos viven en este muro');

        // Sin una colocación anterior no hay transición que hacer: animar desde la esquina sería
        // un barrido por toda la pantalla, no un cambio entre paradas.
        expect(withTiming).not.toHaveBeenCalled();
    });

    it('con reduceMotion salta sin animar', async () => {
        const { rerender } = render(<Arnes actual={parada(0, 0)} reduceMotion />);

        await screen.findByText('Tus deseos viven en este muro');
        vi.mocked(withTiming).mockClear();
        vi.mocked(cancelAnimation).mockClear();

        rerender(<Arnes actual={parada(1, 0)} rect={OTRO_RECT} reduceMotion />);

        await waitFor(() => expect(cancelAnimation).toHaveBeenCalled());
        expect(withTiming).not.toHaveBeenCalled();
    });
});
