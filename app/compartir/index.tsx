import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { savePendingShare } from '@/lib/share-draft';
import { SHARE_QUERY_PARAM, takeSharedPayload } from '@/lib/share-target';

/**
 * La ruta que recibe un compartir (`/compartir?share=<id>`), última parada del share target de
 * Android (T6 de `odd/tasks/compartir-producto.md`).
 *
 * El recorrido completo: la hoja de «Compartir» postea al service worker → el SW guarda el
 * payload y responde `303` acá → esta pantalla lo lee de la caché, lo deja **pendiente** para el
 * formulario y vuelve a la app. Acá no se extrae nada ni se exige sesión: la extracción la hace
 * el formulario, que es quien conoce al usuario, y dejar el pendiente en `sessionStorage` es lo
 * que hace que un compartir **sobreviva al login** sin tocar el flujo de login. Sin esto, quien
 * comparte sin sesión iniciada perdería el producto.
 *
 * Es una pantalla de paso: si tarda, se ve qué está pasando, en vez de un lienzo en blanco.
 */
export default function CompartirPage() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const rawParam = params[SHARE_QUERY_PARAM];
    const shareId = typeof rawParam === 'string' ? rawParam : '';

    useEffect(() => {
        let cancelled = false;

        const forward = async () => {
            const payload = shareId ? await takeSharedPayload(shareId) : null;
            if (cancelled) return;

            if (payload) savePendingShare(payload);
            // Con o sin compartir se termina en la app: acá no se puede hacer nada más, y
            // quedarse en esta pantalla sería un callejón sin salida.
            router.replace('/');
        };

        void forward();

        return () => {
            cancelled = true;
        };
    }, [shareId, router]);

    return (
        <View className="flex-1 items-center justify-center bg-surface">
            <ActivityIndicator size="large" color="#aa2c32" />
            <Text className="mt-4 text-primary font-sans-medium">Preparando el deseo…</Text>
        </View>
    );
}
