import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { extractableLink } from '@/lib/link-extraction';
import { requestProductDraft } from '@/lib/extract-product-client';
import { savePendingDraft } from '@/lib/share-draft';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

/**
 * La pantalla que hay **antes** del formulario cuando el deseo se crea desde el «+».
 *
 * Existe porque hay dos formas de llegar al formulario y solo una trae la página del producto:
 * el compartir del sistema ya sabe cuál es el enlace, pero el «+» no. En vez de abrir un
 * formulario vacío y preguntar el enlace dentro, se pregunta aquí una sola cosa y se decide
 * antes de abrir: o hay enlace (y se lee), o no lo hay (y el formulario se abre vacío, igual que
 * siempre). El formulario no cambia de comportamiento.
 *
 * Nunca deja al usuario sin formulario: si la página no se puede leer, se queda con el motivo y
 * [Continuar a mano], que conserva el enlace (S2 y S5 de `odd/tasks/compartir-producto.md`).
 */

/** Se dice la otra salida en el propio error: quien no tiene enlace no sabe que existe el botón. */
const ERROR_SIN_ENLACE = 'Pega un enlace válido o elige «No tengo enlace».';
const ERROR_PAGINA = 'No pudimos leer esa página. Puedes rellenar el deseo a mano con este enlace.';
/**
 * La cuota es por usuario, no un problema de la tienda: decir «no pudimos leer la página» haría
 * que el usuario cambiara de enlace en vez de esperar.
 */
const ERROR_CUOTA = 'Has agotado las lecturas por ahora. Espera unos minutos y vuelve a intentarlo, o completa el deseo a mano.';

/** El motivo del fallo y el enlace que lo provocó, que es el que conserva [Continuar a mano]. */
type Fallo = { message: string; link: string };

export default function WishlistAddPage() {
    const router = useRouter();
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [failure, setFailure] = useState<Fallo | null>(null);
    const [reading, setReading] = useState(false);
    // Guarda de reentrada: `reading` deshabilita los botones, pero un doble toque puede colarse
    // antes del render. Cada petición gasta cuota del usuario, así que el tope no puede depender
    // solo de la UI.
    const enVuelo = useRef(false);

    const volverAlFormulario = () => {
        // Se vuelve **andando para atrás**, a la lista que ya está montada. `replace('/?tab=wishlist')`
        // sobre la ruta del índice monta una segunda copia de la lista encima de la que ya estaba
        // viva: dos documentos de tarjetas, dos fetches y dos suscripciones, y el usuario acaba
        // viendo (y midiendo) nodos de una copia que no es la que tiene delante.
        // El respaldo es para el enlace directo a `/wishlist/add`, donde no hay nada detrás.
        if (router.canGoBack()) {
            router.back();
            return;
        }
        router.replace('/?tab=wishlist');
    };

    const aceptar = async () => {
        if (enVuelo.current) return;

        const link = extractableLink(value);
        if (!link) {
            // Sin enlace no hay nada que pedir: ni red ni cuota.
            setFailure(null);
            setError(ERROR_SIN_ENLACE);
            return;
        }

        setError(null);
        setFailure(null);
        enVuelo.current = true;
        setReading(true);

        try {
            const result = await requestProductDraft(link);

            if (result.status === 'ok') {
                savePendingDraft({
                    title: result.draft.title ?? '',
                    priceText: result.draft.priceText ?? '',
                    imageUrl: result.draft.imageUrl ?? '',
                    currency: result.draft.currency,
                    links: [link],
                });
                volverAlFormulario();
                return;
            }

            setFailure({
                message: result.reason === 'quota-exceeded' ? ERROR_CUOTA : ERROR_PAGINA,
                link,
            });
        } finally {
            // Pase lo que pase el botón se libera: dejar la pantalla bloqueada en «Leyendo» no
            // tiene salida para el usuario.
            enVuelo.current = false;
            setReading(false);
        }
    };

    const sinEnlace = () => {
        // `{}` es un borrador válido: significa «abre el formulario vacío».
        savePendingDraft({});
        volverAlFormulario();
    };

    const continuarAMano = () => {
        // El enlace nunca se pierde (S2): llega al formulario aunque la página no se haya leído.
        savePendingDraft({ links: failure ? [failure.link] : [] });
        volverAlFormulario();
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
                    <View className="w-full max-w-sm mx-auto">
                        <Text className="text-3xl font-display text-on-background text-center tracking-tight">
                            Nuevo deseo
                        </Text>
                        <Text className="mt-3 text-sm text-on-surface/70 text-center font-sans">
                            Pega el enlace del producto y leemos la página por ti.
                        </Text>

                        <View className="mt-8">
                            <Text className="text-sm font-sans-semibold text-on-background mb-2">Enlace del deseo</Text>
                            <TextInput
                                className={`p-4 rounded-full bg-surface-container-highest text-on-background font-sans ${error ? 'ring-2 ring-primary/30' : ''}`}
                                style={{ fontSize: 16 }}
                                placeholder="https://tienda.com/articulo"
                                placeholderTextColor="#4c212b88"
                                value={value}
                                onChangeText={(text) => {
                                    setValue(text);
                                    if (error) setError(null);
                                }}
                                keyboardType="url"
                                autoCapitalize="none"
                                autoCorrect={false}
                                accessibilityLabel="Enlace del deseo"
                                accessibilityInvalid={!!error}
                                testID="wish-link-input"
                            />
                            {error ? (
                                <Text className="mt-2 text-xs text-primary font-sans-medium" accessibilityLiveRegion="polite">
                                    {error}
                                </Text>
                            ) : null}
                        </View>

                        {reading ? (
                            <View className="mt-6 flex-row items-center justify-center gap-2" accessibilityLiveRegion="polite">
                                <ActivityIndicator size="small" color="#aa2c32" />
                                <Text className="text-sm text-on-surface/70 font-sans-medium">Leyendo la página…</Text>
                            </View>
                        ) : null}

                        {failure ? (
                            <View className="mt-6 p-4 bg-surface-container-low rounded-2xl" accessibilityLiveRegion="polite">
                                <Text className="text-sm font-sans-medium text-on-surface/70">{failure.message}</Text>
                            </View>
                        ) : null}

                        <View className="mt-8 gap-3">
                            <PrimaryButton
                                onPress={aceptar}
                                disabled={reading}
                                accessibilityLabel="Aceptar"
                            >
                                Aceptar
                            </PrimaryButton>

                            {failure ? (
                                <Pressable
                                    onPress={continuarAMano}
                                    accessibilityRole="button"
                                    accessibilityLabel="Continuar a mano"
                                    className="min-h-[44px] w-full rounded-full bg-surface-container-high ring-1 ring-outline-variant/15 items-center justify-center px-4 active:opacity-80"
                                >
                                    <Text className="text-xs font-sans-bold text-on-surface uppercase tracking-[0.05em]">
                                        Continuar a mano
                                    </Text>
                                </Pressable>
                            ) : null}

                            <Pressable
                                onPress={sinEnlace}
                                disabled={reading}
                                accessibilityRole="button"
                                accessibilityLabel="No tengo enlace"
                                accessibilityState={{ disabled: reading }}
                                className={`min-h-[44px] w-full rounded-full bg-surface-container-high ring-1 ring-outline-variant/15 items-center justify-center px-4 active:opacity-80 ${reading ? 'opacity-50' : ''}`}
                            >
                                <Text className="text-xs font-sans-bold text-on-surface uppercase tracking-[0.05em]">
                                    No tengo enlace
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
