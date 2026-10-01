import { test, expect, type Page, type Locator } from '@playwright/test';
import { E2E_CONFIG } from './config';

/**
 * Mobile verification harness (`feat/mobile-first`, Unit F).
 *
 * This app is a mobile-first PWA served from GitHub Pages (`expo export
 * --platform web`): phones are the primary target, desktop must not break.
 * These specs hold the mobile-first line at a 360×640 viewport (narrow phone)
 * so nobody can regress it again:
 *
 *   1. no horizontal overflow on the stable routes, including content clipped
 *      by the RNW ScrollView (`#muro-main-content` has `overflow-x: hidden`
 *      and `app/+html.tsx` resets `body` to `overflow: hidden`, so a document
 *      scrollWidth check alone is vacuous here);
 *   2. interactive elements ≥ 24×24 CSS px, form controls with `font-size`
 *      ≥ 16px (the iOS Safari focus-zoom trigger) and the primary actions
 *      ≥ 44×44 (dock tabs, wish FAB, wish form save);
 *   3. on touch-enabled projects, no interactive element left invisible at
 *      rest (opacity product of the ancestor chain is 0 — the hover-only
 *      affordance pattern).
 *
 * Anti-vacuity guards: every scanner asserts it actually saw elements
 * (`expect…toBeGreaterThan(0)`), so selector/route drift fails loudly instead
 * of silently turning the check green — exactly the trap the audit caught in
 * `responsive-wishlist.spec.ts` (there is no `<aside>` anywhere).
 *
 * The `setup` project supplies the authenticated storage state, the same way
 * `wishlist.spec.ts` and `responsive-wishlist.spec.ts` consume it. Everything
 * here is read-only: no database writes, no form submissions.
 */

// 360×640: narrow phone width, the width the audit used when the identified
// narrow-screen risks were measured.
test.use({ viewport: { width: 360, height: 640 } });

const INTERACTIVE_SELECTOR =
    'button, [role="button"], [role="link"], a[href], ' +
    'input:not([type="hidden"]), select, textarea, ' +
    // react-native-web Pressable emits no role unless accessibilityRole is
    // set, but it always renders tabIndex="0" on web: this catches the
    // unlabeled/descriptive-less Pressables (member cards, back buttons,
    // sort chips) the role/a/href hooks miss.
    '[tabindex]:not([tabindex="-1"]), [aria-label]';

/** Half-pixel tolerance to absorb sub-pixel rounding in getBoundingClientRect. */
const RECT_EPSILON = 0.5;

interface InteractiveReport {
    name: string;
    width: number;
    height: number;
    fontSize: string;
    // For <input> elements, the resolved `type` ('' for every other tag). The
    // text-size check only cares about controls a user types into: a checkbox or
    // a radio carries no text to zoom, so it must not turn that check red.
    inputType: string;
    // Product of the computed opacity of the element and all its ancestors up
    // to body: a wrapper with `opacity: 0` hides the subtree just as surely as
    // opacity on the element itself, so the scan uses the chain product.
    opacityProduct: number;
}

/**
 * Horizontal overflow state of the page. Because RNW's ScrollView clips
 * (`overflow-x: hidden`) and `app/+html.tsx` sets `body { overflow: hidden }`,
 * overflowed content does NOT extend the document scrollable width, so the
 * document/body scrollWidth comparisons are only a first, weak signal; the
 * real signal is (a) #muro-main-content scrollWidth vs clientWidth and
 * (b) the offender scan below.
 *
 * Offender rule (explicit, kept next to the code that enforces it):
 *   - an offender is a *contentful* element — a leaf element (no child
 *     elements) carrying text, or any form control / link / button / image;
 *   - whose measured box crosses either viewport edge
 *     (`right > innerWidth + 1` or `left < -1`);
 *   - EXCEPT elements inside an ancestor that scrolls horizontally by itself
 *     (`overflow-x: auto|scroll`) — their overflow is intentional inner
 *     scrolling, not page breakage;
 *   - backdrops/clippers/empty wrappers are exempt because they carry no
 *     readable content; whenever real content overflows, its leaf element
 *     crosses the same edge and is reported (bounding rects are not clipped
 *     by ancestors, so overflow-hidden wrappers cannot hide offenders from
 *     this measurement).
 */
