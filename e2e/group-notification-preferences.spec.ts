import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './supabase-admin';

/**
 * Preferencias de aviso por grupo y por usuario.
 *
 * Recorre la interfaz real: abre la configuración del grupo, desactiva un aviso y
 * comprueba que la preferencia se guarda y que la base deja de insertar ese aviso.
 * Al reactivarlo, vuelve a llegar. El filtrado vive en un trigger `BEFORE INSERT`
 * sobre `notifications`, así que se comprueba de punta a punta contra la API real.
 *
 * El grupo es propio de la prueba para no tocar los del seed.
 */

async function getUserIdByEmail(email: string) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 0, perPage: 100 });
    const user = users?.find((u) => u.email === email);
    if (!user?.id) throw new Error(`No se encontró userId para ${email}`);
    return user.id;
}

test.describe('Notificaciones configurables por grupo', () => {
    const groupId = `NTP${Date.now()}`;
    let memberId = ''; // usuario E2E, autenticado por auth.setup.ts
    let actorId = ''; // otro miembro que provoca el aviso

    async function reservedPreferenceEnabled(): Promise<boolean | undefined> {
        const { data } = await supabaseAdmin
            .from('group_notification_preferences')
            .select('enabled')
            .eq('user_id', memberId)
            .eq('group_id', groupId)
            .eq('notification_type', 'wish_reserved')
            .maybeSingle();
        return data?.enabled;
    }

    async function insertReservedNotice() {
        const { error } = await supabaseAdmin.from('notifications').insert({
            user_id: memberId,
            actor_id: actorId,
            group_id: groupId,
            type: 'wish_reserved',
        });
        if (error) throw new Error(`No se pudo insertar el aviso de prueba: ${error.message}`);
    }

    async function reservedNotices(): Promise<number> {
        const { data } = await supabaseAdmin
            .from('notifications')
            .select('id')
            .eq('user_id', memberId)
            .eq('group_id', groupId)
            .eq('type', 'wish_reserved');
        return data?.length ?? 0;
    }

    test.beforeAll(async () => {
        memberId = await getUserIdByEmail('e2e-test@test.com');
        actorId = await getUserIdByEmail('juan@test.com');

        const { error: groupError } = await supabaseAdmin.from('groups').insert({
            id: groupId,
            name: `Grupo prefs ${groupId}`,
            icon: '🔔',
            creator_id: memberId,
        });
        if (groupError) throw new Error(`No se pudo crear el grupo de la prueba: ${groupError.message}`);

        const { error: membersError } = await supabaseAdmin.from('group_members').insert([
            { group_id: groupId, user_id: memberId, role: 'admin' },
            { group_id: groupId, user_id: actorId, role: 'member' },
        ]);
        if (membersError) throw new Error(`No se pudieron crear los miembros: ${membersError.message}`);
    });

    test.afterAll(async () => {
        await supabaseAdmin.from('notifications').delete().eq('group_id', groupId);
        await supabaseAdmin.from('group_notification_preferences').delete().eq('group_id', groupId);
        await supabaseAdmin.from('group_members').delete().eq('group_id', groupId);
        await supabaseAdmin.from('groups').delete().eq('id', groupId);
    });

    test('desactiva un aviso, deja de llegar, y al reactivarlo vuelve', async ({ page }) => {
        await page.goto(`/groups/${groupId}`);
        await expect(page).toHaveURL(new RegExp(`/groups/${groupId}`));

        // Abrir la configuración desde la página del grupo.
        await page.getByLabel(/Preferencias de notificaciones/).click();
        await expect(page.getByText('Notificaciones del grupo')).toBeVisible();

        // Por defecto está activado.
        await expect(page.getByLabel(/Se reserva un deseo: activado/)).toBeVisible();
        await page.getByLabel(/Se reserva un deseo: activado/).click();

        await expect.poll(reservedPreferenceEnabled).toBe(false);
        await expect(page.getByLabel(/Se reserva un deseo: desactivado/)).toBeVisible();

        // Con el aviso desactivado, la base no inserta la fila.
        await insertReservedNotice();
        await expect.poll(reservedNotices).toBe(0);

        // Cerrar y reabrir: la preferencia persiste.
        await page.keyboard.press('Escape');
        await expect(page.getByText('Notificaciones del grupo')).toHaveCount(0);
        await page.getByLabel(/Preferencias de notificaciones/).click();
        await expect(page.getByLabel(/Se reserva un deseo: desactivado/)).toBeVisible();

        // Reactivar: el aviso vuelve a llegar.
        await page.getByLabel(/Se reserva un deseo: desactivado/).click();
        await expect.poll(reservedPreferenceEnabled).toBe(true);

        await insertReservedNotice();
        await expect.poll(reservedNotices).toBe(1);
    });
});
