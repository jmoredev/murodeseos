'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { markTourCompleted, readTourCompletedAt, shouldStartTour, TOUR_FLAG_DB } from '@/lib/tour/flag';
import type { TourDestination } from '@/lib/tour/navigation';
import { TOUR_STEPS } from '@/lib/tour/steps';
import { useReducedMotion } from '@/lib/tour/use-reduced-motion';
import type { Tab } from '@/lib/tabs';
import { TourStateProvider } from './TourState';
import { TourRunner } from './TourRunner';

/**
 * El arranque del tour de primer inicio (S1, D2, D3).
 *
 * Este componente es el único que decide **si** se enseña el tour y **a quién**. Se monta una sola
 * vez en `app/_layout.tsx`, dentro del registro de objetivos y **fuera** del `Stack`, por dos
 * motivos:
 *
 * - Tiene que sobrevivir a los cambios de ruta. Dos paradas del guion viven en sub-rutas
 *   (`/wishlist/add`, `/groups/join`), y un tour que se desmontara al navegar se quedaría a medias.
 * - La portada necesita saber si el tour está en marcha (para inyectar los datos de demostración y
 *   para que el modal de novedades espere, Log L4) y qué pestaña pide el recorrido. Eso se pregunta
 *   con los enganches de `TourState.tsx`, que este host alimenta y que son inertes sin él: las
 *   pantallas se pintan igual, y no arrastran el velo (`reanimated`) por preguntar.
 *
 * La política de arranque es corta y deliberadamente aburrida: una cuenta nueva es la que tiene
 * `profiles.tour_completed_at` a `NULL` (D3). Si la marca no se puede leer —no hay fila, la consulta
 * falla, el plazo se agota— el tour **no** se abre y no se reintenta. Y al terminar o saltar (S1) se
 * marca la cuenta una vez, sin volver a leer la marca: la escritura ya es la respuesta.
 */

/**
 * El plazo del arranque de sesión, el mismo que usa `app/index.tsx` (`AUTH_SESSION_MS`). Una sesión
 * que no responde en este tiempo se trata como «no hay sesión»: sin tour, que es la respuesta que
 * nunca molesta a quien ya lo vio.
 */
const SESION_MAX_MS = 12_000;

/** La pestaña pedida en la portada (`/?tab=groups`), si la ruta la lleva. */
const PESTANA_EN_RUTA = /[?&]tab=(wishlist|groups|profile)/;

const ESTILOS = StyleSheet.create({
    /** El contenedor de la página: ocupa lo mismo que ocupaba la página sin envolverla. */
    pagina: { flex: 1 },
});

export type TourHostProps = {
    children?: React.ReactNode;
};

