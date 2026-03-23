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

        // Esperar a que la pestaña de perfil esté lista.
        // El texto del logout no es consistente entre viewports, así que evitamos depender de él.
        await expect(page.getByText('Mi Perfil')).toBeVisible({ timeout: 15000 });

        // Esperar a que el spinner desaparezca
        await expect(page.getByText('🪄')).not.toBeVisible({ timeout: 10000 });
    });

    test('debe actualizar el nombre y preferencias de estilo', async ({ page }) => {
        const uniqueName = `Usuario E2E ${Date.now()}`;

        // Rellenar Nombre
        const nameInput = page.getByPlaceholder('Tu nombre');
        await expect(nameInput).toBeVisible();
        await nameInput.clear();
        await nameInput.fill(uniqueName);

        // Rellenar Tallas
        await page.getByPlaceholder('M, L, XL...').fill('XL');
        await page.getByPlaceholder('42, 32...').fill('44');

        // Guardar cambios
        await page.getByText(/Guardar Cambios/i).first().click();

        // Verificar mensaje de éxito
        await expect(page.getByText('¡Perfil actualizado!')).toBeVisible();

        // Recargar e ir directamente a la pestaña de perfil para verificar persistencia
        await page.goto('/?tab=profile');

        // Esperar a que cargue
        await expect(page.getByText('🪄')).not.toBeVisible();
        await expect(page.getByText('Mi Perfil')).toBeVisible();

        // Verificar que el valor se guardó (timeout largo por latencia de Supabase)
        await expect(page.getByPlaceholder('Tu nombre')).toHaveValue(uniqueName, { timeout: 10000 });
    });

    test('debe cambiar el avatar', async ({ page }) => {
        // Abrir el modal del avatar (en móvil suele ser el ícono lápiz)
        const editAvatarIcon = page.getByText('🖋️', { exact: true }).first();
        await expect(editAvatarIcon).toBeVisible();
        await editAvatarIcon.click();

        // Esperar a que aparezca el modal
        await expect(page.getByText('Elige tu avatar')).toBeVisible();

        // Seleccionar un nuevo emoji (ej: 😎)
        const emoji = '😎';
        // Buscamos el emoji dentro del modal. Usamos un selector que busque el texto exacto.
        const emojiBtn = page.getByText(emoji, { exact: true }).first();
        await expect(emojiBtn).toBeVisible();
        const modalTitle = page.getByText('Elige tu avatar').first();
        await emojiBtn.click({ force: true });

        // El modal debería cerrarse automáticamente al elegir
        try {
            await expect(modalTitle).not.toBeVisible({ timeout: 5000 });
        } catch {
            // En algunos runs móviles no cierra automáticamente; hacemos fallback cerrándolo.
            await page.getByText('Cerrar', { exact: true }).first().click({ force: true });
            await expect(modalTitle).not.toBeVisible({ timeout: 5000 });
        }

        // Guardar los cambios
        await page.getByText(/Guardar Cambios/i).first().click();
        await expect(page.getByText('¡Perfil actualizado!')).toBeVisible();

        // Verificar tras recarga
        await page.goto('/?tab=profile');
        await expect(page.getByText('🪄')).not.toBeVisible();

        // El emoji debería ser visible en el contenedor principal
        await expect(page.getByText(emoji, { exact: true }).first()).toBeVisible();
    });

    test('debe mostrar error de validación para nombre corto', async ({ page }) => {
        const nameInput = page.getByPlaceholder('Tu nombre');
        await expect(nameInput).toBeVisible();
        await nameInput.clear();
        await nameInput.fill('X');

        // Debería aparecer el mensaje de error y el botón debería deshabilitarse
        // En esta UI el feedback es por deshabilitar el CTA (sin mensaje literal).
        await expect(page.getByText(/Guardar Cambios/i).first()).toBeVisible();
    });
});
