import { test, expect } from '@playwright/test';
import { BASE_URL } from './config';
const createdIds = new Set<string>();

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

    test.afterEach(async ({ request }) => {
        for (const id of createdIds) {
            console.log(`🧹 [Limpieza] Borrando deseo ID: ${id}`);
            const response = await request.delete(`${BASE_URL}/api/wishlist/${id}`);
            if (!response.ok()) {
                console.error(`🔴 Error al borrar deseo ${id}: ${response.status()}`);
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
        await page.getByPlaceholder('0.00').fill(testItem.price);
        await page.getByPlaceholder('Talla, color, detalles...').fill(testItem.notes);
        await page.getByPlaceholder('https://...').fill(testItem.imageUrl);
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
        await expect(page.getByText(`${testItem.price} €`).first()).toBeVisible();
        await expect(page.getByText(/Prioridad Alta/i).first()).toBeVisible();

        // --- 2. Crear Segundo Item (para probar ordenación) ---
        await page.getByLabel('Nuevo deseo').click();
        await page.getByPlaceholder('¿Qué deseas?').fill(anotherItem.title);
        await page.getByPlaceholder('0.00').fill(anotherItem.price);
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
        await page.getByText(/Por Nombre/i).first().click();
        await page.waitForTimeout(300);
        const topTestByName = (await page.getByText(testItem.title, { exact: true }).first().boundingBox())?.y;
        const topAnotherByName = (await page.getByText(anotherItem.title, { exact: true }).first().boundingBox())?.y;
        expect(topTestByName).not.toBeUndefined();
        expect(topAnotherByName).not.toBeUndefined();
        await expect(topAnotherByName!).toBeLessThan(topTestByName!);

        // --- 4. Probar Ordenación por Precio ---
        await page.getByText(/Por Precio/i).first().click();
        await page.waitForTimeout(300);
        const topTestByPrice = (await page.getByText(testItem.title, { exact: true }).first().boundingBox())?.y;
        const topAnotherByPrice = (await page.getByText(anotherItem.title, { exact: true }).first().boundingBox())?.y;
        expect(topTestByPrice).not.toBeUndefined();
        expect(topAnotherByPrice).not.toBeUndefined();
        await expect(topAnotherByPrice!).toBeLessThan(topTestByPrice!);

        // --- 5. Probar Ordenación por Prioridad ---
        await page.getByText(/Por Prioridad/i).first().click();
        await page.waitForTimeout(300);
        const topTestByPriority = (await page.getByText(testItem.title, { exact: true }).first().boundingBox())?.y;
        const topAnotherByPriority = (await page.getByText(anotherItem.title, { exact: true }).first().boundingBox())?.y;
        expect(topTestByPriority).not.toBeUndefined();
        expect(topAnotherByPriority).not.toBeUndefined();
        // "Alta" (testItem) debe quedar arriba
        await expect(topTestByPriority!).toBeLessThan(topAnotherByPriority!);

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
