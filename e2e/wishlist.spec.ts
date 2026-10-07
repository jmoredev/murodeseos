import { test, expect, type Page } from '@playwright/test';
import { supabaseAdmin } from './supabase-admin';
const createdIds = new Set<string>();

/**
 * Devuelve el índice DOM relativo de la tarjeta de wishlist cuyo texto
 * contiene `title`, o -1 si no se encuentra. Se basa en el orden del DOM
 * (no en geometría) para que la comparación sea estable en cualquier layout responsivo.
 */
async function getCardIndex(page: Page, title: string): Promise<number> {
    return page
        .locator('[data-testid^="wishlist-card-"]')
        .evaluateAll((cards, t) =>
            cards.findIndex((c) => (c.textContent ?? '').includes(t)),
        title);
}

test.describe('Funcionalidad de Lista de Deseos', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Navegar directamente a la pestaña de deseos
        await page.goto('/?tab=wishlist');

        // Esperar a que la vista de wishlist esté lista.
        // En RN Web el texto del logout no siempre es consistente entre viewports,
        // así que validamos por un elemento estable de la pantalla.
        await expect(page.getByLabel('Nuevo deseo')).toBeVisible({ timeout: 15000 });

        // Esperar a que termine de cargar el spinner si existe
        await expect(page.getByText(/Cargando/i)).not.toBeVisible();

        // Verificar que estamos en la vista de lista (en RN Web suele no haber "heading" por roles)
        await expect(page.getByLabel('Nuevo deseo')).toBeVisible();
    });

    test.afterEach(async () => {
        for (const id of createdIds) {
            console.log(`🧹 [Limpieza] Borrando deseo ID: ${id}`);
            const { error } = await supabaseAdmin
                .from('wishlist_items')
                .delete()
                .eq('id', id);
            if (error) {
                console.error(`🔴 Error al borrar deseo ${id}: ${error.message}`);
            } else {
                console.log(`✅ [Limpieza] Deseo ${id} borrado vía Supabase`);
            }
        }
        createdIds.clear();
    });

    test('debe crear, ver, ordenar y eliminar un deseo con imagen y prioridad', async ({ page }) => {
        const timestamp = Date.now();
        const testItem = {
            title: `Deseo E2E ${timestamp}`,
            price: '99.99',
            notes: 'Este es un deseo de prueba con imagen y prioridad alta',
            link: 'https://example.com/producto-e2e',
            imageUrl: 'https://placehold.co/600x400/png',
            priority: 'Alta'
        };

        const anotherItem = {
            title: `A-Z Item Especial ${timestamp}`,
            price: '10.00',
            priority: 'Baja'
        };

        // --- 1. Crear Primer Item ---
        await page.getByLabel('Nuevo deseo').click();
        await expect(page.getByPlaceholder('¿Qué deseas?')).toBeVisible();

        await page.getByPlaceholder('¿Qué deseas?').fill(testItem.title);
        await page.getByPlaceholder('0,00').fill(testItem.price);
        await page.getByPlaceholder('https://tienda.com/articulo').fill(testItem.link);
        await page.getByPlaceholder('Talla, color, detalles...').fill(testItem.notes);
        await page.getByPlaceholder('URL de la foto (opcional)').fill(testItem.imageUrl);
        await page.getByText(testItem.priority, { exact: true }).first().click();

        // Interceptar respuesta para sacar el ID (PostgREST de Supabase)
        const responsePromise = page.waitForResponse(r =>
            r.request().method() === 'POST' &&
            r.url().includes('wishlist_items') &&
            r.status() === 201
        );
        await page.getByText('Guardar', { exact: true }).last().click();
        const response = await responsePromise;
        const body = await response.json();
        if (body.id) createdIds.add(body.id);

        // Esperar a que el modal se cierre
        await expect(page.getByPlaceholder('¿Qué deseas?')).not.toBeVisible();

        // Verificar que aparece en la lista (anclado por título único)
        const title1 = page.getByText(testItem.title, { exact: true }).first();
        await expect(title1).toBeVisible();
        // El precio se guarda como texto `10.00` pero la app lo pinta con coma
        // decimal (`10,00 €`): `lib/format-price.ts`, formato español.
        await expect(page.getByText(`${testItem.price.replace('.', ',')} €`).first()).toBeVisible();
        await expect(page.getByText(/Prioridad Alta/i).first()).toBeVisible();
        await expect(page.getByRole('link', { name: /example\.com/i }).first()).toBeVisible();

        // --- 2. Crear Segundo Item (para probar ordenación) ---
        await page.getByLabel('Nuevo deseo').click();
        await page.getByPlaceholder('¿Qué deseas?').fill(anotherItem.title);
        await page.getByPlaceholder('0,00').fill(anotherItem.price);
        await page.getByText(anotherItem.priority, { exact: true }).first().click();

        const responsePromise2 = page.waitForResponse(r =>
            r.request().method() === 'POST' &&
            r.url().includes('wishlist_items') &&
            r.status() === 201
        );
        await page.getByText('Guardar', { exact: true }).last().click();
        const response2 = await responsePromise2;
        const body2 = await response2.json();
        if (body2.id) createdIds.add(body2.id);

        await expect(page.getByPlaceholder('¿Qué deseas?')).not.toBeVisible();

        // --- 3. Probar Ordenación por Nombre ---
        // Se compara el ORDEN RELATIVO EN EL DOM (no la posición geométrica):
        // el mosaico de 4 columnas del Desktop Chrome pone ambas tarjetas en la misma fila.
        // Las etiquetas de accesibilidad del selector de orden son estables
        // en cualquier viewport (el copy visible «Por …» solo existe en escritorio).
        await page.getByLabel('Ordenar por nombre').click();
        // La reordenación es asíncrona: se espera con una expectativa acotada, no con un sleep fijo.
        await expect
            .poll(async () => {
                const anotherIdx = await getCardIndex(page, anotherItem.title);
                const testIdx = await getCardIndex(page, testItem.title);
                // Ambas tarjetas deben existir: un índice -1 falla como tarjeta faltante.
                expect(anotherIdx, `Tarjeta "${anotherItem.title}" no encontrada en el DOM`).toBeGreaterThanOrEqual(0);
                expect(testIdx, `Tarjeta "${testItem.title}" no encontrada en el DOM`).toBeGreaterThanOrEqual(0);
                return anotherIdx < testIdx;
            })
            .toBe(true);

        // --- 4. Probar Ordenación por Precio ---
        await page.getByLabel('Ordenar por precio').click();
        await expect
            .poll(async () => {
                const anotherIdx = await getCardIndex(page, anotherItem.title);
                const testIdx = await getCardIndex(page, testItem.title);
                expect(anotherIdx, `Tarjeta "${anotherItem.title}" no encontrada en el DOM`).toBeGreaterThanOrEqual(0);
                expect(testIdx, `Tarjeta "${testItem.title}" no encontrada en el DOM`).toBeGreaterThanOrEqual(0);
                return anotherIdx < testIdx;
            })
            .toBe(true);

        // --- 5. Probar Ordenación por Prioridad ---
        await page.getByLabel('Ordenar por prioridad').click();
        // "Alta" (testItem) debe quedar antes en el DOM que "Baja" (anotherItem)
        await expect
            .poll(async () => {
                const anotherIdx = await getCardIndex(page, anotherItem.title);
                const testIdx = await getCardIndex(page, testItem.title);
                expect(anotherIdx, `Tarjeta "${anotherItem.title}" no encontrada en el DOM`).toBeGreaterThanOrEqual(0);
                expect(testIdx, `Tarjeta "${testItem.title}" no encontrada en el DOM`).toBeGreaterThanOrEqual(0);
                return testIdx < anotherIdx;
            })
            .toBe(true);

        // --- 6. Eliminar los items creados ---
        // Eliminar primero
        await page.getByText(testItem.title, { exact: true }).first().click();

        // Esperar a que el modal de edición esté abierto
        await expect(page.getByPlaceholder('¿Qué deseas?')).toBeVisible();
        await page.waitForTimeout(500);

        // Clic en eliminar y luego confirmar en el modal personalizado
        const deleteBtn1 = page.getByLabel('Eliminar deseo');
        await deleteBtn1.click();

        // Interaction with ConfirmModal
        const confirmBtn = page.getByRole('button', { name: 'Eliminar' });
        await expect(confirmBtn).toBeVisible();
        await confirmBtn.click();

        await expect(page.getByText(testItem.title)).not.toBeVisible();

        // Eliminar segundo
        await page.getByText(anotherItem.title, { exact: true }).first().click();

        await expect(page.getByPlaceholder('¿Qué deseas?')).toBeVisible();
        await page.waitForTimeout(500);

        const deleteBtn2 = page.getByLabel('Eliminar deseo');
        await deleteBtn2.click();

        await page.getByRole('button', { name: 'Eliminar' }).click();

        await expect(page.getByText(anotherItem.title)).not.toBeVisible();
    });

    test('debe validar las entradas del formulario', async ({ page }) => {
        await page.getByLabel('Nuevo deseo').click();
        await page.getByText('Guardar', { exact: true }).last().click();
        await expect(page.getByPlaceholder('¿Qué deseas?')).toBeVisible();
    });
});
