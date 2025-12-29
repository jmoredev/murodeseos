import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';

test.describe('Wishlist Feature', () => {
    test.beforeEach(async ({ page }) => {
        // 1. Navigate to Home (User is already logged in via global setup)
        await page.goto('/');

        // 2. Navigate to Wishlist Tab
        const wishlistTab = page.getByText('Mi Lista');
        if (await wishlistTab.isVisible()) {
            await wishlistTab.click();
        }

        // Wait for loading to finish
        await expect(page.getByText('Cargando...')).not.toBeVisible();
        await expect(page.getByText('Mi lista de deseos')).toBeVisible();
    });

    test('should create, view and delete a wish', async ({ page }) => {
        const testItem = {
            title: `E2E Wish ${Date.now()}`,
            price: '99.99',
            notes: 'This is a test wish created by Playwright'
        };

        // Click Add button
        await page.getByLabel('Nuevo deseo').click();

        // Fill form
        await expect(page.getByText('Nuevo deseo')).toBeVisible();

        await page.getByPlaceholder('¿Qué deseas?').fill(testItem.title);
        await page.getByPlaceholder('Ej: 25.00').fill(testItem.price);

        await page.getByText('Guardar').click();

        // Verify it appears in the list
        const card = page.locator('.group.relative').filter({ has: page.getByRole('heading', { name: testItem.title }) }).first();
        await expect(card).toBeVisible();
        await card.scrollIntoViewIfNeeded();

        await expect(card).toContainText(`${testItem.price} €`);

        // --- Delete ---
        // Click on the item to edit
        await card.click();

        // Handle delete confirmation
        page.on('dialog', dialog => dialog.accept());

        // Wait for modal
        await expect(page.getByText('Editar deseo')).toBeVisible();

        const deleteBtn = page.getByLabel('Eliminar deseo');
        await expect(deleteBtn).toBeVisible();

        // Force scroll to center to avoid overlay issues on mobile (Next.js dev tools)
        await deleteBtn.evaluate(el => el.scrollIntoView({ block: 'center' }));

        // Use JS click to bypass potential overlaps
        await deleteBtn.evaluate(b => (b as HTMLElement).click());

        // Verify it's gone
        await expect(page.getByText(testItem.title)).not.toBeVisible();
    });

    test('should validate form inputs', async ({ page }) => {
        await page.getByLabel('Nuevo deseo').click();

        // Try to save empty
        await page.getByText('Guardar').click();

        // Should stay in modal due to validation
        await expect(page.getByText('Nuevo deseo')).toBeVisible();
    });
});
