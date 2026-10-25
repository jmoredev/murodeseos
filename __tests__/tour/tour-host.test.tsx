import React, { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TourHost, useTourActive, useTourRequestedTab, useTourTabReporter } from '@/components/tour/TourHost';
import { TourTargetProvider, useTourTargetRegistry } from '@/components/tour/TourTargetProvider';
import { TOUR_STEPS } from '@/lib/tour/steps';
import type { Tab } from '@/lib/tabs';
import type { TargetRect } from '@/lib/tour/targets';
import { withTiming } from 'react-native-reanimated';

/**
 * El arranque del tour (S1, D2, D3): quién lo abre, quién lo cierra y quién espera.
 *
 * Lo que se ancla aquí es la política completa del arranque, que es donde estar equivocado se nota
 * en la cara del usuario:
 *
 * - una cuenta nueva (marca `null`) lo ve, y la primera parada se pinta de verdad;
 * - una cuenta que ya lo vio (marca con fecha) no lo ve nunca;
 * - una marca que no se puede leer (`undefined`) deja el tour apagado y **no se reintenta**;
 * - cerrar sesión lo apaga;
 * - saltar (S1) lo apaga y marca la cuenta **una sola vez**;
 * - la pestaña que la portada dice que enseña llega al corredor, y la que pide una parada llega a
 *   `useTourRequestedTab()`, que es lo que la portada usa para cambiarla.
 *
 * La sesión y la base se doblan en el borde de red (`@/lib/supabase`): lo que se prueba es el
 * host, no Supabase. `reanimated` no tiene hilo de animación en jsdom y aquí el movimiento no
 * importa (eso es T7).
 */

const dobles = vi.hoisted(() => {
    type Sesion = { user: { id: string } } | null;
    type Fila = { tour_completed_at: string | null };

    const estado = {
        sesion: null as Sesion,
        fila: { data: { tour_completed_at: null } as Fila | null, error: null as { message: string } | null },
        consultasDeMarca: 0,
        sesionesLeidas: 0,
        escrituras: [] as Record<string, unknown>[],
        oyentes: [] as ((evento: string, sesion: Sesion) => void)[],
        ruta: { pathname: '/' },
    };

    const supabase = {
        auth: {
            getSession: async () => {
                estado.sesionesLeidas += 1;

                return { data: { session: estado.sesion } };
            },
            onAuthStateChange: (oyente: (evento: string, sesion: Sesion) => void) => {
                estado.oyentes.push(oyente);

                return {
                    data: {
                        subscription: {
                            unsubscribe: () => {
                                const indice = estado.oyentes.indexOf(oyente);
                                if (indice >= 0) estado.oyentes.splice(indice, 1);
                            },
                        },
                    },
                };
            },
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => {
                        estado.consultasDeMarca += 1;

                        return { data: estado.fila.data, error: estado.fila.error };
                    },
                }),
            }),
            update: (valores: Record<string, unknown>) => {
                estado.escrituras.push(valores);

                return { eq: async () => ({ error: null }) };
            },
        }),
    };

    const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), setParams: vi.fn() };

    return { estado, supabase, router };
});

vi.mock('@/lib/supabase', () => ({ supabase: dobles.supabase }));

vi.mock('expo-router', () => ({
    useRouter: () => dobles.router,
    usePathname: () => dobles.estado.ruta.pathname,
    useLocalSearchParams: () => ({}),
}));

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

const FECHA = '2026-10-24T13:00:00.000Z';

/** La primera página del guion real: si el tour arrancó, esto está en pantalla. */
const PRIMERA_PAGINA =
    'Este es tu muro de deseos. Lo que apuntes aquí lo verán las personas con las que compartas un grupo.';

const RECT: TargetRect = { x: 8, y: 24, width: 200, height: 48 };

/**
 * La caja que devuelve cada objetivo. Por defecto la misma para todas las paradas; el test de
 * movimiento reducido necesita cajas distintas para que haya algo que mover entre paradas.
 */
