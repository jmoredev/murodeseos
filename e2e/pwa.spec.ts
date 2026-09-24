import { test, expect } from '@playwright/test';

test.describe('PWA Capabilities', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('debe tener las meta etiquetas básicas de PWA', async ({ page }) => {
        // Verificar que el título de la app sea correcto
        await expect(page).toHaveTitle(/Muro de Deseos/);

        // Verificar el color del tema
        const themeColorEl = page.locator('meta[name="theme-color"]');
        await expect(themeColorEl).toHaveAttribute('content', '#4F46E5', { timeout: 15000 });
        const themeColor = await themeColorEl.getAttribute('content');
        expect(themeColor).toBe('#4F46E5');

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
