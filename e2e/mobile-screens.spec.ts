import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { E2E_CONFIG } from './config';
import { abrirFormularioDeDeseo } from './helpers/nuevo-deseo';
import { supabaseAdmin } from './supabase-admin';

/**
 * Mobile visual harness: every run leaves PNGs that a human —or an agent
 * driving the session— can actually look at.
 *
 * Why it exists. The rest of the mobile suite *asserts* but never *shows*:
 * `playwright.config.ts` sets `screenshot: 'only-on-failure'`, so a green
 * mobile run leaves zero pixels behind. The narrow-layout invariants in
 * `mobile-layout.spec.ts` catch regressions they know how to name; anything
 * else (spacing, hierarchy, an image that lands in a weird place) is invisible
 * unless somebody opens the app. This spec is that somebody.
 *
 * Mobile only. It is gated on `isMobile`, so it runs on `Mobile Chrome`
 * (Pixel 5) and `Mobile Safari` (iPhone 12) and is skipped on the desktop
 * projects — the artifact is a phone screen, and duplicating it at 1280px
 * would only produce noise that looks like evidence.
 *
 * Determinism, two traps already paid for elsewhere:
 *   1. **Fonts.** Expo loads its Google Fonts asynchronously after first
 *      paint; a screenshot taken too early shows fallback metrics, so every
 *      capture waits on `document.fonts.ready` (returning a serializable
 *      value, not the `FontFaceSet`).
 *   2. **Animations.** React Native Web implements `animationType="slide"` as
 *      CSS keyframes on the modal container, so a capture mid-animation gets
 *      the off-screen state — the same trap documented in
 *      `odd/tasks/e2e-movil-ci.md` for a `force: true` click. Every capture
 *      passes `animations: 'disabled'`, which fast-forwards and freezes them.
 *
 * Artifacts land in `test-results/mobile-screens/<project>/` (already
 * gitignored) and are attached to the HTML report, so they survive a CI run
 * without a new upload step. `MOBILE_SHOT_DIR` overrides the directory.
 *
 * Read-only: it navigates and opens surfaces, and never submits a form.
 */

const SHOT_ROOT = process.env.MOBILE_SHOT_DIR ?? path.join('test-results', 'mobile-screens');

test.skip(({ isMobile }) => !isMobile, 'Visual harness: only the mobile projects (Mobile Chrome / Mobile Safari)');

/** Settle fonts and transitions, save the PNG, and attach it to the report. */
async function captura(page: Page, testInfo: TestInfo, name: string): Promise<void> {
    // Expo's fonts load after first paint; serializable value on purpose.
    await page.evaluate(async () => {
        await document.fonts.ready;
        return true;
    });

    const project = testInfo.project.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dir = path.join(SHOT_ROOT, project);
    const file = path.join(dir, `${name}.png`);

    await fs.mkdir(dir, { recursive: true });
    await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
    await testInfo.attach(name, { path: file, contentType: 'image/png' });
}

/**
 * Id de la segunda cuenta sembrada, para la lista de otra persona.
 *
 * `WishDetailModal` —la hoja inferior con la que se reserva un regalo— vive
 * solo en `app/wishlist/[id]`: en la lista **propia**, tocar una tarjeta abre
 * el formulario de edición (`WishListTab.openForm`). Es una lectura, no una
 * preparación: el spec no escribe nada.
 */
async function idDeLaOtraCuenta(): Promise<string> {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 0, perPage: 100 });
    if (error) throw error;

    const otra = data.users.find((user) => user.email === E2E_CONFIG.secondaryUser.email);
    if (!otra) {
        throw new Error(
            `No existe la cuenta E2E secundaria ${E2E_CONFIG.secondaryUser.email}. ` +
                'Lanza la suite con "pnpm run test:e2e", que levanta el stack y lo siembra.',
        );
    }

    return otra.id;
}

