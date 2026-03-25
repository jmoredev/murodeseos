import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import './global.css';

function getGithubPagesBasePath() {
  if (typeof window === 'undefined') return '';
  const isGithubPages = window.location.hostname.endsWith('github.io');
  if (!isGithubPages) return '';

  const pathname = window.location.pathname || '/';
  const maybeRepoBase = pathname.split('/').filter(Boolean)[0];

  // Fallback fijo para cuando se accede por accidente a https://<user>.github.io/
  // o cuando la app todavía no ha navegado a /<repo>/.
  const fallbackRepo = 'murodeseos';
  return `/${maybeRepoBase || fallbackRepo}`;
}

function ensureWebHead() {
  if (typeof document === 'undefined') return;

  // Title
  if (document.title !== 'Muro de Deseos') document.title = 'Muro de Deseos';

  // Meta helpers
  const ensureMeta = (name: string, content: string) => {
    let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  ensureMeta('theme-color', '#4F46E5');
  ensureMeta('apple-mobile-web-app-capable', 'yes');

  const base = getGithubPagesBasePath();

  // Favicon (evita que el navegador pida /favicon.ico en la raíz del dominio).
  let icon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!icon) {
    icon = document.createElement('link');
    icon.setAttribute('rel', 'icon');
    document.head.appendChild(icon);
  }
  icon.setAttribute('href', `${base}/favicon.ico`);

  // Manifest link
  let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'manifest');
    document.head.appendChild(link);
  }
  link.setAttribute('href', `${base}/manifest.json`);
}

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);

  // Ensure tags synchronously on first paint (Playwright PWA tests run right after `page.goto`).
  ensureWebHead();

  useEffect(() => {
    // Ensure tags again after hydration (guards against fast navigation / React ordering).
    ensureWebHead();

    // Register service worker (required for "Install app" on most browsers).
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const base = getGithubPagesBasePath();

      // Best effort; ignore failures in dev / unsupported environments.
      navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'white' },
        }}
      />
    </SafeAreaProvider>
  );
}
