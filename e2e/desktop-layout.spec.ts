import { test, expect, type Page } from '@playwright/test';
import { E2E_CONFIG } from './config';

/**
 * Guardian de escritorio para el nombre del grupo (`fix/group-name-visible`).
 *
 * Defecto medido (odd/tasks/group-name-visible.md): el grid de la pestaña de
 * grupos daba 3 columnas desde 769px (`w-1/3`), así que cada tarjeta medía
 * ~240px de contenido a 1280px — MÁS ESTRECHA que la tarjeta de un teléfono a
 * 360px (~280px). El chrome fijo de la tarjeta (columna de acciones de 116px,
 * emoji de 56px + margen, lápiz de alias de 44px) consumía todo: la caja del
 * nombre medía **0px** a 1280 y 900, y el contador «N participantes» quedaba
 * recortado (scrollWidth 118 / clientWidth 44). A 360px todo funcionaba, y el
 * único detector que medía esta caja (`groupNameBoxState` en
 * `mobile-layout.spec.ts`) solo corre a 360×640, por eso nada lo cazó.
 *
 * Este fichero fuerza SU PROPIO viewport con `test.use` (igual que
 * `mobile-layout.spec.ts:35` fuerza 360×640): la configuración define los
 * proyectos `chromium`, `firefox`, `webkit`, `Mobile Chrome` y `Mobile
 * Safari`, y el mismo spec corre en todos — la medida no debe depender del
 * proyecto.
 *
 * El proyecto `setup` aporta el storageState autenticado; credenciales y
 * fixture en `e2e/config.ts`. Todo es de solo lectura.
 */

// 1280×720: el mismo ancho del proyecto `chromium`, donde el defecto medía
// cero. Forzado aquí para que la medición sea honesta en cualquier proyecto.
test.use({ viewport: { width: 1280, height: 720 } });

interface TextBoxState {
    found: number;
    hint: string;
    text: string;
    scrollWidth: number;
    clientWidth: number;
    rectWidth: number;
    rectHeight: number;
}

/**
 * Misma disciplina de medición que `groupNameBoxState` en
 * `e2e/mobile-layout.spec.ts` (detector C3): localiza el elemento hoja cuyo
 * texto es exactamente el buscado y mide scrollWidth/clientWidth y el rect.
 * RNW renderiza Text como un div con el texto directamente dentro, así que la
 * hoja con el texto exacto es la propia caja del clamp. Sin dependencia de
 * estilos concretos y sin early-return: si no hay elemento, `found: 0` y la
 * aserción de no-vacuidad falla en voz alta.
 */
async function leafTextBoxState(page: Page, text: string): Promise<TextBoxState> {
    return page.evaluate((name) => {
        const describeElement = (el: Element) =>
            `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '')
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 3)
                .join('.')}`;
        const leaves = Array.from(document.querySelectorAll('*')).filter(
            (el) => el.children.length === 0 && (el.textContent ?? '').trim() === name,
        );
        if (leaves.length === 0) {
            return {
                found: 0,
                hint: '',
                text: '',
                scrollWidth: -1,
                clientWidth: -1,
                rectWidth: 0,
                rectHeight: 0,
            } satisfies TextBoxState;
        }
        const el = leaves[0] as HTMLElement;
        const rect = el.getBoundingClientRect();
        return {
            found: leaves.length,
            hint: describeElement(el),
            text: (el.textContent ?? '').trim(),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            rectWidth: rect.width,
            rectHeight: rect.height,
        } satisfies TextBoxState;
    }, text);
}

/**
 * Estados de TODOS los elementos hoja cuyo texto es «N participantes»
 * (el contador de `GroupCard.tsx`: `{participantCount} participantes`).
 * No se ancla a un número concreto de participantes: el fixture puede
 * cambiar; lo que se vigila es que NINGUNO quede recortado en horizontal.
 */