let cajaDeObjetivo: (id: string) => TargetRect = () => RECT;

/**
 * La preferencia de movimiento del sistema, tal como la contestaría `matchMedia`. Se instala en
 * `beforeEach` porque el `TourHost` la pregunta al montar y los tests no deben depender del jsdom.
 */
let movimientoReducido = false;

const descriptorMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

function instalarMedios() {
    (window as unknown as { matchMedia: unknown }).matchMedia = vi.fn((consulta: string) => ({
        matches: movimientoReducido,
        media: consulta,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
    }));
}

beforeEach(() => {
    movimientoReducido = false;
    cajaDeObjetivo = () => RECT;
    instalarMedios();
    dobles.estado.sesion = { user: { id: 'user-1' } };
    dobles.estado.fila = { data: { tour_completed_at: null }, error: null };
    dobles.estado.consultasDeMarca = 0;
    dobles.estado.sesionesLeidas = 0;
    dobles.estado.escrituras.length = 0;
    dobles.estado.oyentes.length = 0;
    dobles.estado.ruta.pathname = '/';
    dobles.router.push.mockClear();
    vi.mocked(withTiming).mockClear();
});

afterEach(() => {
    if (descriptorMatchMedia) {
        Object.defineProperty(window, 'matchMedia', descriptorMatchMedia);
    } else {
        delete (window as { matchMedia?: unknown }).matchMedia;
    }
});

/**
 * Los objetivos, como los daría de alta una pantalla. Se registran todos los del guion: el corredor
 * pide una medida nueva al llegar a una parada y aquí no hay nodos que medir.
 */
function Objetivos() {
    const registro = useTourTargetRegistry();

    useEffect(() => {
        const ids = TOUR_STEPS.map((paso) => paso.targetId);

        for (const id of ids) registro.register(id, () => cajaDeObjetivo(id));

        return () => {
            for (const id of ids) registro.unregister(id);
        };
    }, [registro]);

    return null;
}

/** Lo que ve la portada: si el tour está en marcha y qué pestaña pide. */
function Sonda() {
    const activo = useTourActive();
    const pedida = useTourRequestedTab();

    return <div data-testid="sonda">{`${activo ? 'activo' : 'apagado'}|${pedida ?? 'ninguna'}`}</div>;
}

/** Una portada en miniatura: sólo dice qué pestaña está enseñando, como `app/index.tsx`. */
function Portada({ tab }: { tab: Tab }) {
    useTourTabReporter(tab);

    return null;
}

/**
 * La app en miniatura. Por defecto monta la portada (`Portada`), que es lo que hace el arranque del
 * tour posible; `tab={null}` representa una pantalla sin portada —el alta, por ejemplo—, donde el
 * tour todavía no puede empezar.
 */
function Pintar({ tab = 'wishlist' }: { tab?: Tab | null } = {}) {
    return (
        <TourTargetProvider>
            <Objetivos />
            <TourHost>
                <Sonda />
                {tab ? <Portada tab={tab} /> : null}
            </TourHost>
        </TourTargetProvider>
    );
}

function sonda(): string | null {
    return screen.getByTestId('sonda').textContent;
}

/** Suelta un evento de auth como lo haría Supabase. */
function emitirSesion(sesion: { user: { id: string } } | null) {
    dobles.estado.sesion = sesion;

    for (const oyente of [...dobles.estado.oyentes]) {
        oyente(sesion ? 'SIGNED_IN' : 'SIGNED_OUT', sesion);
    }
}

/** Avanza el recorrido `veces` páginas, dejando que cada parada se pinte antes de pulsar. */
async function avanzar(veces: number) {
    for (let i = 0; i < veces; i += 1) {
        fireEvent.click(await screen.findByLabelText('Siguiente página del tour'));
        await act(async () => {});
    }
}

