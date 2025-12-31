import { test, expect } from '@playwright/test';

test.describe('Lista de Deseos de Amigo Responsiva', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: /Mis grupos|Grupos/i }).first().click();

        // Esperar a que carguen los grupos
        await expect(page.getByText('E2E Test Group')).toBeVisible();

        // Entrar en el grupo E2E
        await page.getByText('E2E Test Group').click();

        // Navegar a la lista de un amigo (usando Juan Pérez como ejemplo del seed)
        // Intentamos buscar el grupo "Familia García" que tiene más miembros
        await page.goto('/?tab=groups');
        const familyGroup = page.getByText('Familia García');
        if (await familyGroup.isVisible()) {
            await familyGroup.click();
            await expect(page.getByText('Juan Pérez')).toBeVisible();
            await page.getByRole('button', { name: 'Ver Lista' }).first().click();
        } else {
            // Fallback: Ir directamente a una URL conocida del seed si no se encuentra el grupo
            await page.goto('/wishlist/00000000-0000-0000-0000-000000000001?name=Juan%20Pérez');
        }

        await expect(page.getByText('Lista de Juan Pérez')).toBeVisible();
    });

    test('debe mostrar la barra lateral integrada en escritorio', async ({ page }) => {
        // Forzar viewport de escritorio
        await page.setViewportSize({ width: 1280, height: 800 });

        // La barra lateral debería estar visible
        await expect(page.locator('aside')).toBeVisible();
        await expect(page.getByText('Perfil de Estilo')).toBeVisible();

        // Verificar información específica
        await expect(page.locator('aside')).toContainText('Tallas');
    });

    test('debe mostrar el FAB y el Bottom Sheet en móvil', async ({ page }) => {
        // Forzar viewport móvil
        await page.setViewportSize({ width: 375, height: 667 });

        // La barra lateral debería estar oculta
        await expect(page.locator('aside.hidden.lg\\:block')).not.toBeVisible();

        // El FAB (Botón Flotante) debería estar visible
        const fab = page.locator('button.bg-indigo-600.rounded-full');
        await expect(fab).toBeVisible();

        // Abrir el Bottom Sheet
        await fab.click();

        // El contenido del bottom sheet debería aparecer
        await expect(page.getByText('Tallas')).toBeVisible();

        // Cerrar el bottom sheet (haciendo clic en el overlay)
        await page.locator('div.bg-black\\/60').click({ position: { x: 10, y: 10 }, force: true });
        await expect(page.getByText('Tallas')).not.toBeVisible();
    });

    test('debe permitir reservar un artículo en la vista de amigo', async ({ page }) => {
        // Buscar un botón de reservar
        const reserveButton = page.getByRole('button', { name: 'Reservar' }).first();
        await expect(reserveButton).toBeVisible();

        await reserveButton.click();

        // Debería cambiar a "Cancelar reserva"
        await expect(page.getByRole('button', { name: 'Cancelar reserva' }).first()).toBeVisible();

        // Cancelar de nuevo
        await page.getByRole('button', { name: 'Cancelar reserva' }).first().click();
        await expect(page.getByRole('button', { name: 'Reservar' }).first()).toBeVisible();
    });
});
