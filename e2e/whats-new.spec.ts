import { test, expect } from '@playwright/test';
import packageJson from '../package.json';

test.describe('Novedades (What\'s New Modal)', () => {
    test('debería aparecer para un usuario nuevo (sin historial)', async ({ page }) => {
        // Clear localStorage before navigating to ensure modal appears
        await page.goto('/');
        await page.evaluate(() => localStorage.removeItem('lastSeenVersion'));
        await page.reload();

        // Verificar que el modal aparece
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText('Novedades')).toBeVisible();
        await expect(page.getByText(`v${packageJson.version}`)).toBeVisible();
    });

    test('debería cerrarse y guardar la versión en localStorage', async ({ page }) => {
        // Clear localStorage first
        await page.goto('/');
        await page.evaluate(() => localStorage.removeItem('lastSeenVersion'));
        await page.reload();

        // Verificar y cerrar
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        await page.getByRole('button', { name: '¡Entendido!' }).click();
        await expect(modal).not.toBeVisible();

        // Verificar localStorage
        const storedVersion = await page.evaluate(() => localStorage.getItem('lastSeenVersion'));
        expect(storedVersion).toBe(packageJson.version);

        // Verificar persistencia al recargar
        await page.reload();
        await expect(modal).not.toBeVisible();
    });

    test('no debería aparecer si ya se ha visto la versión actual', async ({ page }) => {
        // Set the current version in localStorage
        await page.goto('/');
        await page.evaluate((version) => {
            localStorage.setItem('lastSeenVersion', version);
        }, packageJson.version);
        await page.reload();

        await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('debería aparecer si la versión guardada es anterior', async ({ page }) => {
        // Set an old version in localStorage
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('lastSeenVersion', '0.0.0');
        });
        await page.reload();

        await expect(page.getByRole('dialog')).toBeVisible();
    });
});
