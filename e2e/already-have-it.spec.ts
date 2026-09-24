import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';
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
            (r.status() === 200 || r.status() === 201)
        );
        await page.getByText('Guardar', { exact: true }).last().click({ force: true });
        await responsePromise;

        // 2. Verificar que el deseo aparece y tiene el botón "Ya lo tengo"
        const createdTitle = page.getByText(testTitle, { exact: true }).first();
        await expect(createdTitle).toBeVisible({ timeout: 15000 });

        // 3. Hacer clic en el botón "✓ Ya lo tengo" de la MISMA tarjeta que contiene `testTitle`
        const card = page
            .locator('[data-testid^="wishlist-card-"]')
            .filter({ hasText: testTitle })
            .first();
        const quickDeleteBtn = card.getByText(/Ya lo tengo/i).first();
        await expect(quickDeleteBtn).toBeVisible();
        await quickDeleteBtn.evaluate((el) => (el as HTMLElement).click());

        const confirmBtn = page.getByText('Eliminar', { exact: true }).first();
        await expect(confirmBtn).toBeVisible({ timeout: 5000 });
        await confirmBtn.evaluate((el) => (el as HTMLElement).click());

        // 4. Verificar que desaparece
        await expect(createdTitle).not.toBeVisible({ timeout: 15000 });
    });

    test('no debe mostrar el botón "Ya lo tengo" en la lista de un amigo', async ({ page }) => {
        // Asegurar que el amigo tenga al menos un deseo, para que exista el botón "Reservar".
        const friendEmail = E2E_CONFIG.secondaryUser.email;
        const friendName = E2E_CONFIG.secondaryUser.displayName;

        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 0, perPage: 100 });
        const friendUser = users?.find(u => u.email === friendEmail);
        if (!friendUser?.id) throw new Error(`No se encontró el userId del amigo (${friendEmail})`);

        const seededFriendWishTitle = `Friend Wish ${Date.now()}`;
        const { error: insertError } = await supabaseAdmin.from('wishlist_items').insert({
            user_id: friendUser.id,
            title: seededFriendWishTitle,
            price: E2E_CONFIG.wishlistItems[0].price,
            image_url: null,
            links: [],
            notes: '',
            priority: E2E_CONFIG.wishlistItems[2].priority,
            reserved_by: null
        });

        if (insertError) throw new Error(`Error insertando wishlist para el amigo: ${insertError.message}`);

        // Ir a la lista de un amigo (Juan Pérez por ejemplo)
        const groupName = E2E_CONFIG.group.name;
        await page.goto('/?tab=groups');
        await page.getByText(groupName).click();

        await page.getByText(friendName).first().click();

        // Verificar que estamos en la lista del amigo
        await expect(page.getByText(`Lista de ${friendName}`)).toBeVisible({ timeout: 15000 });

        // El botón "Ya lo tengo" NO debería estar para ningún deseo del amigo
        await expect(page.getByText(/Ya lo tengo/i)).not.toBeVisible();
        await expect(page.getByText('Reservar', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    });
});