test.describe('capturas móviles (con sesión)', () => {
    test('01 · pestaña de deseos', async ({ page }, testInfo) => {
        await page.goto('/?tab=wishlist');
        await expect(page.locator('[data-testid^="wishlist-card-"]').first()).toBeVisible({ timeout: 20000 });
        await captura(page, testInfo, '01-deseos');
    });

    test('02 · pestaña de grupos', async ({ page }, testInfo) => {
        await page.goto('/?tab=groups');
        await expect(page.getByText(/Mis grupos/i).first()).toBeVisible({ timeout: 20000 });
        await captura(page, testInfo, '02-grupos');
    });

    test('03 · pestaña de perfil', async ({ page }, testInfo) => {
        await page.goto('/?tab=profile');
        await expect(page.getByText('Mi perfil').first()).toBeVisible({ timeout: 20000 });
        await captura(page, testInfo, '03-perfil');
    });

    test('04 · ficha de grupo', async ({ page }, testInfo) => {
        await page.goto(`/groups/${E2E_CONFIG.group.id}`);
        await expect(page.getByText(E2E_CONFIG.group.name).first()).toBeVisible({ timeout: 20000 });
        await captura(page, testInfo, '04-grupo');
    });

    test('05 · lista de otra persona', async ({ page }, testInfo) => {
        await page.goto(`/wishlist/${await idDeLaOtraCuenta()}`);
        await expect(page.locator('[data-testid^="wishlist-card-"]').first()).toBeVisible({ timeout: 20000 });
        await captura(page, testInfo, '05-lista-ajena');
    });

    test('06 · detalle de un deseo ajeno', async ({ page }, testInfo) => {
        await page.goto(`/wishlist/${await idDeLaOtraCuenta()}`);

        const primeraTarjeta = page.locator('[data-testid^="wishlist-card-"]').first();
        await expect(primeraTarjeta).toBeVisible({ timeout: 20000 });
        await primeraTarjeta.click();

        // El título es el ancla de contenido: el contenedor del modal puede
        // estar montado también cerrado, así que no probaría nada.
        await expect(page.getByTestId('wish-detail-title')).toBeVisible({ timeout: 10000 });
        await captura(page, testInfo, '06-detalle-deseo');
    });

    test('07 · pantalla del enlace', async ({ page }, testInfo) => {
        await page.goto('/wishlist/add');
        await expect(page.getByRole('button', { name: 'No tengo enlace' })).toBeVisible({ timeout: 20000 });
        await captura(page, testInfo, '07-nuevo-deseo-enlace');
    });

    test('08 · formulario de deseo nuevo', async ({ page }, testInfo) => {
        await page.goto('/?tab=wishlist');
        await expect(page.getByLabel('Nuevo deseo')).toBeVisible({ timeout: 20000 });

        // El helper ya espera al campo de título: el formulario está montado.
        await abrirFormularioDeDeseo(page);
        await captura(page, testInfo, '08-formulario-deseo');
    });

    test('09 · formulario de edición', async ({ page }, testInfo) => {
        await page.goto('/?tab=wishlist');

        // En la lista propia la tarjeta abre el formulario ya precargado.
        const primeraTarjeta = page.locator('[data-testid^="wishlist-card-"]').first();
        await expect(primeraTarjeta).toBeVisible({ timeout: 20000 });
        await primeraTarjeta.click();

        await expect(page.getByText('Editar deseo')).toBeVisible({ timeout: 10000 });
        await captura(page, testInfo, '09-editar-deseo');
    });
});

test.describe('capturas móviles (sin sesión)', () => {
    // Contexto limpio: el proyecto arrastra el `storageState` del setup.
    test.use({ storageState: { cookies: [], origins: [] } });

    test('10 · pantalla de acceso', async ({ page }, testInfo) => {
        await page.goto('/login');
        await expect(page.getByTestId('login-button')).toBeVisible({ timeout: 20000 });
        await captura(page, testInfo, '10-acceso');
    });
});