function getOverflowState(page: Page) {
    return page.evaluate(() => {
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

        function scrollsHorizontally(el: Element): boolean {
            const style = getComputedStyle(el);
            return style.overflowX === 'auto' || style.overflowX === 'scroll';
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
                if (scrollsHorizontally(ancestor)) {
                    insideScrollContainer = true;
                    break;
                }
            }
            if (insideScrollContainer) continue;
            offenders.push(
                `${describeElement(el)} (box ${Math.round(rect.left)}…${Math.round(rect.right)}px, width=${Math.round(rect.width)}px, viewport=${vw}px)`,
            );
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
}

type OverflowState = Awaited<ReturnType<typeof getOverflowState>>;

/**
 * Assert the page does not overflow horizontally at the mobile viewport, on
 * all four signals: html/body scrollWidth, the main RNW ScrollView container
 * (where RNW's overflow-x: hidden clips instead of scrolling), and the
 * contentful-element offender scan. Retries briefly with `toPass` so
 * enter/animation transitions cannot produce transient measurements; on final
 * failure the last error, with the full offender report, is what fails the
 * test.
 */
async function expectNoHorizontalOverflow(page: Page, route: string) {
    await expect(async () => {
        const state: OverflowState = await getOverflowState(page);
        expect(
            state.scanned,
            `${route}: el escáner de overflow no vio ningún elemento renderizado (drift de ruta o selector).`,
        ).toBeGreaterThan(0);
        expect(
            state.mainFound,
            `${route}: el contenedor principal #muro-main-content no existe (drift del layout).`,
        ).toBe(true);
        const offenderHeader = state.offenders.length
            ? `\nElementos con contenido fuera del viewport (o el contenedor principal se desborda): ${state.offenders.join('; ')}`
            : '';
        expect(
            state.offenders,
            `${route}: hay contenido que se sale del viewport a 360px.${offenderHeader}`,
        ).toEqual([]);
        expect(
            state.mainScrollWidth,
            `${route}: #muro-main-content.scrollWidth (${state.mainScrollWidth}) > clientWidth + 1 (${state.mainClientWidth + 1}) a 360px (contenido recortado por el ScrollView).${offenderHeader}`,
        ).toBeLessThanOrEqual(state.mainClientWidth + 1);
        expect(
            state.documentScrollWidth,
            `${route}: document.documentElement.scrollWidth (${state.documentScrollWidth}) > window.innerWidth + 1 (${state.innerWidth + 1}) a 360px.${offenderHeader}`,
        ).toBeLessThanOrEqual(state.innerWidth + 1);
        expect(
            state.bodyScrollWidth,
            `${route}: document.body.scrollWidth (${state.bodyScrollWidth}) > window.innerWidth + 1 (${state.innerWidth + 1}) a 360px.${offenderHeader}`,
        ).toBeLessThanOrEqual(state.innerWidth + 1);
    }).toPass({ timeout: 10_000, intervals: [250] });
}

/**
 * Collect every interactive element box that is actually rendered and
 * hit-testable: skipping display:none / visibility:hidden / zero-size boxes
 * (they are not touchable) and elements under `pointer-events: none` (their
 * container swallows no taps). Only "innermost" matches are reported (elements
 * that contain no further matched element), so a button and its icon span are
 * not double-counted and containers like a labelled tablist are not treated
 * as tap targets themselves.
 */
function getInteractiveBoxes(page: Page): Promise<InteractiveReport[]> {
    return page.evaluate((sel) => {
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

        function opacityChainProduct(el: Element): number {
            let product = 1;
            for (let node: Element | null = el; node; node = node.parentElement) {
                product *= parseFloat(getComputedStyle(node).opacity) || 0;
                if (product === 0) break;
            }
            return product;
        }

        const all = Array.from(document.querySelectorAll<HTMLElement>(sel));
        const innermost = all.filter((el) => !el.querySelector(sel));
        const results: InteractiveReport[] = [];
        for (const el of innermost) {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') continue;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            results.push({
                name: describeElement(el),
                width: rect.width,
                height: rect.height,
                fontSize: style.fontSize,
                inputType: el instanceof HTMLInputElement ? el.type || 'text' : '',
                opacityProduct: opacityChainProduct(el),
            });
        }
        return results;
    }, INTERACTIVE_SELECTOR);
}

