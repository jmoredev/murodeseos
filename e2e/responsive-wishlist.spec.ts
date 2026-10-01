import { test, expect, type Page } from '@playwright/test';
import { E2E_CONFIG } from './config';
import { supabaseAdmin } from './supabase-admin';

async function getUserIdByEmail(email: string) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 0, perPage: 100 });
    const user = users?.find(u => u.email === email);
    if (!user?.id) throw new Error(`No se encontró userId para ${email}`);
    return user.id;
}

/**
 * Same mobile-first overflow check as `e2e/mobile-layout.spec.ts` (Unit F),
 * kept local here: spec files cannot import each other without Playwright
 * re-collecting the imported file's tests, and a shared helper module is not
 * part of this unit's edit surfaces. Fails naming which surface (html/body)
 * scrolled and which elements stick out, same reporting as the harness spec.
 */
async function expectNoHorizontalOverflow(page: Page, route: string) {
    const state = await page.evaluate(() => {
        function describeElement(el: Element): string {
            let name = el.tagName.toLowerCase();
            if (el.id) name += `#${el.id}`;
            const cls = (el.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
            if (cls) name += `.${cls}`;
            const label = el.getAttribute('aria-label') ?? el.getAttribute('data-testid');
            if (label) name += `[${label.slice(0, 40)}]`;
            const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
            if (text) name += ` ${JSON.stringify(text)}`;
            return name;
        }

        function isContentful(el: Element): boolean {
            if (['IMG', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(el.tagName)) return true;
            return el.children.length === 0 && (el.textContent ?? '').trim().length > 0;
        }

        const vw = window.innerWidth;
        const main = document.getElementById('muro-main-content');
        const offenders: string[] = [];
        let scanned = 0;
        for (const el of document.querySelectorAll('body *')) {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            scanned++;
            if (!isContentful(el)) continue;
            if (rect.right <= vw + 1 && rect.left >= -1) continue;
            let insideScrollContainer = false;
            for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
                const sx = getComputedStyle(ancestor).overflowX;
                if (sx === 'auto' || sx === 'scroll') {
                    insideScrollContainer = true;
                    break;
                }
            }
            if (insideScrollContainer) continue;
            offenders.push(`${describeElement(el)} (box ${Math.round(rect.left)}…${Math.round(rect.right)}px, width=${Math.round(rect.width)}px)`);
            if (offenders.length >= 10) break;
        }
        return {
            innerWidth: vw,
            documentScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            mainFound: !!main,
            mainScrollWidth: main?.scrollWidth ?? -1,
            mainClientWidth: main?.clientWidth ?? -1,
            scanned,
            offenders,
        };
    });
    const offenderHeader = state.offenders.length
        ? `\nElementos con contenido fuera del viewport: ${state.offenders.join('; ')}`
        : '';
    expect(
        state.scanned,
        `${route}: el escáner de overflow no vio ningún elemento renderizado (drift de ruta o selector).`,
    ).toBeGreaterThan(0);
    expect(
        state.mainFound,
        `${route}: el contenedor principal #muro-main-content no existe (drift del layout).`,
    ).toBe(true);
    expect(
        state.offenders,
        `${route}: hay contenido que se sale del viewport.${offenderHeader}`,
    ).toEqual([]);
    expect(
        state.mainScrollWidth,
        `${route}: #muro-main-content.scrollWidth (${state.mainScrollWidth}) > clientWidth + 1 (${state.mainClientWidth + 1}) (contenido recortado por el ScrollView).${offenderHeader}`,
    ).toBeLessThanOrEqual(state.mainClientWidth + 1);
    expect(
        state.documentScrollWidth,
        `${route}: document.documentElement.scrollWidth (${state.documentScrollWidth}) > window.innerWidth + 1 (${state.innerWidth + 1}).${offenderHeader}`,
    ).toBeLessThanOrEqual(state.innerWidth + 1);
    expect(
        state.bodyScrollWidth,
        `${route}: document.body.scrollWidth (${state.bodyScrollWidth}) > window.innerWidth + 1 (${state.innerWidth + 1}).${offenderHeader}`,
    ).toBeLessThanOrEqual(state.innerWidth + 1);
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
            })
            .select('id')
            .single();

        if (insertError || !insertedWish?.id) {
            // El mensaje importa: si el `user_id` no llega, la columna toma su valor por
            // defecto (`auth.uid()`, nulo con el cliente de servicio) y PostgREST responde
            // «new row violates row-level security policy», que apunta a permisos y no al
            // problema real.
            throw new Error(
                `Error insertando el deseo del amigo (user_id=${friendUserId}, código=${insertError?.code ?? 'sin código'}): ` +
                    `${insertError?.message ?? 'sin id devuelto'}`,
            );
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

        // Original intent of the removed `aside` assertion: the desktop branch
        // of the layout must not render on mobile. It was vacuous — there is no
        // `<aside>` anywhere in app/ or components/ (the desktop sidebar is a
        // `w-80` div inside an `isDesktop &&` gate in app/wishlist/[id]/index.tsx),
        // so `not.toBeVisible()` on a locator with zero matches can never fail.
        // The intent is asserted for real, without test-only hooks, in two parts:
        // 1) the mobile-only info button (rendered only when `!isDesktop`) is
        // present, proving the mobile branch is the one rendered;
        // 2) the desktop sidebar's content ('Detalles y Tallas', only rendered
        // by the desktop `w-80` sidebar while the mobile bottom sheet is still
        // closed here) does not appear at all — falsifiable because if that
        // branch ever leaked into mobile, this exact line turns the test red.
        // 3) plus the shared mobile-first check: the route must not scroll
        // horizontally at this viewport.
        const infoButton = page.getByTestId('wishlist-profile-info-button');
        await expect(infoButton).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Detalles y Tallas')).toBeHidden();
        await expectNoHorizontalOverflow(page, '/wishlist/[id] (rama móvil)');

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

    test('debe abrir el detalle al hacer clic en un deseo', async ({ page }) => {
        const card = page.getByTestId(`wishlist-card-${createdFriendWish!.id}`);
        await card.getByText(createdFriendWish!.title, { exact: true }).click();

        await expect(page.getByTestId('wish-detail-modal')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('wish-detail-title')).toHaveText(createdFriendWish!.title);
    });

    test('debe permitir reservar un artículo en la vista de amigo', async ({ page }) => {
        const card = page.getByTestId(`wishlist-card-${createdFriendWish!.id}`);
        await expect(card.getByText(createdFriendWish!.title, { exact: true })).toBeVisible();
        const reserveBtn = card.getByTestId('wish-reserve-button');
        await expect(reserveBtn).toBeVisible();
        await reserveBtn.click();
        await expect(card.getByText(/Reservado por ti/i)).toBeVisible({ timeout: 15000 });
        await expect(card.getByTestId('wish-cancel-reserve-button')).toBeVisible();
    });
});
