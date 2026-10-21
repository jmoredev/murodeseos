import { test, expect } from '@playwright/test';
import { LAST_SEEN_UPDATE_ID_KEY, getLatestUpdate, updates } from '../lib/updates';

/**
 * El modal de Novedades se anuncia **una vez por entrada**, y la entrada se identifica por su
 * `id`, no por la versión de la app. El gate viejo comparaba contra `package.json`, que quedó
 * congelado en `1.4.0`, así que después de cerrarlo una vez no aparecía nunca más.
 */
const latest = getLatestUpdate();

test.describe('Novedades (What\'s New Modal)', () => {
    test('debería aparecer para un usuario nuevo (sin historial)', async ({ page }) => {
        // Clear localStorage before navigating to ensure modal appears
        await page.goto('/');
        await page.evaluate((key) => localStorage.removeItem(key), LAST_SEEN_UPDATE_ID_KEY);
        await page.reload();

        // Verificar que el modal aparece
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText('Novedades')).toBeVisible();
        expect(latest).not.toBeNull();
        await expect(page.getByText(`v${latest?.release}`)).toBeVisible();
    });

    test('debería cerrarse y guardar el id de la entrada en localStorage', async ({ page }) => {
        // Clear localStorage first
        await page.goto('/');
        await page.evaluate((key) => localStorage.removeItem(key), LAST_SEEN_UPDATE_ID_KEY);
        await page.reload();

        // Verificar y cerrar
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        await page.getByRole('button', { name: '¡Entendido!' }).click();
        await expect(modal).not.toBeVisible();

        // Verificar localStorage: se guarda el `id`, no una versión
        const storedId = await page.evaluate(
            (key) => localStorage.getItem(key),
            LAST_SEEN_UPDATE_ID_KEY
        );
        expect(storedId).toBe(latest?.id);

        // Verificar persistencia al recargar
        await page.reload();
        await expect(modal).not.toBeVisible();
    });

    test('no debería aparecer si ya se ha visto la entrada actual', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(
            ({ key, id }) => {
                localStorage.setItem(key, id);
            },
            { key: LAST_SEEN_UPDATE_ID_KEY, id: latest?.id ?? '' }
        );
        await page.reload();

        await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('debería aparecer si la entrada guardada es otra anterior', async ({ page }) => {
        // Una entrada realmente existente pero no la última: la app tiene que anunciar la nueva.
        const anterior = updates[1];
        expect(anterior).toBeDefined();

        await page.goto('/');
        await page.evaluate(
            ({ key, id }) => {
                localStorage.setItem(key, id);
            },
            { key: LAST_SEEN_UPDATE_ID_KEY, id: anterior.id }
        );
        await page.reload();

        await expect(page.getByRole('dialog')).toBeVisible();
    });
});
