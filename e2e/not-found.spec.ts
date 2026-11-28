import { test, expect } from '@playwright/test';

/**
 * Página no encontrada (12 · P6). Antes decía «Esta página no existe.» y ofrecía un solo enlace;
 * ahora dice qué ha pasado, da dos salidas y explica lo de los enlaces de invitación.
 *
 * No necesita sesión: una dirección que no existe no tiene usuario.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Página no encontrada', () => {
    test('una dirección que no existe explica qué pasa y ofrece dos salidas', async ({ page }) => {
        await page.goto('/esta-direccion-no-existe');

        await expect(page.getByText('Página no encontrada')).toBeVisible({ timeout: 15_000 });
        await expect(
            page.getByText(
                'Esta dirección no existe o ha dejado de existir. Si vienes de un enlace, puede que esté mal copiado.',
            ),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ir a Inicio' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Abrir Mi lista' })).toBeVisible();
        await expect(page.getByText(/Los enlaces de invitación abren un grupo concreto/i)).toBeVisible();
    });

    test('«Abrir Mi lista» lleva a la pestaña de la lista', async ({ page }) => {
        await page.goto('/esta-direccion-no-existe');

        await page.getByRole('button', { name: 'Abrir Mi lista' }).click();

        await expect(page).toHaveURL(/tab=wishlist/, { timeout: 15_000 });
        await expect(page.getByText('Página no encontrada')).not.toBeVisible();
    });
});
