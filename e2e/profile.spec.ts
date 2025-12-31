import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';

test.describe('Funcionalidad de Perfil', () => {
    // Ejecución en serie para evitar colisiones en la base de datos con el mismo usuario
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
        // Captura de logs para depuración
        page.on('console', msg => {
            if (msg.type() === 'error') console.error(`[Navegador] ERROR: ${msg.text()}`);
        });

        // Ir directamente a la pestaña de perfil para mayor estabilidad
        await page.goto('/?tab=profile');

        // Esperar a que la sesión esté lista (botón de cerrar sesión visible)
        await expect(page.getByRole('button', { name: /Cerrar sesión/i }).first()).toBeVisible({ timeout: 15000 });

        // Esperar a que el spinner desaparezca
        await expect(page.getByText('🪄')).not.toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('heading', { name: 'Mi Perfil' })).toBeVisible();
    });

    test('debe actualizar el nombre y preferencias de estilo', async ({ page }) => {
        const uniqueName = `Usuario E2E ${Date.now()}`;

        // Rellenar Nombre
        const nameInput = page.locator('input#displayName');
        await expect(nameInput).toBeVisible();
        await nameInput.clear();
        await nameInput.fill(uniqueName);

        // Rellenar Tallas
        await page.getByPlaceholder('M, L, XL...').fill('XL');
        await page.getByPlaceholder('42, 32...').fill('44');

        // Guardar cambios
        await page.getByRole('button', { name: 'Guardar cambios' }).click();

        // Verificar mensaje de éxito
        await expect(page.getByText('¡Perfil actualizado correctamente!')).toBeVisible();

        // Recargar e ir directamente a la pestaña de perfil para verificar persistencia
        await page.goto('/?tab=profile');

        // Esperar a que cargue
        await expect(page.getByText('🪄')).not.toBeVisible();
        await expect(page.getByRole('heading', { name: 'Mi Perfil' })).toBeVisible();

        // Verificar que el valor se guardó (timeout largo por latencia de Supabase)
        await expect(page.locator('input#displayName')).toHaveValue(uniqueName, { timeout: 10000 });
    });

    test('debe cambiar el avatar', async ({ page }) => {
        // Abrir el modal del avatar (es el botón con el emoji)
        const avatarContainer = page.locator('button.relative.group').first();
        await expect(avatarContainer).toBeVisible();
        await avatarContainer.click();

        // Esperar a que aparezca el modal
        await expect(page.getByText('Elige tu avatar')).toBeVisible();

        // Seleccionar un nuevo emoji (ej: 😎)
        const emoji = '😎';
        // Buscamos el emoji dentro del modal. Usamos un selector que busque el texto exacto.
        const emojiBtn = page.locator('div.fixed.inset-0').getByText(emoji, { exact: true });
        await expect(emojiBtn).toBeVisible();
        await emojiBtn.click();

        // El modal debería cerrarse automáticamente al elegir
        await expect(page.getByText('Elige tu avatar')).not.toBeVisible();

        // Guardar los cambios
        await page.getByRole('button', { name: 'Guardar cambios' }).click();
        await expect(page.getByText('¡Perfil actualizado correctamente!')).toBeVisible();

        // Verificar tras recarga
        await page.goto('/?tab=profile');
        await expect(page.getByText('🪄')).not.toBeVisible();

        // El emoji debería ser visible en el contenedor principal
        await expect(page.locator('button.relative.group').first()).toContainText(emoji);
    });

    test('debe mostrar error de validación para nombre corto', async ({ page }) => {
        const nameInput = page.locator('input#displayName');
        await expect(nameInput).toBeVisible();
        await nameInput.clear();
        await nameInput.fill('X');

        // Debería aparecer el mensaje de error y el botón debería deshabilitarse
        await expect(page.getByText('Mínimo 3 caracteres')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    });
});
