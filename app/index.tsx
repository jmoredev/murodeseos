import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/sign-out';
import { parseTabParam, type Tab } from '@/lib/tabs';
import { GroupsTab } from '@/components/GroupsTab';
import { WishListTab } from '@/components/WishListTab';
import { ProfileTab } from '@/components/ProfileTab';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import WhatsNewModal from '@/components/WhatsNewModal';
import { useTourActive, useTourRequestedTab, useTourTabReporter } from '@/components/tour/TourState';
import { useTourTarget } from '@/components/tour/TourTargetProvider';
import { DEMO_GROUPS, DEMO_WISHES } from '@/lib/tour/demo-data';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

// Shared budget for the auth session check and the profile-name gate: both
// race their request against this timeout so a hung request can never leave
// the screen stuck on "Cargando...".
const AUTH_SESSION_MS = 12_000;

export default function LandingPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    // El parámetro solo cuenta si es una de las pestañas reales: con `?tab=` vacío o con un
    // valor desconocido, la pestaña activa se quedaba sin coincidencia y el lienzo en blanco.
    const paramTab = parseTabParam(params.tab);
    // Session-level name gate: records once the profile check has *completed* for
    // a user id. While a signed-in user's check has not completed yet, the
    // landing content must not render: a user without a display name is
    // redirected to the setup screen instead.
    const [profileCheckDone, setProfileCheckDone] = useState<{ userId: string | null }>({
        userId: null,
    });
    const sessionUserId: string | null = user?.id ?? null;
    // El estado guarda la pestaña elegida *y* el parámetro con el que se eligió: si el
    // parámetro cambia, manda el parámetro; si no, manda la elección del usuario. Así
    // no hace falta un efecto que sincronice estado.
    const [tabState, setTabState] = useState<{ tab: Tab; param: Tab | null }>({
        tab: paramTab ?? 'wishlist',
        param: paramTab,
    });

    const activeTab = tabState.param === paramTab ? tabState.tab : paramTab ?? tabState.tab;
    // Estable: el efecto que atiende la pestaña que pide el tour lo lleva en sus dependencias, y una
    // función nueva en cada render lo volvería a lanzar en cada render.
    const setActiveTab = useCallback(
        (tab: Tab) => setTabState({ tab, param: paramTab }),
        [paramTab]
    );

    useEffect(() => {
        const checkUser = async () => {
            try {
                const timeout = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('auth_session_timeout')), AUTH_SESSION_MS)
                );
                const { data: { session } } = await Promise.race([supabase.auth.getSession(), timeout]);
                setUser(session?.user ?? null);
            } catch (err) {
                console.error('Error checking user:', err);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Name gate for signed-in users: once per session user id, read the display
    // name from `profiles`. Redirect with `replace` only when the profile row
    // exists and its name is empty or whitespace-only. If the row is
    // absent, the fetch fails or the request times out, do NOT redirect: the
    // login gate already handles the absent-profile case, and redirecting here
    // would loop with the setup screen. The redirect happens in the effect,
    // never during render.
    useEffect(() => {
        if (!sessionUserId) return;

        let cancelled = false;

        const checkProfileName = async () => {
            try {
                // Race the fetch against the shared timeout. The timeout
                // resolves (it does not reject) as a failed check, so a hung
                // request counts as a completed, non-redirecting check — same
                // policy as a fetch error: fail open to the landing.
                const timeout: Promise<{ data: null; error: { message: string } }> = new Promise(
                    (resolve) =>
                        setTimeout(
                            () => resolve({ data: null, error: { message: 'profile_gate_timeout' } }),
                            AUTH_SESSION_MS
                        )
                );
                const { data: profile, error } = await Promise.race([
                    supabase
                        .from('profiles')
                        .select('display_name')
                        .eq('id', sessionUserId)
                        .maybeSingle(),
                    timeout,
                ]);
                if (cancelled) return;

                // Only redirect when the row exists and the name is empty or
                // whitespace: an absent row (or a failed fetch) is intentional
                // non-redirect, to avoid a loop with /profile/setup.
                if (!error && profile && !(profile.display_name ?? '').trim()) {
                    router.replace('/profile/setup');
                }
                // Mark the check as completed only from the async body: state
                // must not be set synchronously inside the effect.
            } finally {
                if (!cancelled) setProfileCheckDone({ userId: sessionUserId });
            }
        };
        checkProfileName();

        return () => {
            cancelled = true;
            // Leaving this user's gate (sign-out or a user switch): drop the
            // completed-check marker so that signing back in as the SAME user
            // re-runs the check instead of trusting the stale result.
            setProfileCheckDone({ userId: null });
        };
    }, [sessionUserId, router]);

    // Mientras dura el tour (S1, D1, L4) la portada cambia de papel: las listas enseñan datos de
    // demostración, la pestaña que pide el recorrido se cambia en un efecto —nunca durante el
    // render— y el modal de novedades espera a que el tour termine o se salte, para que una cuenta
    // nueva no estrene las dos cosas el mismo día.
    const tourActive = useTourActive();
    const tourRequestedTab = useTourRequestedTab();

    // La portada informa de la pestaña que está enseñando: el corredor no puede adivinarla, porque
    // en la portada las pestañas son estado y no cambian el pathname.
    useTourTabReporter(activeTab);

    /**
     * Los tres objetivos del tour de las pestañas (S7) son **de la portada**, y por eso se registran
     * aquí y se le pasan al layout en vez de que el layout los registre por su cuenta.
     *
     * El registro de objetivos guarda una medida por id y dar de baja un id lo borra; mientras los
     * registraba `ResponsiveLayout`, cada pantalla que lo pinta —la portada y también el detalle de un
     * grupo o la lista de otra persona (D5)— daba de alta los mismos `tab-*`. Al volver de esas
     * sub-rutas con un `back`, su desmontaje borraba el alta de la portada, que no se vuelve a montar
     * para rehacerla: el recorrido se quedaba sin medida para la parada `perfil` y sin tarjeta.
     *
     * Sin `TourTargetProvider` por encima estos enganches son inertes, como el resto del registro.
     */
    const objetivoDeseos = useTourTarget('tab-deseos');
    const objetivoGrupos = useTourTarget('tab-grupos');
    const objetivoPerfil = useTourTarget('tab-perfil');

    useEffect(() => {
        // La guarda no es cosmética: sin ella, cada render volvería a pedir la misma pestaña y
        // reavivaría el estado que acaba de cambiar.
        if (!tourRequestedTab || tourRequestedTab === activeTab) return;

        // El cambio se aplica en un límite asíncrono explícito, como el resto de la app: la regla
        // `react-hooks/set-state-in-effect` rechaza el `setState` síncrono en el cuerpo del efecto
        // porque dispara renders en cascada, y aquí el estado que se toca es el de la portada, no
        // el de este efecto.
        const aplicarPestana = async () => setActiveTab(tourRequestedTab);

        void aplicarPestana();
    }, [tourRequestedTab, activeTab, setActiveTab]);

    // While the name gate has not completed for the current user, keep showing
    // the loading branch: the signed-in landing must not flash before a possible
    // redirect to /profile/setup.
    const profileGatePending = !!user && profileCheckDone.userId !== user.id;

    if (loading || profileGatePending) {
        return (
            <View className="flex-1 items-center justify-center bg-surface">
                <View className="w-10 h-10 border-4 border-primary/25 border-t-primary rounded-full animate-spin" />
                <Text className="mt-4 text-primary font-sans-medium">Cargando...</Text>
            </View>
        );
    }

    if (user) {
        return (
            <>
                <ResponsiveLayout
                    userId={user.id}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    onSignOut={signOut}
                    objetivosPestanas={{
                        deseos: objetivoDeseos,
                        grupos: objetivoGrupos,
                        perfil: objetivoPerfil,
                    }}
                >
                    {activeTab === 'wishlist' && (
                        <WishListTab
                            userId={user.id}
                            demoData={tourActive ? { wishes: DEMO_WISHES } : undefined}
                        />
                    )}
                    {activeTab === 'groups' && (
                        <GroupsTab
                            userId={user.id}
                            demoData={tourActive ? { groups: DEMO_GROUPS } : undefined}
                        />
                    )}
                    {activeTab === 'profile' && <ProfileTab userId={user.id} />}
                </ResponsiveLayout>
                {/* Log L4: el tour va primero; el modal de novedades espera a que termine o se
                    salte, en vez de estrenarse encima el mismo día. */}
                {!tourActive && <WhatsNewModal />}
            </>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingTop: 48 }}>
                <Text className="text-5xl font-display text-on-background text-center tracking-tight leading-tight">
                    Muro de <Text className="text-primary">deseos</Text>
                </Text>
                <Text className="mt-8 text-lg text-on-surface/70 text-center max-w-sm font-sans leading-relaxed">
                    Comparte tus sueños, organiza tus regalos y haz realidad los deseos de tus amigos.
                </Text>

                <View className="mt-12 w-full max-w-xs gap-4">
                    <PrimaryButton
                        onPress={() => router.push('/login')}
                        accessibilityLabel="Iniciar sesión"
                        textClassName="text-on-primary font-sans-bold text-base"
                    >
                        Iniciar sesión
                    </PrimaryButton>

                    <Pressable
                        onPress={() => router.push('/signup')}
                        className="bg-surface-container-high py-4 rounded-full active:opacity-80 shadow-ambient"
                        accessibilityRole="button"
                        accessibilityLabel="Registrarse"
                    >
                        <Text className="text-primary text-center font-sans-bold text-lg">Registrarse</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
