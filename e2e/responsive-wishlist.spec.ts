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

async function getUserIdByEmail(email: string) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 0, per_page: 100 });
    const user = users?.find(u => u.email === email);
    if (!user?.id) throw new Error(`No se encontró userId para ${email}`);
    return user.id;
}

test.describe('Lista de Deseos de Amigo Responsiva', () => {
    let createdFriendWish: { userId: string; title: string; id: string } | null = null;

    test.afterEach(async ({ page }) => {
        // Limpiar reservas realizadas durante el test
        const cancelButtons = page.getByText('Cancelar reserva', { exact: true });
        // Hacemos una limpieza secuencial robusta
        while (await cancelButtons.count() > 0) {
            await cancelButtons.first().click();
            await page.waitForTimeout(500);
        }

        if (createdFriendWish) {
            await supabaseAdmin
                .from('wishlist_items')
                .delete()
                .eq('user_id', createdFriendWish.userId)
                .eq('title', createdFriendWish.title);
            createdFriendWish = null;
        }
    });

    test.beforeEach(async ({ page }) => {
        // Asegurar que el amigo tenga al menos un deseo para que el test encuentre "Reservar"
        const friendUserId = await getUserIdByEmail(E2E_CONFIG.secondaryUser.email);
        const friendWishTitle = `Friend Wish ${Date.now()}`;
        const { data: insertedWish, error: insertError } = await supabaseAdmin
            .from('wishlist_items')
            .insert({
                user_id: friendUserId,
                title: friendWishTitle,
                price: E2E_CONFIG.wishlistItems[0].price,
                image_url: null,
                links: [],
                notes: '',
                priority: E2E_CONFIG.wishlistItems[2].priority,
                reserved_by: null,
            })
            .select('id')
            .single();

        if (insertError || !insertedWish?.id) {
            throw new Error(`Error insertando wishlist para el amigo: ${insertError?.message ?? 'sin id'}`);
        }
        createdFriendWish = { userId: friendUserId, title: friendWishTitle, id: insertedWish.id };

        // Navegar directo al detalle del grupo E2E (evita fragilidad del tab "Mis grupos")
        const groupId = E2E_CONFIG.group.id;
        await page.goto(`/groups/${groupId}`);
        await expect(page).toHaveURL(new RegExp(`/groups/${groupId}`));

        const friendName = E2E_CONFIG.secondaryUser.displayName;
        await expect(page.getByText(friendName)).toBeVisible({ timeout: 10000 });

        // Entrar en la wishlist del miembro
        await page.getByText(friendName).first().click();

        // Verificar que estamos en su lista
        await expect(page).toHaveURL(/\/wishlist\//);
        await expect(page.getByText(`Lista de ${friendName}`)).toBeVisible({ timeout: 15000 });
    });

    test('debe mostrar la barra lateral integrada en escritorio', async ({ page }) => {
        // Forzar viewport de escritorio
        await page.setViewportSize({ width: 1280, height: 800 });
        // El layout depende de `useWindowDimensions`; recargamos para que se recalculen los breakpoints.
        await page.reload();

        // En desktop, la ficha de perfil lateral debe estar visible.
        await expect(page.getByText('Detalles y Tallas', { exact: true })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Talla Camiseta')).toBeVisible({ timeout: 10000 });
    });

    test('debe mostrar el FAB y el Bottom Sheet en móvil', async ({ page }) => {
        // Forzar viewport móvil
        await page.setViewportSize({ width: 375, height: 667 });
        await page.reload();

        // La barra lateral debería estar oculta en móvil (display: none por Tailwind)
        await expect(page.locator('aside')).not.toBeVisible();

        // Botón de información del perfil (móvil)
        const infoButton = page.getByTestId('wishlist-profile-info-button');
        await expect(infoButton).toBeVisible();

        // Abrir el Bottom Sheet
        await infoButton.click({ force: true });

        // Verificar que el panel de información se muestra
        const sheetTitle = page.getByText('Información', { exact: true });
        await expect(sheetTitle.first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Tallas')).toBeVisible({ timeout: 10000 });

        // Cerrar el bottom sheet
        const closeText = page.getByText('✕').first();
        const closeButton = closeText.locator('xpath=ancestor::*[contains(@class,"rounded-full")]').first();
        await closeButton.evaluate((el) => (el as HTMLElement).click());

        // El contenido debería desaparecer
        await expect(sheetTitle).not.toBeVisible({ timeout: 10000 });
    });

    test('debe permitir reservar un artículo en la vista de amigo', async ({ page }) => {
        const card = page.getByTestId(`wishlist-card-${createdFriendWish!.id}`);
        await expect(card.getByText(createdFriendWish!.title, { exact: true })).toBeVisible();
        const reserveBtn = card.getByTestId('wish-reserve-button');
        await expect(reserveBtn).toBeVisible();
        page.once('dialog', dialog => dialog.accept());
        await reserveBtn.evaluate((el) => (el as HTMLElement).click());
        await page.waitForTimeout(500);

        await expect(card.getByText(/Reservar|Cancelar reserva/i).first()).toBeVisible({ timeout: 15000 });
    });
});
