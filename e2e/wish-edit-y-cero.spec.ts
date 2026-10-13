import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './supabase-admin';
import { E2E_CONFIG } from './config';

/**
 * Dos huecos de cobertura que la revisión del corte de app señaló y quedaron declarados:
 * **editar** un deseo —el E2E solo probaba crear— y el **cero en el modal**, que estaba
 * probado en la tarjeta pero no en el detalle.
 *
 * El segundo importa más de lo que parece: el defecto que se cerró en el corte del precio
 * fue **exactamente** ese. Con un número, `0` es falso, así que una comprobación de
 * veracidad escondía un precio real de 0 € detrás de «Sin precio».
 */

const creados: string[] = [];

test.afterEach(async () => {
    for (const id of creados) {
        await supabaseAdmin.from('wishlist_items').delete().eq('id', id);
    }
    creados.length = 0;
});

async function idDeUsuario(email: string): Promise<string> {
    // `data` es un objeto con `users` dentro: `{ data: { users } }`.
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 0, perPage: 100 });
    const user = users.find((u) => u.email === email);
    if (!user?.id) throw new Error(`No se encontró el usuario ${email}`);
    return user.id;
}

async function sembrarDeseo(userId: string, extra: Record<string, unknown>) {
    const { data, error } = await supabaseAdmin
        .from('wishlist_items')
        .insert({
            user_id: userId,
            title: `Deseo de prueba ${Date.now()}`,
            price_numeric: 10,
            notes: '',
            links: [],
            image_url: null,
            priority: 'medium',
            ...extra,
        })
        .select('id, title')
        .single();

    if (error || !data) throw new Error(`No se pudo sembrar el deseo: ${error?.message ?? 'sin datos'}`);
    creados.push(data.id);
    return data as { id: string; title: string };
}

test.describe('Editar un deseo y el cero en el modal', () => {
    test.setTimeout(90000);

    test('editar un deseo envía el precio nuevo y lo deja pintado', async ({ page }) => {
        const userId = await idDeUsuario(E2E_CONFIG.user.email);
        const deseo = await sembrarDeseo(userId, { price_numeric: 10, notes: 'antes' });

        await page.goto('/?tab=wishlist');
        await expect(page.getByLabel('Nuevo deseo')).toBeVisible({ timeout: 20000 });

        // En la lista propia, abrir la tarjeta abre el formulario **en modo edición**.
        await page.getByText(deseo.title, { exact: true }).first().click();
        await expect(page.getByPlaceholder('¿Qué deseas?')).toBeVisible();
        await expect(page.getByPlaceholder('¿Qué deseas?')).toHaveValue(deseo.title);

        await page.getByPlaceholder('0,00').fill('25,50');
        await page.getByPlaceholder('Talla, color, detalles...').fill('después');

        // Se mira lo que la app **envía**, no lo que devuelve el servidor: una edición es
        // un `PATCH` con el objeto completo.
        const peticion = page.waitForRequest(
            (r) => ['PATCH', 'PUT'].includes(r.method()) && r.url().includes('wishlist_items')
        );
        await page.getByText('Guardar', { exact: true }).last().click();

        const payload = (await peticion).postDataJSON();
        expect(payload.price_numeric, 'el precio editado no viaja en el cuerpo').toBe(25.5);
        expect(payload.notes, 'las notas editadas no viajan en el cuerpo').toBe('después');

        // Y queda pintado en la tarjeta, que es lo que ve el usuario.
        await expect(page.getByText('25,50 €').first()).toBeVisible({ timeout: 10000 });
    });

    test('un precio de 0 se pinta 0,00 € en el modal, no «Sin precio»', async ({ page }) => {
        const amigo = await idDeUsuario(E2E_CONFIG.secondaryUser.email);
        // El único deseo de la lista con precio 0 es este, así que el `0,00 €` que se
        // afirme solo puede venir de él.
        const deseo = await sembrarDeseo(amigo, { price_numeric: 0 });

        // La lista de otro miembro se abre desde el grupo, como en los demás E2E.
        await page.goto(`/groups/${E2E_CONFIG.group.id}`);
        await page.getByText(E2E_CONFIG.secondaryUser.displayName).first().click();
        await expect(
            page.getByText(`Lista de ${E2E_CONFIG.secondaryUser.displayName}`)
        ).toBeVisible({ timeout: 15000 });

        await page.getByText(deseo.title, { exact: true }).first().click();

        // La aserción va **acotada al modal** a propósito: el `0,00 €` también lo pinta la
        // tarjeta, así que un `.first()` sin acotar podría estar mirando la tarjeta y pasar
        // aunque el detalle dijera «Sin precio», que es justo el defecto que se cubre aquí.
        const modal = page.getByTestId('wish-detail-modal');
        await expect(modal).toBeVisible({ timeout: 10000 });
        await expect(modal.getByText('0,00 €')).toBeVisible();
        await expect(modal.getByText('Sin precio')).not.toBeVisible();
    });
});
