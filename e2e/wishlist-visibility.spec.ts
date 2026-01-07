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
        await expect(passwordInput).toBeVisible();

        // Helper para rellenar campos de forma robusta (especialmente para móvil + hidratación)
        const fillRobustly = async (input: any, value: string) => {
            await input.scrollIntoViewIfNeeded();
            // Esperar a que sea editable 
            await expect(input).toBeEditable();

            await input.click();
            await input.fill(value);
            await input.blur();

            // Si falla, reintentamos tecleando (común en móviles lentos o hidratación tardía)
            if (await input.inputValue() !== value) {
                console.log(`⚠️ Reintentando rellenar campo con tecleo lento para "${value}"...`);
                await input.click();
                await input.clear();
                await input.pressSequentially(value, { delay: 100 });
                await input.blur();
            }
            await expect(input).toHaveValue(value);
        };

        await fillRobustly(emailInput, E2E_CONFIG.secondaryUser.email);
        await fillRobustly(passwordInput, E2E_CONFIG.secondaryUser.password);

        const submitBtn = page.locator('button[type="submit"]');
        await expect(submitBtn).toBeEnabled({ timeout: 5000 }).catch(() => console.log('⚠️ Botón submit no habilitado a tiempo'));
        await submitBtn.click();

        // Esperar a entrar y que desaparezca el Cargando oficial
        try {
            await page.waitForURL(url => url.pathname === '/' || url.pathname === '/profile/setup', { timeout: 30000 });
        } catch (e) {
            const currentUrl = page.url();
            console.error(`❌ Timeout esperando redirección. URL actual: ${currentUrl}`);

            // Si falla, intentamos ver si hay un error en pantalla para debug
            const errorMsg = await page.locator('div[role="alert"], .text-red-500').textContent().catch(() => null);
            if (errorMsg) {
                console.error('❌ Error visible en login:', errorMsg);
                throw new Error(`Login fallido con error visible: ${errorMsg}`);
            }
            throw e;
        }
        await expect(page.locator('text=Cargando...')).not.toBeVisible({ timeout: 15000 });

        // Manejar posible redirección a /profile/setup (común en primer login o pérdida de estado)
        if (page.url().includes('/profile/setup')) {
            console.log('⚠️ Redirigido a setup, completando perfil básico...');
            await page.fill('input[name="display_name"]', 'Juan Pérez');
            // Selectores pueden variar, ajustamos a lo más probable en base a setup
            const saveBtn = page.locator('button', { hasText: 'Guardar' }).or(page.locator('button[type="submit"]'));
            await saveBtn.click();
            await page.waitForURL('/', { timeout: 15000 });
        }

        // Asegurar que el dashboard base está cargado antes de navegar
        await expect(page.locator('h1', { hasText: 'Muro de deseos' })).toBeVisible({ timeout: 20000 });

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

        const emailInput2 = page.locator('input#email');
        const passwordInput2 = page.locator('input#password');

        // Reutilizamos el helper con reintentos
        await fillRobustly(emailInput2, E2E_CONFIG.user.email);
        await fillRobustly(passwordInput2, E2E_CONFIG.user.password);

        await page.click('button[type="submit"]');

        // Aumentamos timeout aquí también
        await page.waitForURL('/', { timeout: 30000 });

        // Asegurarnos de estar en la pestaña de "Mi lista"
        try {
            await page.goto('/?tab=wishlist');
        } catch (e) {
            console.log('⚠️ Navegación abortada o interrumpida (posible redirect), verificando estado...');
        }
        await expect(page.locator('h1', { hasText: 'Mi lista de deseos' })).toBeVisible({ timeout: 15000 });

        // Borrar regalo público
        const publicGiftCard = page.locator('div.group', { hasText: publicTitle }).first();
        await publicGiftCard.click();

        const deleteBtn1 = page.locator('button[aria-label="Eliminar deseo"]');
        await expect(deleteBtn1).toBeVisible({ timeout: 10000 });

        // Configuramos un manejador para dialogos por si acaso hay confirmación nativa
        page.once('dialog', dialog => dialog.accept());

        // Usar click nativo JS para evitar intercepción del click por el icono de Next.js
        await deleteBtn1.evaluate((btn) => (btn as HTMLElement).click());

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
        await deleteBtn2.evaluate((btn) => (btn as HTMLElement).click());

        await expect(page.locator(`text=${secretTitle}`)).not.toBeVisible({ timeout: 15000 });
    });
});
