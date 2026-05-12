import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    alias: {
      '@': path.resolve(__dirname, './'),
      'react-native': 'react-native-web',
      'expo-linear-gradient': path.resolve(__dirname, './test/mocks/expo-linear-gradient.tsx'),
    },
    server: {
      deps: {
        inline: [
          /react-native/,
          /expo/,
          /nativewind/,
        ],
      },
    },
  },
});