/** Fail naming every interactive element below 24×24 CSS px on this route. */
async function expectTapTargetsAtLeast24(page: Page, route: string) {
    await expect(async () => {
        const boxes = await getInteractiveBoxes(page);
        expect(
            boxes.length,
            `${route}: el escáner de objetivos táctiles no vio ningún elemento interactivo (drift de ruta o selector).`,
        ).toBeGreaterThan(0);
        const tooSmall = boxes
            .filter((box) => box.width < 24 - RECT_EPSILON || box.height < 24 - RECT_EPSILON)
            .map((box) => `${box.name} (${box.width.toFixed(1)}×${box.height.toFixed(1)}px)`);
        expect(
            tooSmall,
            `${route}: elementos interactivos por debajo de 24×24 CSS px (tap targets demasiado pequeños; las unidades C/D deben corregirlos):\n - ${tooSmall.join('\n - ')}`,
        ).toEqual([]);
    }).toPass({ timeout: 10_000, intervals: [250] });
}

/** Visible form controls must render at ≥ 16px or iOS Safari zooms on focus. */
async function expectFormFontSizeAtLeast16(page: Page, route: string) {
    // Only controls a user types into can trigger the iOS focus zoom: a
    // checkbox, radio, range, colour or file input has no text to zoom, so
    // measuring its font-size would fail for a reason that does not exist on a
    // phone. `select` stays in scope: it renders text the user reads and picks.
    const NON_TEXT_INPUT_TYPES = new Set([
        'checkbox',
        'radio',
        'range',
        'color',
        'file',
        'button',
        'submit',
        'reset',
        'image',
    ]);
    await expect(async () => {
        const boxes = await getInteractiveBoxes(page);
        const formControls = boxes.filter(
            (box) =>
                /^(input|select|textarea)([.#[]|$)/.test(box.name) &&
                !NON_TEXT_INPUT_TYPES.has(box.inputType),
        );
        // Anti-vacuity guard: with no form open this route holds zero form
        // controls and the check would be a green no-op — the blocker the
        // independent verifier caught. Every caller must have opened its
        // input surfaces first; a guard failure names the drift.
        expect(
            formControls.length,
            `${route}: el escáner de tipografía no vio ningún input/select/textarea (¿la superficie con inputs se abrió de verdad?, ¿el selector de elementos interactivos cambió?).`,
        ).toBeGreaterThan(0);
        const offenders = formControls
            .filter((box) => parseFloat(box.fontSize) < 16)
            .map((box) => `${box.name} (fontSize=${box.fontSize})`);
        expect(
            offenders,
            `${route}: hay form controls con font-size < 16px (iOS Safari hace zoom de página al enfocar):\n - ${offenders.join('\n - ')}`,
        ).toEqual([]);
    }).toPass({ timeout: 10_000, intervals: [250] });
}

/**
 * One primary action by accessible name must be ≥ 44×44. The labels are the
 * real Spanish accessibilityLabels verified in the code: the mobile dock tabs
 * (`ResponsiveLayout.tsx`: 'Mis deseos' / 'Mis grupos' / 'Mi perfil'), the wish
 * FAB and the wish form save (`WishListTab.tsx`: 'Nuevo deseo' / 'Guardar deseo').
 */
async function expectPrimaryActionAtLeast44(route: string, label: string, locator: Locator) {
    const count = await locator.count();
    expect(
        count,
        `${route}: acción primaria «${label}» (role=button, name=${label}) no encontrada (drift de ruta o de etiqueta).`,
    ).toBeGreaterThan(0);
    const box = await locator.first().boundingBox();
    expect(
        box,
        `${route}: acción primaria «${label}» no visible/encontrada (role=button, name=${label}).`,
    ).not.toBeNull();
    // The numeric comparison, explicit so the failure names the measured axis.
    expect(
        box!.width,
        `${route}: la acción primaria «${label}» mide ${box!.width.toFixed(1)}px de ancho; debe ser ≥ 44.`,
    ).toBeGreaterThanOrEqual(44 - RECT_EPSILON);
    expect(
        box!.height,
        `${route}: la acción primaria «${label}» mide ${box!.height.toFixed(1)}px de alto; debe ser ≥ 44.`,
    ).toBeGreaterThanOrEqual(44 - RECT_EPSILON);
}

/**
 * Truncation state of a text that is clamped with `numberOfLines={1}`
 * (`ellipsizeMode="tail"`, e.g. the group-card name in `GroupCard.tsx:161-165`).
 *
 * A rect scan cannot see this defect: RNW ellipses the text instead of letting
 * it overflow, so nothing sticks out of the viewport, and the fixture name's
 * character count says nothing either (short words still ellipsis in a narrow
 * column). The layout-native truncation signal is:
 *   clamp element (nowrap / text-overflow: ellipsis).scrollWidth > clientWidth
 * which the browser keeps in sync for ANY clamped text — no Range filing or
 * browser-dependent unclipped measurement to second-guess.
 */
function groupNameTruncationState(page: Page, name: string) {
    return page.evaluate((name) => {
        const leaves = Array.from(document.querySelectorAll('*')).filter(
            (el) => el.children.length === 0 && (el.textContent ?? '').trim() === name,
        );
        if (leaves.length === 0) return { found: 0, clampScrollWidth: -1, clampClientWidth: -1, clampHint: '' };
        // The clamp can live on the leaf itself (RNW Text div with
        // overflow:hidden) or on an ancestor: walk the chain until the style
        // that visually truncates the text is found.
        for (let node: Element | null = leaves[0]; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.whiteSpace === 'nowrap' || style.textOverflow === 'ellipsis') {
                return {
                    found: leaves.length,
                    clampScrollWidth: node.scrollWidth,
                    clampClientWidth: node.clientWidth,
                    clampHint: `${node.tagName.toLowerCase()}.${((node.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 3).join('.'))}`,
                };
            }
        }
        return { found: leaves.length, clampScrollWidth: -1, clampClientWidth: -1, clampHint: '' };
    }, name);
}

/**
 * Anchor waits: the same stability observables the existing specs use.
 */
async function waitAppShellLoaded(page: Page, route: '/' | '/?tab=groups' | '/?tab=profile') {
    await page.goto(route);
    const anchor =
        route === '/?tab=groups'
            ? page.getByLabel('Opciones de grupo').first() // proves the groups list with its fixture loads
            : route === '/?tab=profile'
                ? page.getByPlaceholder('Tu nombre') // el formulario de perfil es visible directamente
                : page.getByLabel('Nuevo deseo');
    await expect(anchor).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Cargando/i)).not.toBeVisible();
}

