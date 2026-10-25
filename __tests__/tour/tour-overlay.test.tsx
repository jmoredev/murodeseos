import React, { useEffect, useRef } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTourState, current, type TourCurrent, type TourStep } from '@/lib/tour/engine';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { TourTargetProvider, useTourTargetRegistry } from '@/components/tour/TourTargetProvider';
import type { TargetRect } from '@/lib/tour/targets';
import {
    CARD_MARGIN,
    RING_INSET,
    RING_THICKNESS,
    TARJETA_ESTIMADA,
    ringRect,
    type Rect,
} from '@/lib/tour/geometry';
import { useTamanoTarjeta } from '@/lib/tour/use-card-size';
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
/** La barra de pestañas del dock: el hueco pegado al borde inferior que motivó la hoja móvil. */
const RECT_TABBAR: TargetRect = { x: 20, y: 650, width: 320, height: 56 };

/**
 * Fija el viewport que ve `useWindowDimensions`. jsdom no calcula `clientWidth`/`clientHeight`, así
 * que sin esto la geometría se probaría con una pantalla de 0×0. El evento `resize` es el que usa
 * `Dimensions` de react-native-web para refrescar su caché.
 */
function fijarViewport(ancho: number, alto: number) {
    Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        get: () => ancho,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
        configurable: true,
        get: () => alto,
    });

    window.dispatchEvent(new Event('resize'));
}

afterAll(() => {
    delete (document.documentElement as { clientWidth?: unknown }).clientWidth;
    delete (document.documentElement as { clientHeight?: unknown }).clientHeight;
});

/**
 * Emula lo que el navegador le dice a `onLayout` cuando la tarjeta ya está pintada. Se usa el
 * manejador que react-native-web deja en el nodo (`__reactLayoutHandler`): jsdom no tiene
 * `ResizeObserver`, y simular el observador mediría ceros.
 */
type NodoConLayout = HTMLElement & { __reactLayoutHandler?: (evento: unknown) => void };

function medirTarjeta(alto: number, ancho = 320) {
    const manejador = (screen.getByTestId('tour-card') as NodoConLayout).__reactLayoutHandler;

    if (!manejador) throw new Error('la tarjeta no está observando su layout');

    act(() => {
        manejador({ nativeEvent: { layout: { x: 0, y: 0, width: ancho, height: alto } } });
    });
}

/** La colocación que el overlay decidió, leída de los atributos de diagnóstico de la tarjeta. */
function cajaDeLaTarjeta(): Rect {
    const tarjeta = screen.getByTestId('tour-card');
    const leer = (atributo: string) => Number(tarjeta.getAttribute(atributo));

    return {
        x: leer('data-tour-x'),
        y: leer('data-tour-y'),
        width: leer('data-tour-ancho'),
        height: leer('data-tour-alto'),
    };
}

function seSolapan(a: Rect, b: Rect): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

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
        fijarViewport(1024, 768);
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

/**
 * El arnés del foco: una página con un ancla enfocable, para comprobar que el tour devuelve el foco
 * a donde estaba cuando se cierra.
 */
function ArnesConAncla({ actual }: { actual: TourCurrent | null }) {
    return (
        <TourTargetProvider>
            <Objetivo rect={RECT} />
            <button type="button" data-testid="antes-del-tour">
                Antes del tour
            </button>
            <TourOverlay
                current={actual}
                onNext={() => {}}
                onPrevious={() => {}}
                onSkip={() => {}}
            />
        </TourTargetProvider>
    );
}

describe('TourOverlay: foco y teclado', () => {
    beforeEach(() => {
        fijarViewport(1024, 768);
    });

    it('al abrirse el foco entra en la tarjeta, y al cambiar de página también', async () => {
        const { rerender } = render(<Arnes actual={parada(0, 0)} />);

        const tarjeta = await screen.findByTestId('tour-card');

        expect(tarjeta).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(tarjeta);

        rerender(<Arnes actual={parada(0, 1)} />);

        expect(document.activeElement).toBe(tarjeta);
    });

    it('Tab desde el último enfocable de la tarjeta vuelve al primero', async () => {
        render(<Arnes actual={parada(0, 1)} />);

        const primero = await screen.findByLabelText('Página anterior del tour');
        const ultimo = screen.getByLabelText('Siguiente página del tour');

        ultimo.focus();
        expect(document.activeElement).toBe(ultimo);

        fireEvent.keyDown(document, { key: 'Tab' });

        expect(document.activeElement).toBe(primero);
    });

    it('Mayús+Tab desde el primero vuelve al último', async () => {
        render(<Arnes actual={parada(0, 1)} />);

        const primero = await screen.findByLabelText('Página anterior del tour');
        const ultimo = screen.getByLabelText('Siguiente página del tour');

        primero.focus();
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

        expect(document.activeElement).toBe(ultimo);
    });

    it('al cerrar devuelve el foco a donde estaba antes del tour', async () => {
        const { rerender } = render(<ArnesConAncla actual={null} />);

        const ancla = screen.getByTestId('antes-del-tour');
        ancla.focus();
        expect(document.activeElement).toBe(ancla);

        rerender(<ArnesConAncla actual={parada(0, 0)} />);
        expect(await screen.findByTestId('tour-card')).toBe(document.activeElement);

        // Terminar o saltar desmonta el overlay: el foco no se puede quedar en el vacío.
        rerender(<ArnesConAncla actual={null} />);

        expect(document.activeElement).toBe(ancla);
    });
});

