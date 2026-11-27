import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * El color del tema sale del token `primary` de `tailwind.config.cjs` (es el que
 * publican `app.json`, `public/manifest.json` y el `THEME_COLOR` que inyecta
 * `app/_layout.tsx`). Se lee el token en vez de repetir el hex: cuando la paleta
 * cambió a la teja canónica `#B93D12` (rediseño «Personas primero») este spec
 * fallaba por un literal, no por la app. `__tests__/chrome-colors.test.ts` hace
 * la misma lectura del lado de Vitest.
 */
const ROOT = path.resolve(__dirname, '..');
const THEME_COLOR = (() => {
    const config = readFileSync(path.join(ROOT, 'tailwind.config.cjs'), 'utf8');
    const hex = config.match(/(?:^|\n)\s*primary:\s*'(#[0-9a-fA-F]{6})'/)?.[1];
    if (!hex) throw new Error('No se encontró el token `primary` en tailwind.config.cjs.');
    return hex;
})();

test.describe('PWA Capabilities', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('debe tener las meta etiquetas básicas de PWA', async ({ page }) => {
        // Verificar que el título de la app sea correcto
        await expect(page).toHaveTitle(/Muro de Deseos/);

        // Verificar el color del tema (la fuente de verdad inyectada en runtime es app/_layout.tsx)
        const themeColorEl = page.locator('meta[name="theme-color"]');
        await expect(themeColorEl).toHaveAttribute('content', new RegExp(`^${THEME_COLOR}$`, 'i'), {
            timeout: 15000,
        });
        const themeColor = await themeColorEl.getAttribute('content');
        expect(themeColor?.toLowerCase()).toBe(THEME_COLOR.toLowerCase());

        // Verificar compatibilidad con iOS/Mobile web app
        const appleMobileWebAppCapableEl = page.locator('meta[name="apple-mobile-web-app-capable"]');
        await expect(appleMobileWebAppCapableEl).toHaveAttribute('content', 'yes', { timeout: 15000 });
        const appleMobileWebAppCapable = await appleMobileWebAppCapableEl.getAttribute('content');
        expect(appleMobileWebAppCapable).toBe('yes');
    });

    test('debe tener el manifest.json accesible y correcto', async ({ page }) => {
        // En Expo Web con Metro, el manifest suele estar en /manifest.json o inyectado
        // Buscamos el link al manifest en el head
        const manifestLinkEl = page.locator('link[rel="manifest"]');
        await expect(manifestLinkEl).toHaveAttribute('href', /manifest\.json/, { timeout: 20000 });
        const manifestLink = await manifestLinkEl.getAttribute('href');
        expect(manifestLink).toBeTruthy();

        // Intentar navegar directamente al manifest o leer su contenido si es posible
        const manifestUrl = new URL(manifestLink!, page.url()).toString();
        const response = await page.request.get(manifestUrl);
        expect(response.ok()).toBeTruthy();
        
        const manifest = await response.json();
        expect(manifest.name).toBe('Muro de Deseos');
        expect(manifest.short_name).toBe('MuroDeseos');
        expect(manifest.display).toBe('standalone');
    });
});