async function gotoGroupDetail(page: Page): Promise<string> {
    const groupId = E2E_CONFIG.group.id;
    await page.goto(`/groups/${groupId}`);
    await expect(page).toHaveURL(new RegExp(`/groups/${groupId}`));
    await expect(page.getByText(E2E_CONFIG.group.name).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Cargando/i)).not.toBeVisible();
    return `/groups/${E2E_CONFIG.group.id}`;
}

test.describe('Diseño móvil a 360px', () => {
    test('no horizontal overflow on the main in-app routes at 360px', async ({ page }) => {
        await waitAppShellLoaded(page, '/');
        await expectNoHorizontalOverflow(page, '/?tab=wishlist');

        await waitAppShellLoaded(page, '/?tab=groups');
        await expectNoHorizontalOverflow(page, '/?tab=groups');

        await waitAppShellLoaded(page, '/?tab=profile');
        await expectNoHorizontalOverflow(page, '/?tab=profile');

        await gotoGroupDetail(page);
        await expectNoHorizontalOverflow(page, `/groups/${E2E_CONFIG.group.id}`);
    });

    test('interactive tap targets are at least 24px on the main in-app routes', async ({ page }) => {
        await waitAppShellLoaded(page, '/');
        await expectTapTargetsAtLeast24(page, '/?tab=wishlist');

        await waitAppShellLoaded(page, '/?tab=groups');
        await expectTapTargetsAtLeast24(page, '/?tab=groups');

        await waitAppShellLoaded(page, '/?tab=profile');
        await expectTapTargetsAtLeast24(page, '/?tab=profile');

        const groupRoute = await gotoGroupDetail(page);
        await expectTapTargetsAtLeast24(page, groupRoute);
    });

    test('primary actions are at least 44px, including the wish form save', async ({ page }) => {
        const dockTabs = [
            'Mis deseos',
            'Mis grupos',
            'Mi perfil',
        ];

        // Home: dock tabs + wish FAB + wish form save button.
        await waitAppShellLoaded(page, '/');
        for (const label of dockTabs) {
            await expectPrimaryActionAtLeast44('/?tab=wishlist', label, page.getByRole('button', { name: label }));
        }
        await expectPrimaryActionAtLeast44('/?tab=wishlist', 'Nuevo deseo', page.getByRole('button', { name: 'Nuevo deseo' }));

        // The wish form save button only exists while the form is open
        // (client state, nothing is written to the database); each test gets
        // its own fresh page context, so no teardown is needed afterwards.
        await page.getByRole('button', { name: 'Nuevo deseo' }).click();
        const saveButton = page.getByRole('button', { name: 'Guardar deseo' });
        await expect(saveButton).toBeVisible({ timeout: 10000 });
        await expectPrimaryActionAtLeast44('/?tab=wishlist', 'Guardar deseo', saveButton);

        // The dock is the primary action surface of the remaining routes.
        await gotoGroupDetail(page);
        for (const label of dockTabs) {
            await expectPrimaryActionAtLeast44(`/groups/${E2E_CONFIG.group.id}`, label, page.getByRole('button', { name: label }));
        }
    });

    test('form controls render at least 16px on every input surface', async ({ page }) => {
        // 1) /?tab=wishlist: open the wish form via the FAB (same flow
        //    wishlist.spec.ts uses) and scan the form's inputs.
        await waitAppShellLoaded(page, '/');
        await page.getByRole('button', { name: 'Nuevo deseo' }).click();
        await expect(page.getByPlaceholder('¿Qué deseas?')).toBeVisible({ timeout: 10000 });
        await expectFormFontSizeAtLeast16(page, '/?tab=wishlist (formulario abierto)');

        // 2) /?tab=profile: the profile form is rendered inline (no modal).
        await waitAppShellLoaded(page, '/?tab=profile');
        await expect(page.getByPlaceholder('Tu nombre')).toBeVisible({ timeout: 10000 });
        await expectFormFontSizeAtLeast16(page, '/?tab=profile');

        // 3) /?tab=groups: open the rename dialog through the group menu, the
        //    same path a user follows (admin fixture user has the menu).
        await waitAppShellLoaded(page, '/?tab=groups');
        await page.getByLabel('Opciones de grupo').first().click();
        await page.getByText('Cambiar nombre', { exact: true }).first().click();
        await expect(page.getByLabel('Nuevo nombre del grupo')).toBeVisible({ timeout: 10000 });
        await expectFormFontSizeAtLeast16(page, '/?tab=groups (renombrar abierto)');

        // 4) Group detail: open the notification settings modal (same flow the
        //    birthday specs use) and scan its input.
        const groupRoute = await gotoGroupDetail(page);
        await page.getByLabel(/Preferencias de notificaciones/).click();
        await expect(page.getByText('Notificaciones del grupo')).toBeVisible();
        await expectFormFontSizeAtLeast16(page, `${groupRoute} (ajustes de notificaciones abiertos)`);

        // 5) /login and /signup: reachable by direct navigation while logged in
        //    (no auth redirect on mount), so the audit's auth-form inputs are
        //    covered without breaking the logged-in storage state.
        await page.goto('/login');
        await expect(page.getByLabel('Correo electrónico')).toBeVisible({ timeout: 10000 });
        await expectFormFontSizeAtLeast16(page, '/login');
        await page.goto('/signup');
        await expect(page.getByLabel('Confirmar contraseña')).toBeVisible({ timeout: 10000 });
        await expectFormFontSizeAtLeast16(page, '/signup');

        // 6) /reset-password: with the authenticated storage state
        //    `supabase.auth.getSession()` resolves a session, so this page renders
        //    its change-password form branch, and the scan covers its two inputs
        //    (new-password / confirm at :146,:162). Nothing is submitted: the
        //    scan is read-only.
        await page.goto('/reset-password');
        // exact: true — 'Contraseña nueva' would otherwise substring-match the
        // second input's label 'Repite la contraseña nueva' too.
        await expect(page.getByLabel('Contraseña nueva', { exact: true })).toBeVisible({ timeout: 10000 });
        await expectFormFontSizeAtLeast16(page, '/reset-password');
    });

    test('group list names are not ellipsised at 360px (C3 detector)', async ({ page }) => {
        await waitAppShellLoaded(page, '/?tab=groups');

        // GroupCard.tsx:161-165 clamps the name with numberOfLines={1} and
        // GroupCard.tsx:183 reserves a fixed `w-[7.25rem]` action column: the
        // bug shows up as truncation, never as overflow, so only a
        // text-vs-clamp-box assertion can catch it.
        const state = await groupNameTruncationState(page, E2E_CONFIG.group.name);
        expect(
            state.found,
            `/?tab=groups: el nombre de grupo «${E2E_CONFIG.group.name}» no está en la lista (drift del fixture o del selector).`,
        ).toBeGreaterThan(0);
        if (state.clampClientWidth === -1) {
            // No element in the chain visually clamps the text: nothing can be
            // truncated under the current architecture. Honest note: if unit
            // C3 changes how the name is handled (removing the clamping
            // style), this lookup deactivates and must be re-written with the
            // new layout — this early-return must never be trusted as a pass
            // signal.
            return;
        }
        expect(
            state.clampScrollWidth,
            `/?tab=groups: el texto del nombre NO cabe en su caja de recorte (${state.clampHint}): scrollWidth=${state.clampScrollWidth} > clientWidth=${state.clampClientWidth} — el nombre se ellipsea a 360px (defecto C3: la columna fija w-[7.25rem] de GroupCard.tsx:183 deja solo ~56–60px de nombre). ROJO esperado contra HEAD: el nombre del fixture («${E2E_CONFIG.group.name}», corto en caracteres pero no en píxeles — ~130–150px de texto a text-xl frente a esa columna); la aritmética es la base de la expectativa y el CI es la prueba empírica.`,
        ).toBeLessThanOrEqual(state.clampClientWidth + 1);
    });

    test('share dialog actions stay within the viewport at 360px (C2 detector)', async ({ page }) => {
        await waitAppShellLoaded(page, '/?tab=groups');

        // Open the share dialog the way a user does: the ↗ button of a group
        // card (`Compartir grupo`, GroupCard.tsx:187) → GroupsTab.tsx:158-161
        // opens the dialog anchored at GroupsTab.tsx:395.
        await page.getByLabel('Compartir grupo').first().click();
        await expect(page.getByText('Invita a tus amigos')).toBeVisible({ timeout: 10000 }); // GroupsTab.tsx:407

        // The failure mode is vertical: TALL dialog content pushes the panel's
        // action buttons below the fold — no horizontal offender can ever
        // report that. With the current fixture the code IS the group id
        // ('E2E001', 6 chars: it renders on ONE line at text-4xl
        // tracking-widest, GroupsTab.tsx:417-420), so per the verification's
        // height budget (~526px of 640) this is a real but not-yet-biteable
        // detector GREEN today; a long invitation code (C2's actual concern)
        // would make it red. The buttons' boxes are measured against the real
        // viewport.
        const vh = await page.evaluate(() => window.innerHeight);
        const actions: [string, Locator][] = [
            ['Compartir enlace', page.getByLabel('Compartir enlace')], // GroupsTab.tsx:425
            ['Cerrar', page.getByLabel('Cerrar')], // GroupsTab.tsx:435
        ];
        for (const [label, locator] of actions) {
            const count = await locator.count();
            expect(
                count,
                `/?tab=groups (share): botón «${label}» no encontrado en el diálogo (drift del diálogo o de etiqueta).`,
            ).toBeGreaterThan(0);
            const box = await locator.first().boundingBox();
            expect(
                box,
                `/?tab=groups (share): botón «${label}» no visible (diálogo roto).`,
            ).not.toBeNull();
            expect(
                box!.y,
                `/?tab=groups (share): el botón «${label}» empieza en y=${box!.y.toFixed(1)} por encima del viewport (0..${vh}); fuera de pantalla no se puede tocar.`,
            ).toBeGreaterThanOrEqual(0);
            expect(
                box!.y + box!.height,
                `/?tab=groups (share): el botón «${label}» termina en y=${(box!.y + box!.height).toFixed(1)} por debajo del viewport (${vh}); su caja debe caber completa a 360×${vh} (defecto C2: un código de invitación largo a text-4xl tracking-widest empuja la interfaz del diálogo fuera del viewport; con el código corto del fixture —'E2E001', una sola línea— hoy cabe y este detector pasa en verde).`,
            ).toBeLessThanOrEqual(vh);
        }
    });

    test('no interactive element is invisible at rest on touch projects', async ({ page }) => {
        // Hover-only affordances (opacity 0 until hover) are legitimate on
        // desktop but trap touch users, whose only "hover" is a tap: this check
        // only applies where `hasTouch` is enabled (Mobile Chrome / Mobile
        // Safari). Skipped — not deleted — for chromium/firefox/webkit.
        test.skip(!test.info().project.use?.hasTouch, 'Solo tiene sentido en proyectos táctiles (hasTouch).');

        const offenders: string[] = [];
        for (const route of ['/' as const]) {
            await waitAppShellLoaded(page, route);
            const boxes = await getInteractiveBoxes(page);
            // Anti-vacuity guard: if the scanner found nothing the route is
            // wrong and the check would silently pass.
            expect(
                boxes.length,
                `${route}: el escáner de opacidad no vio ningún elemento interactivo (drift de ruta o selector).`,
            ).toBeGreaterThan(0);
            offenders.push(...boxes
                .filter((box) => box.opacityProduct === 0)
                .map((box) => `${box.name} (opacityProduct=${box.opacityProduct})`));
        }

        const groupRoute = await gotoGroupDetail(page);
        const groupBoxes = await getInteractiveBoxes(page);
        expect(
            groupBoxes.length,
            `${groupRoute}: el escáner de opacidad no vio ningún elemento interactivo (drift de ruta o selector).`,
        ).toBeGreaterThan(0);
        offenders.push(...groupBoxes
            .filter((box) => box.opacityProduct === 0)
            .map((box) => `${box.name} (opacityProduct=${box.opacityProduct})`));

        expect(
            offenders,
            `Elementos interactivos invisibles en reposo (opacity 0 en el elemento o en la cadena de ancestros): en táctil el usuario no tiene hover, solo toques:\n - ${offenders.join('\n - ')}`,
        ).toEqual([]);
    });
});
