import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';
import packageJson from '../package.json';

test.describe('Visibilidad de Deseos por Grupo', () => {
    // El usuario E2E ya está logueado por auth.setup.ts

    test('debe ocultar deseos excluidos de grupos específicos', async ({ page }) => {
        const publicTitle = `Regalo Público ${Date.now()}`;
        const secretTitle = `Regalo Secreto ${Date.now()}`;

        // 1. Usuario E2E crea regalos
        await page.goto('/');
        await expect(page).toHaveURL('/');

        // Crear Regalo Público
        await page.click('button[aria-label="Nuevo deseo"]');
        await page.fill('input[placeholder="¿Qué deseas?"]', publicTitle);
        await page.click('button[type="submit"]');
        await expect(page.locator(`text=${publicTitle}`)).toBeVisible();

        // Crear Regalo Secreto (Excluido de E2E Test Group)
        await page.click('button[aria-label="Nuevo deseo"]');
        await page.fill('input[placeholder="¿Qué deseas?"]', secretTitle);

        // Marcar exclusión para E2E Test Group
        const groupCheckbox = page.locator('label', { hasText: E2E_CONFIG.group.name }).locator('input[type="checkbox"]');
        await expect(groupCheckbox).toBeVisible({ timeout: 10000 });
        await groupCheckbox.check();

        await page.click('button[type="submit"]');
        await expect(page.locator(`text=${secretTitle}`)).toBeVisible();

        // 2. Logout del usuario E2E y Login como Juan Pérez
        await page.context().clearCookies();
        await page.evaluate((version) => {
            localStorage.clear();
            sessionStorage.clear();
            // Evitar que aparezca el modal de novedades usando la versión actual
            localStorage.setItem('lastSeenVersion', version);
        }, packageJson.version);

        await page.goto('/login');
        const emailInput = page.locator('input#email');
        const passwordInput = page.locator('input#password');

        await expect(emailInput).toBeVisible();
        await emailInput.fill('juan@test.com');
        await passwordInput.fill('Test123!');
        await page.click('button[type="submit"]');

        // Esperar a entrar y que desaparezca el Cargando oficial
        await page.waitForURL(url => url.pathname === '/' || url.pathname === '/profile/setup', { timeout: 15000 });
        await expect(page.locator('text=Cargando...')).not.toBeVisible({ timeout: 10000 });

        // Asegurar que el dashboard base está cargado antes de navegar
        await expect(page.locator('h1', { hasText: 'Muro de deseos' })).toBeVisible({ timeout: 10000 });

        // 3. Juan navega al grupo E2E
        // Intentamos navegar usando goto, pero capturamos el posible aborto por redirects en vuelo
        try {
            await page.goto('/?tab=groups');
        } catch (e) {
            // Si falla por abort, asumimos que hubo un redirect concurrente.
            // Verificamos si ya estamos en la pestaña correcta o reintentamos
            await page.goto('/?tab=groups');
        }

        // Esperar a que el contenido de la pestaña de grupos sea visible
        await expect(page.locator('h1', { hasText: 'Mis grupos' })).toBeVisible({ timeout: 15000 });

        // Localizar el grupo E2E
        const groupCard = page.locator('.group-card', { hasText: E2E_CONFIG.group.name });
        await expect(groupCard).toBeVisible({ timeout: 10000 });

        // Dentro de la tarjeta del grupo, Juan debería ver a "E2E Test User"
        // Hacemos clic en el nombre del usuario para ir a su lista
        await groupCard.locator(`text=${E2E_CONFIG.user.displayName}`).click();

        // 4. Verificar visibilidad
        // El regalo público debe ser visible
        await expect(page.locator(`text=${publicTitle}`)).toBeVisible({ timeout: 15000 });

        // El regalo secreto NO debe ser visible
        await expect(page.locator(`text=${secretTitle}`)).not.toBeVisible();

        // 5. Limpieza
        await page.context().clearCookies();
        await page.evaluate((version) => {
            localStorage.clear();
            localStorage.setItem('lastSeenVersion', version);
        }, packageJson.version);
        await page.goto('/login');
        await page.locator('input#email').fill(E2E_CONFIG.user.email);
        await page.locator('input#password').fill(E2E_CONFIG.user.password);
        await page.click('button[type="submit"]');
        await page.waitForURL('/', { timeout: 15000 });

        // Asegurarnos de estar en la pestaña de "Mi lista"
        await page.goto('/?tab=wishlist');
        await expect(page.locator('h1', { hasText: 'Mi lista de deseos' })).toBeVisible({ timeout: 15000 });

        // Borrar regalo público
        const publicGiftCard = page.locator('div.group', { hasText: publicTitle }).first();
        await publicGiftCard.click();

        const deleteBtn1 = page.locator('button[aria-label="Eliminar deseo"]');
        await expect(deleteBtn1).toBeVisible({ timeout: 10000 });

        // Configuramos un manejador para dialogos por si acaso hay confirmación nativa
        page.once('dialog', dialog => dialog.accept());
        await deleteBtn1.click();

        // Esperar a que el item desaparezca de la lista (confirmación real de borrado)
        // Esto también implica que el modal se ha cerrado y la lista se ha actualizado
        await expect(page.locator(`text=${publicTitle}`)).not.toBeVisible({ timeout: 15000 });

        // Borrar regalo secreto
        const secretGiftCard = page.locator('div.group', { hasText: secretTitle }).first();
        await expect(secretGiftCard).toBeVisible({ timeout: 10000 });
        await secretGiftCard.click();

        const deleteBtn2 = page.locator('button[aria-label="Eliminar deseo"]');
        await expect(deleteBtn2).toBeVisible({ timeout: 10000 });

        page.once('dialog', dialog => dialog.accept());
        await deleteBtn2.click();

        await expect(page.locator(`text=${secretTitle}`)).not.toBeVisible({ timeout: 15000 });
    });
});