async function participantCounterStates(page: Page): Promise<TextBoxState[]> {
    return page.evaluate(() => {
        const pattern = /^\d+ participantes$/;
        const leaves = Array.from(document.querySelectorAll('*')).filter(
            (el) => el.children.length === 0 && pattern.test((el.textContent ?? '').trim()),
        );
        return leaves.map((node) => {
            const el = node as HTMLElement;
            const rect = el.getBoundingClientRect();
            return {
                found: leaves.length,
                hint: `div.${(el.getAttribute('class') ?? '')
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 3)
                    .join('.')}`,
                text: (el.textContent ?? '').trim(),
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
                rectWidth: rect.width,
                rectHeight: rect.height,
            } satisfies TextBoxState;
        });
    });
}

async function waitGroupsTabLoaded(page: Page) {
    await page.goto('/?tab=groups');
    // Ancla: la lista de grupos con su fixture cargó (misma señal que
    // `mobile-layout.spec.ts` usa para esta ruta).
    await expect(page.getByLabel('Opciones de grupo').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Cargando/i)).not.toBeVisible();
}

test.describe('Diseño de escritorio a 1280px', () => {
    test('group names and participant counters are not collapsed or truncated on the Groups tab', async ({ page }) => {
        await waitGroupsTabLoaded(page);

        // --- Nombre del grupo (el defecto: caja de anchura 0 en escritorio) ---
        const name = await leafTextBoxState(page, E2E_CONFIG.group.name);
        // No-vacuidad: si no se encontró el nombre, la medición no puede
        // aprobar nada — falla nombrando el drift (repo con dos checks
        // vacíos previos ya eliminados; un detector que no ve, no valida).
        expect(
            name.found,
            `/?tab=groups: el nombre de grupo «${E2E_CONFIG.group.name}» no está en la lista a 1280px (drift del fixture o del selector).`,
        ).toBeGreaterThan(0);
        expect(
            name.text,
            `/?tab=groups: el elemento localizado pinta «${name.text}» y no «${E2E_CONFIG.group.name}» (drift de la medición en ${name.hint}).`,
        ).toBe(E2E_CONFIG.group.name);
        // El defecto: la caja del nombre medía 0px a 1280 y 900 (invisible).
        expect(
            name.rectWidth,
            `/?tab=groups a 1280px: la caja del nombre «${E2E_CONFIG.group.name}» (${name.hint}) mide ${name.rectWidth}px de ancho — colapsada a 0 el nombre es invisible (defecto fix/group-name-visible: el grid a 3 columnas dejaba ~240px de tarjeta, menos que un teléfono).`,
        ).toBeGreaterThan(0);
        expect(
            name.rectHeight,
            `/?tab=groups a 1280px: la caja del nombre (${name.hint}) mide ${name.rectHeight}px de alto — no renderizada o medición ausente.`,
        ).toBeGreaterThan(0);
        // El nombre no debe truncarse en horizontal (scrollWidth > clientWidth
        // = elipse/recorte del texto dentro de su caja).
        expect(
            name.scrollWidth,
            `/?tab=groups a 1280px: el nombre «${E2E_CONFIG.group.name}» NO cabe en su caja (${name.hint}): scrollWidth=${name.scrollWidth} > clientWidth+1=${name.clientWidth + 1} — texto truncado.`,
        ).toBeLessThanOrEqual(name.clientWidth + 1);

        // --- Contador «N participantes» (síntoma hermano del mismosqueeze) ---
        const counters = await participantCounterStates(page);
        expect(
            counters.length,
            '/?tab=groups a 1280px: no se vio ningún contador «N participantes» (drift de GroupCard o del fixture).',
        ).toBeGreaterThan(0);
        const truncated = counters
            .filter((c) => c.scrollWidth > c.clientWidth + 1)
            .map((c) => `«${c.text}» (${c.hint}): scrollWidth=${c.scrollWidth} > clientWidth+1=${c.clientWidth + 1}`);
        expect(
            truncated,
            `/?tab=groups a 1280px: contadores de participantes truncados en horizontal (mismo cuello de botella que el nombre):\n - ${truncated.join('\n - ')}`,
        ).toEqual([]);
    });
});
