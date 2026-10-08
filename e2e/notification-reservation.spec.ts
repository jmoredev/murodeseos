import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';
import { supabaseAdmin } from './supabase-admin';

/**
 * El aviso `wish_reserved` lo crea un trigger de la base al insertar la reserva
 * (`tr_notify_wish_reserved`, migración 20260929120000). Esta prueba recorre la
 * reserva por la interfaz real y comprueba el aviso en la base: el reservador y
 * el dueño quedan fuera por diseño (sorpresa) y el tercer miembro recibe una
 * única notificación.
 *
 * El grupo es propio de la prueba para no tocar los del seed ni depender de su
 * topología; se crea antes y se borra después.
 */

async function getUserIdByEmail(email: string) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 0, perPage: 100 });
    const user = users?.find((u) => u.email === email);
    if (!user?.id) throw new Error(`No se encontró userId para ${email}`);
    return user.id;
}

test.describe('Aviso al reservar un deseo', () => {
    const groupId = `NT${Date.now()}`;
    let reserverId = ''; // usuario E2E, ya autenticado por auth.setup.ts
    let ownerId = ''; // Ana, dueña del deseo reservado
    let witnessId = ''; // María, tercera miembro que debe recibir el aviso
    let wishId = '';
    const wishTitle = `Aviso de reserva ${Date.now()}`;

    test.beforeAll(async () => {
        reserverId = await getUserIdByEmail(E2E_CONFIG.user.email);
        ownerId = await getUserIdByEmail('ana@test.com');
        witnessId = await getUserIdByEmail('maria@test.com');

        const { error: groupError } = await supabaseAdmin.from('groups').insert({
            id: groupId,
            name: `Grupo avisos ${groupId}`,
            icon: '🔔',
            creator_id: reserverId,
        });
        if (groupError) throw new Error(`No se pudo crear el grupo de la prueba: ${groupError.message}`);

        const { error: membersError } = await supabaseAdmin.from('group_members').insert([
            { group_id: groupId, user_id: reserverId, role: 'admin' },
            { group_id: groupId, user_id: ownerId, role: 'member' },
            { group_id: groupId, user_id: witnessId, role: 'member' },
        ]);
        if (membersError) throw new Error(`No se pudieron crear los miembros: ${membersError.message}`);

        const { data, error } = await supabaseAdmin
            .from('wishlist_items')
            .insert({ user_id: ownerId, title: wishTitle, links: [], priority: 'medium' })
            .select('id')
            .single();
        if (error || !data?.id) throw new Error(`No se pudo crear el deseo: ${error?.message ?? 'sin id'}`);
        wishId = data.id;
    });

    test.afterAll(async () => {
        // Cancelar la reserva antes de borrar el deseo evita el aviso de borrado.
        await supabaseAdmin.from('wishlist_reservations').delete().eq('item_id', wishId);
        await supabaseAdmin.from('notifications').delete().eq('wish_id', wishId);
        await supabaseAdmin.from('wishlist_items').delete().eq('id', wishId);
        await supabaseAdmin.from('group_members').delete().eq('group_id', groupId);
        await supabaseAdmin.from('groups').delete().eq('id', groupId);
    });

    test('avisa al tercer miembro y deja fuera al dueño y al reservador', async ({ page }) => {
        // Navegar por el grupo hasta la lista de la dueña, como un miembro real.
        await page.goto(`/groups/${groupId}`);
        await expect(page).toHaveURL(new RegExp(`/groups/${groupId}`));
        await page.getByText('Ana López').first().click();
        await expect(page).toHaveURL(/\/wishlist\//);

        const card = page.getByTestId(`wishlist-card-${wishId}`);
        await expect(card).toBeVisible({ timeout: 15000 });
        await card.getByTestId('wish-reserve-button').click();
        await expect(page.getByText('Regalo reservado')).toBeVisible({ timeout: 10000 });

        // El aviso vive en la base: el cliente no inserta esta fila.
        const { data: notifications, error } = await supabaseAdmin
            .from('notifications')
            .select('user_id, actor_id, group_id, type')
            .eq('wish_id', wishId);
        expect(error).toBeNull();
        expect(notifications).toEqual([
            { user_id: witnessId, actor_id: reserverId, group_id: groupId, type: 'wish_reserved' },
        ]);
    });
});
