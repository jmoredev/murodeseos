import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';

test.describe('Funcionalidad "Ya lo tengo"', () => {

    test.beforeEach(async ({ page }) => {
        // Asegurarnos de estar en la pestaña de deseos
        await page.goto('/?tab=wishlist');
        await page.waitForLoadState('networkidle');
    });

    test('debe permitir borrar un deseo rápidamente con el botón "Ya lo tengo"', async ({ page }) => {
        // 1. Crear un deseo de prueba
        const testTitle = `Deseo de prueba ${Date.now()}`;
        await page.getByLabel('Nuevo deseo').click();
        await page.getByPlaceholder('¿Qué deseas?').fill(testTitle);

        // Interceptar respuesta para confirmar creación
        const responsePromise = page.waitForResponse(r =>
            r.request().method() === 'POST' &&
            r.url().includes('wishlist_items') &&
            r.status() === 201
        );
        await page.getByRole('button', { name: 'Guardar', exact: true }).click();
        await responsePromise;

        // 2. Verificar que el deseo aparece y tiene el botón "Ya lo tengo"
        // Buscamos el contenedor exacto de la tarjeta que contiene el título
        const card = page.locator('div.group').filter({ hasText: testTitle }).first();
        await expect(card).toBeVisible();
        const quickDeleteBtn = card.getByRole('button', { name: 'Ya lo tengo' });
        await expect(quickDeleteBtn).toBeVisible();

        // 3. Hacer clic y confirmar el diálogo (ConfirmModal)
        await quickDeleteBtn.click();

        const confirmBtn = page.getByRole('button', { name: 'Confirmar' });
        await expect(confirmBtn).toBeVisible();
        await confirmBtn.click();

        // 4. Verificar que desaparece
        await expect(card).not.toBeVisible();
    });

    test('no debe mostrar el botón "Ya lo tengo" en la lista de un amigo', async ({ page }) => {
        // Ir a la lista de un amigo (Juan Pérez por ejemplo)
        const groupName = E2E_CONFIG.group.name;
        await page.goto('/?tab=groups');
        await page.getByText(groupName).click();

        const friendName = 'Juan Pérez';
        await page.getByText(friendName).first().click();

        // Verificar que estamos en la lista del amigo
        await expect(page.getByText(`Lista de deseos de ${friendName}`)).toBeVisible();

        // El botón "Ya lo tengo" NO debería estar para ningún deseo del amigo
        // Solo debería estar el botón "Reservar" o "Cancelar reserva"
        const card = page.locator('div.group.relative').first();
        await expect(card.getByRole('button', { name: 'Ya lo tengo' })).not.toBeVisible();
        await expect(card.getByRole('button', { name: 'Reservar' })).toBeVisible();
    });
});
