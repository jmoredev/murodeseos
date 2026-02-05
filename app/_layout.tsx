import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import './global.css';

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
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
      >
        <Stack.Screen name="index" />
      </Stack>
    </SafeAreaProvider>
  );
}