describe('TourHost: quién ve el tour', () => {
    it('con la marca vacía arranca y pinta la primera parada', async () => {
        render(<Pintar />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();
        expect(sonda()).toBe('activo|ninguna');
    });

    it('con la marca puesta no lo arranca nunca', async () => {
        dobles.estado.fila = { data: { tour_completed_at: FECHA }, error: null };

        render(<Pintar />);

        await waitFor(() => expect(dobles.estado.consultasDeMarca).toBe(1));
        await act(async () => {});

        expect(screen.queryByText(PRIMERA_PAGINA)).toBeNull();
        expect(sonda()).toBe('apagado|ninguna');
    });

    it('no arranca en mitad del alta y arranca al llegar a la portada', async () => {
        // El usuario nuevo está en el segundo paso del alta cuando se lee la marca: ahí no hay
        // portada montada, así que el tour no puede empezar (sacarlo del alta sería peor que no
        // enseñárselo todavía).
        dobles.estado.ruta.pathname = '/profile/setup';

        const { rerender } = render(<Pintar tab={null} />);

        await waitFor(() => expect(dobles.estado.consultasDeMarca).toBe(1));
        await act(async () => {});

        expect(screen.queryByText(PRIMERA_PAGINA)).toBeNull();
        expect(sonda()).toBe('apagado|ninguna');
        expect(dobles.router.push).not.toHaveBeenCalled();

        // Terminó el alta y la portada está en pantalla: ahora sí, y sin haber navegado a ningún
        // sitio por su cuenta.
        dobles.estado.ruta.pathname = '/';
        rerender(<Pintar tab="wishlist" />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();
        expect(sonda()).toBe('activo|ninguna');
        expect(dobles.router.push).not.toHaveBeenCalled();
    });

    it('si la marca no se puede leer lo deja apagado y no insiste', async () => {
        dobles.estado.fila = { data: null, error: { message: 'permission denied' } };

        render(<Pintar />);

        await waitFor(() => expect(dobles.estado.consultasDeMarca).toBe(1));
        await act(async () => {});

        expect(screen.queryByText(PRIMERA_PAGINA)).toBeNull();
        expect(sonda()).toBe('apagado|ninguna');
        // Una sola lectura: un fallo no se convierte en un bucle de reintentos.
        expect(dobles.estado.consultasDeMarca).toBe(1);
    });

    it('sin sesión no lo arranca', async () => {
        dobles.estado.sesion = null;

        render(<Pintar />);

        await act(async () => {});

        expect(screen.queryByText(PRIMERA_PAGINA)).toBeNull();
        expect(dobles.estado.consultasDeMarca).toBe(0);
    });

    it('al cerrar sesión se apaga y no se queda midiendo objetivos', async () => {
        render(<Pintar />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();

        await act(async () => {
            emitirSesion(null);
        });

        expect(screen.queryByText(PRIMERA_PAGINA)).toBeNull();
        expect(sonda()).toBe('apagado|ninguna');
    });
});

describe('TourHost: cómo termina', () => {
    it('saltar marca la cuenta una sola vez y quita el tour de la pantalla', async () => {
        render(<Pintar />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Saltar el tour'));

        await waitFor(() => expect(dobles.estado.escrituras).toHaveLength(1));

        expect(
            Number.isNaN(Date.parse(String(dobles.estado.escrituras[0].tour_completed_at)))
        ).toBe(false);
        expect(screen.queryByText(PRIMERA_PAGINA)).toBeNull();
        expect(sonda()).toBe('apagado|ninguna');
        // Terminar o saltar no vuelve a leer la marca: ya se sabe y la escritura es la respuesta.
        expect(dobles.estado.consultasDeMarca).toBe(1);
    });
});

describe('TourHost: accesibilidad mientras el tour está abierto', () => {
    it('con el tour abierto la página de detrás queda oculta e inerte, y vuelve al cerrar', async () => {
        render(<Pintar />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();

        const pagina = screen.getByTestId('tour-page');

        // `aria-hidden` no basta: los botones de detrás seguirían recibiendo Tab y Enter. `inert`
        // es lo que de verdad los saca del alcance del teclado.
        expect(pagina).toHaveAttribute('aria-hidden', 'true');
        expect(pagina).toHaveAttribute('inert');

        fireEvent.click(screen.getByLabelText('Saltar el tour'));

        await waitFor(() => expect(screen.queryByText(PRIMERA_PAGINA)).toBeNull());

        // Al cerrar, la página vuelve a estar disponible: sin esto el usuario se queda con una
        // app que no responde al teclado después del tour.
        expect(pagina).not.toHaveAttribute('aria-hidden');
        expect(pagina).not.toHaveAttribute('inert');
    });

    it('sin tour la página no se oculta ni se vuelve inerte', async () => {
        dobles.estado.fila = { data: { tour_completed_at: FECHA }, error: null };

        render(<Pintar />);

        await waitFor(() => expect(dobles.estado.consultasDeMarca).toBe(1));
        await act(async () => {});

        const pagina = screen.getByTestId('tour-page');

        expect(pagina).not.toHaveAttribute('aria-hidden');
        expect(pagina).not.toHaveAttribute('inert');
    });
});

describe('TourHost: movimiento reducido', () => {
    /** Cada parada con su propia caja: sin movimiento distinto no hay transición que medir. */
    const cajasDistintas = (id: string) => {
        const indice = TOUR_STEPS.findIndex((paso) => paso.targetId === id);

        return { ...RECT, y: 24 + indice * 12 };
    };

    it('con la preferencia activada no anima ningún cambio de parada', async () => {
        movimientoReducido = true;
        cajaDeObjetivo = cajasDistintas;

        render(<Pintar />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();

        // Dos páginas de bienvenida: la segunda pulsación entra en la parada siguiente, con otra
        // caja, que es el cambio que se animaría.
        await avanzar(2);

        expect(withTiming).not.toHaveBeenCalled();
    });

    it('con la preferencia desactivada sí anima el cambio de parada', async () => {
        cajaDeObjetivo = cajasDistintas;

        render(<Pintar />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();

        await avanzar(2);

        expect(withTiming).toHaveBeenCalled();
    });
});

describe('TourHost: la navegación del recorrido', () => {
    it('empuja la ruta de una parada y pide la pestaña de la siguiente', async () => {
        render(<Pintar />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();

        // Dos páginas de bienvenida, lista, botón de añadir y dos páginas del formulario: la sexta
        // pulsación entra en la parada de grupos, que vive en otra pestaña.
        await avanzar(6);

        expect(dobles.router.push).toHaveBeenCalledWith('/wishlist/add');
        expect(sonda()).toBe('activo|groups');
    });

    it('la pestaña que la portada dice que enseña decide a dónde hay que ir', async () => {
        // La portada abre en el perfil; la primera parada vive en deseos. Si el corredor no
        // escuchara a la portada, no habría nada que navegar y `requestedTab` seguiría vacío.
        render(<Pintar tab="profile" />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();

        expect(sonda()).toBe('activo|wishlist');
    });
});

/**
 * Lo que no puede cambiar (PRESERVE): la portada sin sesión sigue siendo la de siempre. Los enganches
 * nuevos del tour son inertes sin tour, así que la comprobación de sesión y la rama de bienvenida
 * tienen que seguir exactamente igual —incluido que no se lea ninguna marca de tour—.
 */
describe('TourHost: la portada de siempre sin tour', () => {
    it('sin sesión sigue enseñando la bienvenida y no pinta ni consulta nada del tour', async () => {
        dobles.estado.sesion = null;

        const { default: LandingPage } = await import('@/app/index');

        render(
            <TourTargetProvider>
                <TourHost>
                    <LandingPage />
                </TourHost>
            </TourTargetProvider>
        );

        expect(await screen.findByText('Iniciar sesión')).toBeInTheDocument();
        expect(screen.getByText('Registrarse')).toBeInTheDocument();
        expect(screen.queryByText(PRIMERA_PAGINA)).toBeNull();
        expect(dobles.estado.consultasDeMarca).toBe(0);
    });
});