describe('TourOverlay: la tarjeta se mide antes de colocarse', () => {
    it('antes de la primera medida usa la estimación exportada', async () => {
        fijarViewport(360, 740);

        render(<Arnes actual={parada(0, 0)} rect={RECT_TABBAR} />);

        await screen.findByTestId('tour-card');

        expect(cajaDeLaTarjeta().height).toBe(TARJETA_ESTIMADA.height);
        expect(screen.getByTestId('tour-card')).toHaveAttribute('data-tour-colocacion', 'sheet');
    });

    it('una tarjeta medida más alta que la estimación se recoloca y no tapa el hueco', async () => {
        fijarViewport(360, 740);

        render(<Arnes actual={parada(0, 0)} rect={RECT_TABBAR} />);

        await screen.findByText('Tus deseos viven en este muro');

        const anillo = ringRect(RECT_TABBAR, RING_INSET, RING_THICKNESS);
        // La estimación colocaba una tarjeta de 190 px; la de verdad mide 420. Con la estimación
        // el crecimiento hacia abajo acabaría encima del hueco.
        medirTarjeta(420);

        const caja = cajaDeLaTarjeta();

        expect(caja.height).toBe(420);
        expect(seSolapan(caja, anillo)).toBe(false);
        expect(caja.y + caja.height).toBeLessThanOrEqual(740 - CARD_MARGIN);
    });

    it('una tarjeta altísima se recorta a la banda libre y no se sale de la pantalla', async () => {
        fijarViewport(360, 740);

        render(<Arnes actual={parada(0, 0)} rect={RECT_TABBAR} />);

        await screen.findByText('Tus deseos viven en este muro');

        const anillo = ringRect(RECT_TABBAR, RING_INSET, RING_THICKNESS);

        medirTarjeta(5000);

        const caja = cajaDeLaTarjeta();

        expect(caja.height).toBeLessThan(5000);
        expect(caja.height).toBeGreaterThan(0);
        expect(seSolapan(caja, anillo)).toBe(false);
        expect(caja.y).toBeGreaterThanOrEqual(CARD_MARGIN);
        expect(caja.y + caja.height).toBeLessThanOrEqual(740 - CARD_MARGIN);
    });

    it('no oscila: sólo acepta una corrección por paso', async () => {
        fijarViewport(360, 740);

        render(<Arnes actual={parada(0, 0)} rect={RECT_TABBAR} />);

        await screen.findByText('Tus deseos viven en este muro');

        medirTarjeta(420);
        expect(cajaDeLaTarjeta().height).toBe(420);

        // La colocación ya recortó la tarjeta; volver a aceptar esa medida la haría encogerse,
        // recolocarse y volver a medir: el bucle que este guardia evita.
        medirTarjeta(120);
        expect(cajaDeLaTarjeta().height).toBe(420);
    });

    it('en móvil la hoja ocupa el ancho útil entero', async () => {
        fijarViewport(360, 740);

        render(<Arnes actual={parada(0, 0)} rect={RECT} />);

        await screen.findByTestId('tour-card');

        const caja = cajaDeLaTarjeta();

        expect(caja.x).toBe(CARD_MARGIN);
        expect(caja.width).toBe(360 - CARD_MARGIN * 2);
    });

    it('el contenido vive en una zona que se puede desplazar cuando no cabe', async () => {
        fijarViewport(360, 740);

        render(<Arnes actual={parada(0, 0)} rect={RECT_TABBAR} />);

        await screen.findByText('Tus deseos viven en este muro');

        medirTarjeta(5000);

        const contenido = screen.getByTestId('tour-card-content') as HTMLElement;

        // El alto lo manda la colocación; el texto que no quepa se lee desplazando, no tapando el
        // hueco. `overflow-y: auto` es lo que convierte la zona en desplazable; RNW lo aplica con
        // una clase, así que se lee del estilo calculado y no del `style` en línea.
        expect(window.getComputedStyle(contenido).overflowY).toBe('auto');
    });
});

describe('useTamanoTarjeta: la medida de la tarjeta', () => {
    const evento = (width: number, height: number) => ({
        nativeEvent: { layout: { x: 0, y: 0, width, height } },
    });

    it('antes de la primera medida usa la estimación exportada', () => {
        const { result } = renderHook(() => useTamanoTarjeta('paso-1'));

        expect(result.current.size).toBe(TARJETA_ESTIMADA);
        expect(result.current.measured).toBe(false);
    });

    it('ignora las medidas de tamaño cero y acepta la primera medida real', () => {
        const { result } = renderHook(() => useTamanoTarjeta('paso-1'));

        act(() => result.current.onLayout(evento(0, 0)));
        expect(result.current.size).toBe(TARJETA_ESTIMADA);

        act(() => result.current.onLayout(evento(320, 420)));

        expect(result.current.size).toEqual({ width: 320, height: 420 });
        expect(result.current.measured).toBe(true);
    });

    it('sólo acepta una corrección por paso: no hay ida y vuelta de tamaños', () => {
        const { result } = renderHook(() => useTamanoTarjeta('paso-1'));

        act(() => result.current.onLayout(evento(320, 420)));
        act(() => result.current.onLayout(evento(320, 120)));

        expect(result.current.size).toEqual({ width: 320, height: 420 });
    });

    it('al cambiar de paso vuelve a medir', () => {
        const { result, rerender } = renderHook(({ paso }) => useTamanoTarjeta(paso), {
            initialProps: { paso: 'uno' },
        });

        act(() => result.current.onLayout(evento(320, 200)));
        expect(result.current.size).toEqual({ width: 320, height: 200 });

        rerender({ paso: 'dos' });
        expect(result.current.size).toBe(TARJETA_ESTIMADA);

        act(() => result.current.onLayout(evento(320, 300)));
        expect(result.current.size).toEqual({ width: 320, height: 300 });
    });
});
