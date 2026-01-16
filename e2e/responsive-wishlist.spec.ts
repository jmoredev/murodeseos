import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';

test.describe('Lista de Deseos de Amigo Responsiva', () => {

    test.afterEach(async ({ page }) => {
        // Limpiar reservas realizadas durante el test
        const cancelButtons = page.getByRole('button', { name: 'Cancelar reserva' });
        // Hacemos una limpieza secuencial robusta
        while (await cancelButtons.count() > 0) {
            await cancelButtons.first().click();
            await page.waitForTimeout(500);
        }
    });

    test.beforeEach(async ({ page }) => {
        // Ir a la pestaña de grupos directamente
        await page.goto('/?tab=groups');

        // Esperar a que carguen los grupos
        const groupName = E2E_CONFIG.group.name;
        await expect(page.getByText(groupName)).toBeVisible({ timeout: 10000 });

        // Entrar en el grupo E2E
        await page.getByText(groupName).click();

        // Verificar que estamos en la página del grupo
        await expect(page).toHaveURL(/\/groups\/E2E001/);

        // Buscar a Juan Pérez (que ha sido añadido al grupo en el seed)
        const friendName = 'Juan Pérez';
        await expect(page.getByText(friendName)).toBeVisible({ timeout: 10000 });

        // Hacer clic en Juan Pérez para ver su lista
        await page.getByText(friendName).first().click();

        // Verificar que estamos en su lista
        await expect(page).toHaveURL(/\/wishlist\//);
        await expect(page.getByText(`Lista de deseos de ${friendName}`)).toBeVisible();
    });

    test('debe mostrar la barra lateral integrada en escritorio', async ({ page }) => {
        // Forzar viewport de escritorio
        await page.setViewportSize({ width: 1280, height: 800 });

        // La barra lateral (aside) debería estar visible
        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible();
        await expect(sidebar).toContainText('Perfil de Estilo');

        // Verificar información específica del perfil de Juan Pérez
        await expect(sidebar).toContainText('Tallas');
        await expect(sidebar).toContainText('Camiseta');
    });

    test('debe mostrar el FAB y el Bottom Sheet en móvil', async ({ page }) => {
        // Forzar viewport móvil
        await page.setViewportSize({ width: 375, height: 667 });

        // La barra lateral debería estar oculta en móvil (display: none por Tailwind)
        await expect(page.locator('aside')).not.toBeVisible();

        // El FAB (Botón Flotante) debería estar visible
        const fab = page.locator('button.bg-indigo-600.rounded-full');
        await expect(fab).toBeVisible();

        // Abrir el Bottom Sheet
        await fab.click();

        // Localizar el contenedor del Bottom Sheet (el que tiene bordes redondeados arriba)
        const drawer = page.locator('div.rounded-t-\\[2\\.5rem\\]');
        await expect(drawer).toBeVisible();

        // El contenido del bottom sheet debería aparecer
        await expect(drawer.getByText('Tallas')).toBeVisible();

        // Cerrar el bottom sheet usando el botón de cerrar (la X)
        const closeButton = drawer.locator('button').first();
        await closeButton.click();

        // El contenido debería desaparecer
        await expect(drawer).not.toBeVisible();
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
