import { test, expect } from '@playwright/test';

test.describe('PWA Capabilities', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('debe tener las meta etiquetas básicas de PWA', async ({ page }) => {
        // Verificar que el título de la app sea correcto
        await expect(page).toHaveTitle(/Muro de Deseos/);

        // Verificar el color del tema
        const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
        expect(themeColor).toBe('#4F46E5');

        // Verificar compatibilidad con iOS/Mobile web app
        const appleMobileWebAppCapable = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
        expect(appleMobileWebAppCapable).toBe('yes');
    });

    test('debe tener el manifest.json accesible y correcto', async ({ page }) => {
        // En Expo Web con Metro, el manifest suele estar en /manifest.json o inyectado
        // Buscamos el link al manifest en el head
        const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
        expect(manifestLink).toBeTruthy();

        // Intentar navegar directamente al manifest o leer su contenido si es posible
        const response = await page.request.get(manifestLink!);
        expect(response.ok()).toBeTruthy();
        
        const manifest = await response.json();
        expect(manifest.name).toBe('Muro de Deseos');
        expect(manifest.short_name).toBe('MuroDeseos');
        expect(manifest.display).toBe('standalone');
    });
});
