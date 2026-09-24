import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
    expoConfig,
    globalIgnores([
        'dist/**',
        '.expo/**',
        'coverage/**',
        'playwright-report/**',
        'test-results/**',
        'expo-env.d.ts',
    ]),
]);
