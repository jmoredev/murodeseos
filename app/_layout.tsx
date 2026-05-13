import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import {
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';
import './global.css';

SplashScreen.preventAutoHideAsync();

const SURFACE_BG = '#fff4f4';
const THEME_COLOR = '#aa2c32';

function getGithubPagesBasePath() {
    if (typeof window === 'undefined') return '';
    const isGithubPages = window.location.hostname.endsWith('github.io');
    if (!isGithubPages) return '';

    const pathname = window.location.pathname || '/';
    const maybeRepoBase = pathname.split('/').filter(Boolean)[0];

    const fallbackRepo = 'murodeseos';
    return `/${maybeRepoBase || fallbackRepo}`;
}

function ensureWebHead() {
    if (typeof document === 'undefined') return;

    if (document.title !== 'Muro de Deseos') document.title = 'Muro de Deseos';

    document.documentElement.lang = 'es';

    const ensureMeta = (name: string, content: string) => {
        let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute('name', name);
            document.head.appendChild(el);
        }
        el.setAttribute('content', content);
    };

    ensureMeta('theme-color', THEME_COLOR);
    ensureMeta('apple-mobile-web-app-capable', 'yes');

    const base = getGithubPagesBasePath();

    let icon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!icon) {
        icon = document.createElement('link');
        icon.setAttribute('rel', 'icon');
        document.head.appendChild(icon);
    }
    icon.setAttribute('href', `${base}/favicon.ico`);

    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'manifest');
        document.head.appendChild(link);
    }
    link.setAttribute('href', `${base}/manifest.json`);
}

/** En redes móviles lentas las fuentes pueden tardar mucho; no bloquear toda la app indefinidamente. */
const FONT_LOAD_MAX_MS = 10_000;

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        PlusJakartaSans_700Bold,
        PlusJakartaSans_800ExtraBold,
        BeVietnamPro_400Regular,
        BeVietnamPro_500Medium,
        BeVietnamPro_600SemiBold,
        BeVietnamPro_700Bold,
    });
    const [fontWaitTimedOut, setFontWaitTimedOut] = useState(false);

    ensureWebHead();

    useEffect(() => {
        const t = setTimeout(() => setFontWaitTimedOut(true), FONT_LOAD_MAX_MS);
        return () => clearTimeout(t);
    }, []);

    const fontsReady = fontsLoaded || fontWaitTimedOut;

    useEffect(() => {
        if (fontsReady) {
            SplashScreen.hideAsync();
        }
    }, [fontsReady]);

    useEffect(() => {
        ensureWebHead();

        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        const base = getGithubPagesBasePath();

        // Solo GitHub Pages: en `bun run web` / localhost el SW cacheaba JS y la UI parecía desactualizada.
        if (!base) {
            void navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((r) => void r.unregister());
            });
            return;
        }

        void navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
    }, []);

    if (!fontsReady) {
        return null;
    }

    return (
        <SafeAreaProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: SURFACE_BG },
                }}
            />
        </SafeAreaProvider>
    );
}