export function TourHost({ children }: TourHostProps) {
    const router = useRouter();

    const [pendiente, setPendiente] = useState(false);
    const [requestedTab, setRequestedTab] = useState<Tab | null>(null);
    /**
     * La pestaña que la portada dice que está enseñando. `null` = la portada no está montada.
     *
     * Es lo que decide **cuándo** empieza el tour: quien acaba de registrarse está en
     * `/profile/setup` cuando se lee la marca, y ahí no hay portada. Si el corredor arrancara en esa
     * pantalla, su primera parada (una pestaña de la portada) pediría volver a `/` y sacaría al
     * usuario de la mitad del alta. No se limpia al desmontar la portada a propósito: cuando una
     * sub-ruta se abre encima, el tour tiene que seguir vivo, y dos paradas viven ahí.
     */
    const [currentTab, setCurrentTab] = useState<Tab | null>(null);

    /** El tour necesita una portada montada que enseñar: sin ella no hay a dónde ir. */
    const active = pendiente && currentTab !== null;

    /** El usuario en sesión ahora mismo: es a quien se le marca el tour al terminar. */
    const usuario = useRef<string | null>(null);
    /**
     * El usuario cuya marca ya se ha decidido. Los eventos de auth llegan a pares al arrancar
     * (`INITIAL_SESSION` y el `getSession` de este efecto), y sin esta memoria se leería la marca dos
     * veces por arranque. También es lo que impide releerla después de terminar: ya se sabe.
     */
    const decidido = useRef<string | null>(null);

    useEffect(() => {
        let cancelado = false;

        const apagar = () => {
            decidido.current = null;
            usuario.current = null;

            if (cancelado) return;

            setPendiente(false);
            setRequestedTab(null);
            setCurrentTab(null);
        };

        const decidir = async (userId: string | null) => {
            if (!userId) {
                // Sin sesión no hay perfil que leer y, sobre todo, no hay a quién enseñarle nada.
                apagar();

                return;
            }

            if (decidido.current === userId) return;

            decidido.current = userId;
            usuario.current = userId;

            const bandera = await readTourCompletedAt(TOUR_FLAG_DB, userId);

            if (cancelado) return;

            // `undefined` (no se pudo saber) también deja el tour apagado: `shouldStartTour` sólo
            // dice que sí a `null`, que es `tour_completed_at IS NULL` (D3).
            const hayTour = shouldStartTour(bandera);

            setPendiente(hayTour);
        };

        const leerSesion = async (): Promise<string | null> => {
            let temporizador: ReturnType<typeof setTimeout> | undefined;

            try {
                const plazo = new Promise<null>((resolve) => {
                    temporizador = setTimeout(() => resolve(null), SESION_MAX_MS);
                });
                const respuesta = await Promise.race([supabase.auth.getSession(), plazo]);

                return respuesta?.data?.session?.user?.id ?? null;
            } catch {
                return null;
            } finally {
                if (temporizador !== undefined) clearTimeout(temporizador);
            }
        };

        const arrancar = async () => {
            const sessionUserId = await leerSesion();

            if (cancelado) return;

            await decidir(sessionUserId);
        };

        void arrancar();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_evento, session) => {
            // Cerrar sesión apaga el tour; entrar con otra cuenta lo vuelve a decidir. El mismo
            // usuario no releé la marca: `decidir` lo recuerda.
            void decidir(session?.user?.id ?? null);
        });

        return () => {
            cancelado = true;
            subscription.unsubscribe();
        };
    }, []);

    const reportarPestana = useCallback((tab: Tab | null) => {
        if (!tab) return;

        setCurrentTab(tab);
    }, []);

    /**
     * Ejecuta el destino que ya calculó `lib/tour/navigation.ts`. Pestaña = estado de la portada
     * (pedirla, que la portada la cambie en su efecto); ruta = pantalla de expo-router.
     */
    const alNavegar = useCallback(
        (destino: TourDestination, volver = false) => {
            if (!destino) return;

            if (destino.kind === 'tab') {
                setRequestedTab(destino.tab);

                return;
            }

            /**
             * Volver a la portada deshaciendo el `push` que abrió la sub-ruta.
             *
             * `volver` sólo llega cuando el corredor recuerda que el `push` fue suyo, así que debajo
             * está la portada que él dejó, con su estado, y `back()` la recupera en vez de montar
             * una segunda copia del muro. Sin historial propio (enlace directo) se empuja la
             * portada, que es la única salida.
             */
            if (volver) {
                const pedida = PESTANA_EN_RUTA.exec(destino.route)?.[1];

                if (pedida) setRequestedTab(pedida as Tab);

                if (router.canGoBack()) {
                    router.back();

                    return;
                }
            }

            // `expo-router` tipa las rutas como literales; aquí la ruta viene del guion, así que se
            // empuja con el mismo molde que el resto de la app.
            router.push(destino.route as Parameters<typeof router.push>[0]);
        },
        [router]
    );

    /**
     * Terminar o saltar cierran el tour y marcan la cuenta (D2). El estado del motor no se mira a
     * propósito: los dos finales valen —quien salta ya ha visto lo que quería— y marcarlos igual es
     * justo lo que evita volver a enseñárselo.
     *
     * Marcar es best-effort: `markTourCompleted` no lanza y aquí no se espera su respuesta. Si la
     * escritura falla, la peor consecuencia es que esa cuenta lo vuelva a ver en el siguiente
     * arranque.
     */
    const alTerminar = useCallback(() => {
        const userId = usuario.current;

        if (userId) void markTourCompleted(TOUR_FLAG_DB, userId);

        setPendiente(false);
        setRequestedTab(null);
    }, []);

    const contexto = useMemo(
        () => ({ active, requestedTab, reportTab: reportarPestana }),
        [active, requestedTab, reportarPestana]
    );

    // S5: quien pide menos movimiento en su sistema no ve transiciones. Se pregunta aquí, una vez
    // por host, y se pasa al corredor.
    const reduceMotion = useReducedMotion();

    /**
     * Con el tour abierto, la página de detrás no puede usarse **ni con el teclado**. El velo ya se
     * come los toques (`pointerEvents`), pero `pointerEvents` no impide Tab+Enter. `aria-hidden` la
     * esconde a los lectores de pantalla e `inert` la saca del orden de tabulación y de los clics
     * de verdad. Es sólo web: en nativo no hay DOM que inertizar y `accessibilityViewIsModal` del
     * diálogo ya hace ese trabajo.
     */
    const ocultarPagina = active && Platform.OS === 'web';
    const propsDePagina = ocultarPagina
        ? ({ 'aria-hidden': true, inert: true } as unknown as Record<string, unknown>)
        : {};

    return (
        <TourStateProvider value={contexto}>
            {/* La página va en un contenedor propio para poder ocultarla entera mientras el tour
                está abierto. `flex: 1` conserva el reparto de altura que tenía antes de envolver. */}
            <View testID="tour-page" style={ESTILOS.pagina} {...propsDePagina}>
                {children}
            </View>
            {active && (
                <TourRunner
                    steps={TOUR_STEPS}
                    tab={currentTab ?? 'wishlist'}
                    onNavigate={alNavegar}
                    onFinish={alTerminar}
                    reduceMotion={reduceMotion}
                />
            )}
        </TourStateProvider>
    );
}
