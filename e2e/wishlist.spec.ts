import { test, expect } from '@playwright/test';
const createdIds = new Set<string>();

test.describe('Funcionalidad de Lista de Deseos', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Navegar directamente a la pestaña de deseos
        await page.goto('/?tab=wishlist');

        // Esperar a que la sesión esté lista
        await expect(page.getByRole('button', { name: /Cerrar sesión/i }).first()).toBeVisible({ timeout: 15000 });

        // Esperar a que termine de cargar el spinner si existe
        await expect(page.getByText(/Cargando/i)).not.toBeVisible();

        // Verificar que estamos en la vista de lista
        await expect(page.getByRole('heading', { name: /Mi lista de deseos/i })).toBeVisible();
    });

    test.afterEach(async ({ request }) => {
        for (const id of createdIds) {
            console.log(`🧹 [Limpieza] Borrando deseo ID: ${id}`);
            const response = await request.delete(`http://localhost:3000/api/wishlist/${id}`);
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
        await expect(page.getByRole('heading', { name: 'Nuevo deseo' })).toBeVisible();

        await page.getByPlaceholder('¿Qué deseas?').fill(testItem.title);
        await page.getByPlaceholder('Ej: 25.00').fill(testItem.price);
        await page.getByPlaceholder('Talla, color, detalles...').fill(testItem.notes);
        await page.getByPlaceholder('Pegar URL de imagen...').fill(testItem.imageUrl);
        await page.locator('select').selectOption({ label: testItem.priority });

        // Interceptar respuesta para sacar el ID (PostgREST de Supabase)
        const responsePromise = page.waitForResponse(r =>
            r.request().method() === 'POST' &&
            r.url().includes('wishlist_items') &&
            r.status() === 201
        );
        await page.getByRole('button', { name: 'Guardar', exact: true }).click();
        const response = await responsePromise;
        const body = await response.json();
        if (body.id) createdIds.add(body.id);

        // Esperar a que el modal se cierre
        await expect(page.getByRole('heading', { name: 'Nuevo deseo' })).not.toBeVisible();

        // Verificar que aparece en la lista
        const card1 = page.locator('.group.relative').filter({ hasText: testItem.title }).first();
        await expect(card1).toBeVisible();
        await expect(card1).toContainText(`${testItem.price} €`);
        await expect(card1.locator('span').filter({ hasText: /^Alta$/ })).toBeVisible();

        // --- 2. Crear Segundo Item (para probar ordenación) ---
        await page.getByLabel('Nuevo deseo').click();
        await page.getByPlaceholder('¿Qué deseas?').fill(anotherItem.title);
        await page.getByPlaceholder('Ej: 25.00').fill(anotherItem.price);
        await page.locator('select').selectOption({ label: anotherItem.priority });

        const responsePromise2 = page.waitForResponse(r =>
            r.request().method() === 'POST' &&
            r.url().includes('wishlist_items') &&
            r.status() === 201
        );
        await page.getByRole('button', { name: 'Guardar', exact: true }).click();
        const response2 = await responsePromise2;
        const body2 = await response2.json();
        if (body2.id) createdIds.add(body2.id);

        await expect(page.getByRole('heading', { name: 'Nuevo deseo' })).not.toBeVisible();

        // --- 3. Probar Ordenación por Nombre ---
        await page.getByRole('button', { name: 'Por nombre' }).click();
        // El que empieza por "A-Z" debe ser el primero entre los nuestros (filtrando por timestamp para ignorar seed)
        await expect(page.locator('.group.relative h3').filter({ hasText: timestamp.toString() }).first())
            .toHaveText(anotherItem.title);

        // --- 4. Probar Ordenación por Precio ---
        await page.getByRole('button', { name: 'Por precio' }).click();
        // El de 10.00 debe aparecer antes que el de 99.99 entre los nuestros
        await expect(page.locator('.group.relative').filter({ hasText: timestamp.toString() }).first())
            .toContainText('10.00');

        // --- 5. Probar Ordenación por Prioridad ---
        await page.getByRole('button', { name: 'Por prioridad' }).click();
        // El de prioridad "Alta" debe ser el primero de nuestros dos items
        const firstAmongOurs = page.locator('.group.relative').filter({ hasText: timestamp.toString() }).first();
        await expect(firstAmongOurs.locator('span').filter({ hasText: /^Alta$/ })).toBeVisible();

        // --- 6. Eliminar los items creados ---
        // Eliminar primero
        await card1.click();

        // Esperar a que el modal de edición esté abierto
        await expect(page.getByRole('heading', { name: 'Editar deseo' })).toBeVisible();
        await page.waitForTimeout(500);

        // Clic en eliminar y luego confirmar en el modal personalizado
        const deleteBtn1 = page.getByLabel('Eliminar deseo');
        await deleteBtn1.click();

        // Interaction with ConfirmModal
        const confirmBtn = page.getByRole('button', { name: 'Confirmar' });
        await expect(confirmBtn).toBeVisible();
        await confirmBtn.click();

        await expect(page.getByText(testItem.title)).not.toBeVisible();

        // Eliminar segundo
        const card2 = page.locator('.group.relative').filter({ hasText: anotherItem.title }).first();
        await card2.click();

        await expect(page.getByRole('heading', { name: 'Editar deseo' })).toBeVisible();
        await page.waitForTimeout(500);

        const deleteBtn2 = page.getByLabel('Eliminar deseo');
        await deleteBtn2.click();

        await page.getByRole('button', { name: 'Confirmar' }).click();

        await expect(page.getByText(anotherItem.title)).not.toBeVisible();
    });

    test('debe validar las entradas del formulario', async ({ page }) => {
        await page.getByLabel('Nuevo deseo').click();
        await page.getByRole('button', { name: 'Guardar', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Nuevo deseo' })).toBeVisible();
    });
});
