import React, { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TourHost } from '@/components/tour/TourHost';
import { useTourActive, useTourRequestedTab, useTourTabReporter } from '@/components/tour/TourState';
import { TourTargetProvider, useTourTargetRegistry } from '@/components/tour/TourTargetProvider';
import { TOUR_STEPS } from '@/lib/tour/steps';
import type { TourStep } from '@/lib/tour/engine';
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
        puedeVolver: true,
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

    const router = {
        push: vi.fn(),
        replace: vi.fn(),
        // Retroceder de verdad devuelve a la portada: el pathname lo Dice el router, no el test.
        back: vi.fn(() => {
            estado.ruta.pathname = '/';
        }),
        setParams: vi.fn(),
        canGoBack: () => estado.puedeVolver,
    };

    return { estado, supabase, router };
});

/**
 * El guion real, pero sustituible.
 *
 * Hay una rama del host que el guion de la app no alcanza: volver a la portada sin pedir pestaña
 * necesita una parada con `route: '/'`, y el guion real no la tiene (todas sus paradas de la
 * portada son de pestaña). Con el guion de verdad por defecto, el resto de las pruebas sigue
 * midiendo lo mismo.
 */
const guion = vi.hoisted(() => ({
    real: [] as readonly TourStep[],
    vigente: [] as readonly TourStep[],
}));

vi.mock('@/lib/tour/steps', async () => {
    const modulo = await vi.importActual<typeof import('@/lib/tour/steps')>('@/lib/tour/steps');

    guion.real = modulo.TOUR_STEPS;
    guion.vigente = modulo.TOUR_STEPS;

    return {
        get TOUR_STEPS() {
            return guion.vigente;
        },
    };
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
    dobles.router.back.mockClear();
    dobles.estado.puedeVolver = true;
    guion.vigente = guion.real;
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

/**
 * Páginas que hay que avanzar desde el principio para **entrar** en la parada `id`.
 *
 * Se cuenta con el guion de verdad y no con un número escrito a mano: cuando una parada gana o
 * pierde una página, un número fijo deja de apuntar a la parada que el test dice estar probando, y
 * el fallo aparece lejos de la causa.
 */
function paginasHasta(id: string): number {
    const indice = TOUR_STEPS.findIndex((paso) => paso.id === id);

    if (indice < 0) throw new Error(`El guion no tiene la parada «${id}»`);

    return TOUR_STEPS.slice(0, indice).reduce((total, paso) => total + paso.pages.length, 0);
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

        // Las páginas de todas las paradas anteriores: la primera pulsación que entra en la parada
        // de grupos, que vive en otra pestaña.
        await avanzar(paginasHasta('grupos'));

        expect(dobles.router.push).toHaveBeenCalledWith('/wishlist/add');
        expect(sonda()).toBe('activo|groups');
    });

    it('para volver a la portada desde una sub-ruta retrocede: no monta otra copia del muro', async () => {
        const { rerender } = render(<Pintar />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();

        // La parada del formulario sí es un `push` de verdad: es otra pantalla.
        await avanzar(paginasHasta('nuevo-deseo') + 1);
        expect(dobles.router.push).toHaveBeenCalledWith('/wishlist/add');

        // Ya estamos en la sub-ruta. La portada sigue montada debajo, con su estado.
        dobles.estado.ruta.pathname = '/wishlist/add';
        rerender(<Pintar />);
        await avanzar(paginasHasta('grupos') - (paginasHasta('nuevo-deseo') + 1));

        // La parada de grupos vive en la portada: se vuelve, no se empuja otra portada encima.
        expect(dobles.router.back).toHaveBeenCalledTimes(1);
        expect(dobles.router.push).toHaveBeenCalledTimes(1);
        expect(sonda()).toBe('activo|groups');
    });

    it('desde un enlace directo a una sub-ruta empuja la portada aunque el navegador tenga historial', async () => {
        // Hay historial de verdad, pero no lo creó el tour: esta pantalla la abrió el usuario (o el
        // enlace directo), así que retroceder lo sacaría a donde el tour no ha estado.
        dobles.estado.ruta.pathname = '/wishlist/add';
        dobles.estado.puedeVolver = true;

        render(<Pintar />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();

        expect(dobles.router.back).not.toHaveBeenCalled();
        expect(dobles.router.push).toHaveBeenCalledWith('/');
    });

    it('sin historial, volver a la portada empuja la pestaña pedida en vez de quedarse sin salida', async () => {
        const { rerender } = render(<Pintar />);

        expect(await screen.findByText(PRIMERA_PAGINA)).toBeInTheDocument();

        await avanzar(paginasHasta('nuevo-deseo') + 1);
        expect(dobles.router.push).toHaveBeenCalledWith('/wishlist/add');

        // Ya en la sub-ruta que abrió el tour, pero sin historial que deshacer.
        dobles.estado.ruta.pathname = '/wishlist/add';
        dobles.estado.puedeVolver = false;
        rerender(<Pintar />);
        await avanzar(paginasHasta('grupos') - (paginasHasta('nuevo-deseo') + 1));

        expect(dobles.router.back).not.toHaveBeenCalled();
        expect(dobles.router.push).toHaveBeenLastCalledWith('/?tab=groups');
        expect(sonda()).toBe('activo|groups');
    });

    it('sin historial y sin pestaña pedida, volver a la portada empuja la ruta corta', async () => {
        // Una parada que vive en la portada sin pedir pestaña (`route: '/'`): la vuelta no tiene
        // pestaña que aplicar y la salida es `/`, no `/?tab=`.
        guion.vigente = [
            {
                id: 'formulario',
                targetId: 'deseos-form',
                route: '/wishlist/add',
                pages: ['El formulario del deseo'],
            },
            {
                id: 'muro',
                targetId: 'muro-de-deseos',
                route: '/',
                pages: ['Tu muro de deseos'],
            },
        ];
        dobles.estado.puedeVolver = false;

        const { rerender } = render(<Pintar />);

        expect(await screen.findByText('El formulario del deseo')).toBeInTheDocument();
        expect(dobles.router.push).toHaveBeenCalledWith('/wishlist/add');

        dobles.estado.ruta.pathname = '/wishlist/add';
        rerender(<Pintar />);
        await avanzar(1);

        expect(dobles.router.back).not.toHaveBeenCalled();
        expect(dobles.router.push).toHaveBeenLastCalledWith('/');
    });

    it('si no hay nada debajo, ir a la portada empuja en vez de quedarse sin salida', async () => {
        // Enlace directo a la sub-ruta: no hay portada debajo que recuperar.
        dobles.estado.ruta.pathname = '/wishlist/add';
        dobles.estado.puedeVolver = false;

        const { rerender } = render(<Pintar />);
        await act(async () => {});

        // La primera parada pide la portada; sin historial, se empuja.
        rerender(<Pintar />);

        expect(dobles.router.back).not.toHaveBeenCalled();
        expect(dobles.router.push).toHaveBeenCalledWith('/');
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
