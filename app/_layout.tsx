import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import './global.css';

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

  // Manifest link
  let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'manifest');
    document.head.appendChild(link);
  }
  link.setAttribute('href', '/manifest.json');
}

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);

  // Ensure tags synchronously on first paint (Playwright PWA tests run right after `page.goto`).
  ensureWebHead();

  useEffect(() => {
    // Ensure tags again after hydration (guards against fast navigation / React ordering).
    ensureWebHead();

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
