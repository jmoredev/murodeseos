import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';
import packageJson from '../package.json';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey =
    process.env.NEXT_SERVICE_ROLE_KEY ||
    process.env.EXPO_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Faltan env vars para supabaseAdmin en E2E');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

test.describe('Visibilidad de Deseos por Grupo', () => {
    // El usuario E2E ya está logueado por auth.setup.ts

    test('debe ocultar deseos excluidos de grupos específicos', async ({ page }) => {
        const publicTitle = `Regalo Público ${Date.now()}`;
        const secretTitle = `Regalo Secreto ${Date.now()}`;

        // 1. Usuario E2E crea regalos
        await page.goto('/');
        await expect(page).toHaveURL('/');

        // Crear Regalo Público
        await page.getByLabel('Nuevo deseo').click();
        await page.fill('input[placeholder="¿Qué deseas?"]', publicTitle);
        const saveBtn1 = page.getByText('Guardar', { exact: true }).last();
        await saveBtn1.evaluate((el) => (el as HTMLElement).click());
        await expect(page.locator(`text=${publicTitle}`)).toBeVisible();

        // Crear Regalo Secreto (Excluido de E2E Test Group)
        await page.getByLabel('Nuevo deseo').click();
        await page.fill('input[placeholder="¿Qué deseas?"]', secretTitle);

        // Marcar exclusión para E2E Test Group
        const groupCheckbox = page.locator('label', { hasText: E2E_CONFIG.group.name }).locator('input[type="checkbox"]');
        await expect(groupCheckbox).toBeVisible({ timeout: 10000 });
        await groupCheckbox.check();

        const saveBtn2 = page.getByText('Guardar', { exact: true }).last();
        await saveBtn2.evaluate((el) => (el as HTMLElement).click());
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
        const emailInput = page.getByTestId('email-input');
        const passwordInput = page.getByTestId('password-input');

        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();

        // Mobile Safari puede perder el valor en inputs justo antes del submit.
        // Reintentamos con tecleo secuencial si el valor no queda persistido.
        const fillRobustly = async (input: any, value: string) => {
            await expect(input).toBeEditable();
            await input.fill('');
            await input.fill(value);
            if (await input.inputValue() !== value) {
                await input.fill('');
                await input.pressSequentially(value, { delay: 60 });
            }
            if (await input.inputValue() !== value) {
                await input.evaluate((el: Element, v: string) => {
                    const inputEl = el as HTMLInputElement;
                    inputEl.value = v;
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                }, value);
            }
            await expect(input).toHaveValue(value);
        };

        const loginAsSecondaryUser = async () => {
            for (let attempt = 1; attempt <= 2; attempt++) {
                await fillRobustly(emailInput, E2E_CONFIG.secondaryUser.email);
                await fillRobustly(passwordInput, E2E_CONFIG.secondaryUser.password);

                const loginBtn = page.getByTestId('login-button');
                await loginBtn.evaluate((el) => (el as HTMLElement).click());

                try {
                    await page.waitForURL(url => url.pathname === '/' || url.pathname === '/profile/setup', { timeout: 15000 });
                    return;
                } catch {
                    if (attempt === 2) {
                        const currentUrl = page.url();
                        const errorMsg = await page.locator('div[role="alert"], .text-red-500').textContent().catch(() => null);
                        throw new Error(`Login secundario fallido. URL: ${currentUrl}. Error: ${errorMsg ?? 'sin mensaje visible'}`);
                    }
                    await page.waitForTimeout(1000);
                }
            }
        };

        await loginAsSecondaryUser();
        await expect(page.locator('text=Cargando...')).not.toBeVisible({ timeout: 15000 });

        // Manejar posible redirección a /profile/setup (común en primer login o pérdida de estado)
        if (page.url().includes('/profile/setup')) {
            console.log('⚠️ Redirigido a setup, completando perfil básico...');
            // Paso 1: Nombre y Avatar
            await page.fill('#displayName', E2E_CONFIG.secondaryUser.displayName);
            await page.click('button:has-text("Continuar")');

            // Paso 2: Estilo (opcional) - Esperar a que aparezca el botón de saltar
            const skipStyleBtn = page.locator('button', { hasText: 'Saltar por ahora' });
            await skipStyleBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
            if (await skipStyleBtn.isVisible()) {
                await skipStyleBtn.click();
            }

            await page.waitForURL('/', { timeout: 15000 });
        }

        // Asegurar que el dashboard base está cargado antes de navegar
        await expect(page.getByText('Deseos', { exact: true }).first()).toBeVisible({ timeout: 20000 });

        // 3. Juan navega directo al grupo E2E para evitar fragilidad del tab "Mis grupos"
        await page.goto(`/groups/${E2E_CONFIG.group.id}`);
        await expect(page).toHaveURL(new RegExp(`/groups/${E2E_CONFIG.group.id}`));
        await page.getByText(E2E_CONFIG.user.displayName).first().click({ force: true });

        // 4. Verificar visibilidad
        // El regalo público debe ser visible
        await expect(page.locator(`text=${publicTitle}`).first()).toBeVisible({ timeout: 15000 });

        // El regalo secreto NO debe ser visible
        await expect(page.locator(`text=${secretTitle}`).first()).not.toBeVisible();

        // 5. Limpieza (DB directa para evitar flakiness de UI móvil)
        await supabaseAdmin.from('wishlist_items').delete().eq('title', publicTitle);
        await supabaseAdmin.from('wishlist_items').delete().eq('title', secretTitle);
    });
});
