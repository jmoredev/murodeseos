import { test, expect, type Page } from '@playwright/test';
import { E2E_CONFIG } from './config';
import { supabaseAdmin } from './supabase-admin';

/**
 * Avisos de cumpleaños y onomástico (`feat/cumpleanos-onomastico`).
 *
 * Cubre las tres promesas del plan contra la API real:
 *   1. un aviso de cumpleaños se genera al cargar las notificaciones
 *      (`generate_birthday_reminders`, disparado por el mount de
 *      `NotificationMenu`), con `metadata.event_year` del evento próximo;
 *   2. la antelación de los avisos se guarda por miembro y grupo a través de la
 *      UI (`group_reminder_settings.lead_days`) y GOBIERNA la generación: con
 *      `lead_days` menor que la distancia al evento el RPC no crea el aviso y
 *      al volver dentro de la ventana la fila reaparece (causalidad, no solo
 *      persistencia);
 *   3. desactivar `Cumpleaños` en el grupo suprime el aviso: el filtro vive en
 *      el trigger `BEFORE INSERT` sobre `notifications`, que descarta la fila en
 *      silencio (ausencia de fila también significa "activado").
 *
 * El homenajeado es un usuario de auth creado aquí (el RPC nunca avisa al
 * homenajeado sobre sí mismo) y se borra en el `afterAll`. Cada corrida usa
 * grupos propios porque el dedup es por (destinatario, homenajeado, grupo,
 * tipo) y año del evento: contra una base vieja, un grupo compartido con
 * corridas anteriores ya tendría el aviso insertado.
 *
 * Ojo con el reloj: la fecha de nacimiento se calcula en UTC y el evento queda
 * a 3 días de hoy (margen de sobra dentro de la ventana de `lead_days`), así
 * que un cruce de medianoche UTC entre el reloj del laboratorio y el `now()`
 * del servidor no cambia el evento (la próxima ocurrencia de ese mes+día sigue
 * siendo la misma fecha).
 */

const LEAD_DAYS_TO_SAVE = 5;
// 3 días de distancia: ventana de 5 con 2 días de margen.
const EVENT_OFFSET_DAYS = 3;
// Menor que la distancia al evento: excluye al homenajeado de la ventana.
const LEAD_DAYS_OUT_OF_WINDOW = 1;
const RUN_ID = Date.now();
const groupIdWithReminder = `BDR${RUN_ID}1`;
const groupIdMuted = `BDR${RUN_ID}2`;
const GROUP_IDS = [groupIdWithReminder, groupIdMuted];
const groupNameWithReminder = `Grupo cumpleaños ${groupIdWithReminder}`;
const groupNameMuted = `Grupo cumpleaños ${groupIdMuted}`;
// Correo propio de la corrida: los specs corren compartiendo base.
const honoreeEmail = `cumple-${RUN_ID}@test.com`;
const honoreePassword = 'CumpleE2E123!';
const honoreeName = 'Homenajeado Prueba';

function addUtcDays(day: Date, days: number): Date {
    return new Date(day.getTime() + days * 86400000);
}

function utcToday(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Fecha del evento: hoy (UTC) + 3 días. Es la próxima ocurrencia de su mes+día
 * y es estable aunque el servidor vea otro día: el RPC calcula "próxima
 * ocurrencia" con el año del servidor y ese mes+día del calendario sigue
 * cayendo exactamente en esa fecha. Se evita explícitamente el 29-feb porque
 * el año fijo 1990 no es bisiesto y la insert en `profiles` fallaría.
 */
function plannedEventDate(today: Date): { date: Date; birthDate: string; expectedYear: string } {
    for (let offsetDays = EVENT_OFFSET_DAYS; offsetDays >= 1; offsetDays--) {
        const candidate = addUtcDays(today, offsetDays);
        if (candidate.getUTCMonth() !== 1 || candidate.getUTCDate() !== 29) {
            return {
                date: candidate,
                birthDate: `1990-${String(candidate.getUTCMonth() + 1).padStart(2, '0')}-${String(candidate.getUTCDate()).padStart(2, '0')}`,
                expectedYear: String(candidate.getUTCFullYear()),
            };
        }
    }
    throw new Error('No se pudo elegir una fecha de cumpleaños válida para 1990');
}

const planned = plannedEventDate(utcToday());

async function getUserIdByEmail(email: string) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 0, perPage: 100 });
    const user = users?.find((u) => u.email === email);
    if (!user?.id) throw new Error(`No se encontró userId para ${email}`);
    return user.id;
}

test.describe('Avisos de cumpleaños y onomástico', () => {
    test.describe.configure({ mode: 'serial' });

    let memberId = ''; // usuario E2E, autenticado por auth.setup.ts: el que recibe los avisos
    let honoreeId = ''; // usuario creado aquí: el que cumple años (nunca se avisa a sí mismo)

    async function leadDays(groupId: string): Promise<number | null | undefined> {
        const { data } = await supabaseAdmin
            .from('group_reminder_settings')
            .select('lead_days')
            .eq('user_id', memberId)
            .eq('group_id', groupId)
            .maybeSingle();
        return data?.lead_days;
    }

    async function mutedBirthdayPreferenceEnabled(): Promise<boolean | undefined> {
        const { data } = await supabaseAdmin
            .from('group_notification_preferences')
            .select('enabled')
            .eq('user_id', memberId)
            .eq('group_id', groupIdMuted)
            .eq('notification_type', 'birthday')
            .maybeSingle();
        return data?.enabled;
    }

    /**
     * Guarda la antelación por la UI, igual que un miembro del grupo. Espera el
     * valor ya cargado antes de rellenar: si se rellenara antes de que llegue
     * la fila, el efecto la sobrescribiría con el valor cargado y el botón
     * Guardar seguiría deshabilitado.
     */
    async function setLeadDaysViaUi(page: Page, currentValue: string, newValue: string) {
        await page.getByLabel(/Preferencias de notificaciones/).click();
        await expect(page.getByText('Notificaciones del grupo')).toBeVisible();
        const leadInput = page.getByLabel('Antelación de los avisos (días)');
        await expect(leadInput).toHaveValue(currentValue);
        await leadInput.fill(newValue);
        await page.getByLabel('Guardar antelación de los avisos').click();
        await expect(page.getByText('Guardado.')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByText('Notificaciones del grupo')).toHaveCount(0);
    }

    async function birthdayNotices(groupIds: string[]) {
        const { data, error } = await supabaseAdmin
            .from('notifications')
            .select('id, actor_id, group_id, type, metadata')
            .eq('user_id', memberId)
            .in('group_id', groupIds)
            .eq('type', 'birthday');
        if (error) throw new Error(`No se pudo leer los avisos de cumpleaños: ${error.message}`);
        return data ?? [];
    }

    test.beforeAll(async () => {
        memberId = await getUserIdByEmail(E2E_CONFIG.user.email);

        const created = await supabaseAdmin.auth.admin.createUser({
            email: honoreeEmail,
            password: honoreePassword,
            email_confirm: true,
            // `handle_new_user` copia esto a `profiles.display_name`: es el nombre
            // que verá la UI como actor y el que viaja en la metadata del aviso.
            user_metadata: { display_name: honoreeName },
        });
        honoreeId = created.data.user?.id ?? '';
        if (!honoreeId) throw new Error('No se pudo crear el usuario homenajeado de la prueba');

        // Fecha de nacimiento con ventana holgada dentro de los 5 días del test.
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ birth_date: planned.birthDate })
            .eq('id', honoreeId);
        if (profileError) throw new Error(`No se pudo fijar birth_date: ${profileError.message}`);

        for (const groupId of GROUP_IDS) {
            const { error: groupError } = await supabaseAdmin.from('groups').insert({
                id: groupId,
                name: groupId === groupIdWithReminder ? groupNameWithReminder : groupNameMuted,
                icon: '🎂',
                creator_id: memberId,
            });
            if (groupError) throw new Error(`No se pudo crear el grupo de la prueba: ${groupError.message}`);

            const { error: membersError } = await supabaseAdmin.from('group_members').insert([
                { group_id: groupId, user_id: memberId, role: 'admin' },
                { group_id: groupId, user_id: honoreeId, role: 'member' },
            ]);
            if (membersError) throw new Error(`No se pudieron crear los miembros: ${membersError.message}`);
        }
    });

    test.afterAll(async () => {
        // Orden del suite: descendente por dependencias del esquema (avisos,
        // preferencias, antelación —en cascada con la pertenencia, explícita por
        // si acaso—, pertenencia, grupo).
        await supabaseAdmin.from('notifications').delete().in('group_id', GROUP_IDS);
        await supabaseAdmin.from('group_notification_preferences').delete().in('group_id', GROUP_IDS);
        await supabaseAdmin.from('group_reminder_settings').delete().in('group_id', GROUP_IDS);
        // El homenajeado es propio del test: se limpia birth_date y se borra el
        // usuario. `profiles.id` referencia `auth.users(id)` SIN `on delete
        // cascade` (20260102122206_estructura_inicial.sql), así que la fila de
        // perfil se borra explícitamente ANTES: `deleteUser` sin este paso
        // fallaría con la FK 23503. Los errores se comprueban, no se ignoran.
        if (honoreeId) {
            const { error: birthDateError } = await supabaseAdmin
                .from('profiles')
                .update({ birth_date: null })
                .eq('id', honoreeId);
            if (birthDateError) throw new Error(`No se pudo limpiar birth_date: ${birthDateError.message}`);
            const { error: profileDeleteError } = await supabaseAdmin
                .from('profiles')
                .delete()
                .eq('id', honoreeId);
            if (profileDeleteError) throw new Error(`No se pudo borrar el perfil del homenajeado: ${profileDeleteError.message}`);
            const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(honoreeId);
            if (deleteUserError) throw new Error(`No se pudo borrar el usuario homenajeado: ${deleteUserError.message}`);
        }
        await supabaseAdmin.from('group_members').delete().in('group_id', GROUP_IDS);
        await supabaseAdmin.from('groups').delete().in('id', GROUP_IDS);
    });

    test('guarda la antelación por grupo y el aviso de cumpleaños llega con su doble y su año', async ({ page }) => {
        // Primera carga: el RPC corre con la antelación por defecto (15), mayor
        // que la distancia al evento, así que el aviso existe. Esta pierna solo
        // prueba su existencia y su forma; la causalidad de `lead_days` se
        // prueba justo después.
        await page.goto(`/groups/${groupIdWithReminder}`);
        await expect(page).toHaveURL(new RegExp(`/groups/${groupIdWithReminder}`));

        await expect.poll(async () => (await birthdayNotices([groupIdWithReminder])).length).toBe(1);
        const [notice] = await birthdayNotices([groupIdWithReminder]);
        expect(notice).toEqual(expect.objectContaining({
            actor_id: honoreeId, // el actor es el homenajeado
            group_id: groupIdWithReminder,
            type: 'birthday',
            metadata: expect.objectContaining({
                event_year: planned.expectedYear,
                honoree_id: honoreeId,
                honoree_display_name: honoreeName,
            }),
        }));

        // Guardar 5 por la UI, igual que un miembro del grupo.
        await setLeadDaysViaUi(page, '15', String(LEAD_DAYS_TO_SAVE));

        // La fila de ajustes queda en la base, no solo en la UI.
        await expect.poll(() => leadDays(groupIdWithReminder)).toBe(LEAD_DAYS_TO_SAVE);

        // CAUSALIDAD: borrado el aviso, una antelación menor que la distancia al
        // evento (3 días) debe EXCLUIRLO. Recargar re-dispara el RPC; si la
        // generación ignorara `lead_days`, la fila volvería y este poll fallaría.
        const { error: deleteError } = await supabaseAdmin
            .from('notifications')
            .delete()
            .eq('group_id', groupIdWithReminder);
        if (deleteError) throw new Error(`No se pudieron borrar los avisos del grupo: ${deleteError.message}`);

        await setLeadDaysViaUi(page, String(LEAD_DAYS_TO_SAVE), String(LEAD_DAYS_OUT_OF_WINDOW));

        // Se espera la RESPUESTA del RPC antes de aseverar cero: `expect.poll` es
        // "reintenta hasta acertar", así que una aserción de cero acierta en la
        // primera muestra —antes incluso de que el RPC arranque— y pasaría aunque
        // la generación ignorase `lead_days`. Con la respuesta ya recibida, cero
        // filas solo puede significar que la antelación las excluyó.
        const outOfWindowRpc = page.waitForResponse(
            (response) =>
                response.url().includes('/rest/v1/rpc/generate_birthday_reminders') &&
                response.request().method() === 'POST',
        );
        await page.goto(`/groups/${groupIdWithReminder}`);
        await expect(page).toHaveURL(new RegExp(`/groups/${groupIdWithReminder}`));
        await outOfWindowRpc;
        await expect.poll(async () => (await birthdayNotices([groupIdWithReminder])).length).toBe(0);

        // De vuelta dentro de la ventana (5 > 3): el aviso reaparece.
        await setLeadDaysViaUi(page, String(LEAD_DAYS_OUT_OF_WINDOW), String(LEAD_DAYS_TO_SAVE));

        await page.goto(`/groups/${groupIdWithReminder}`);
        await expect(page).toHaveURL(new RegExp(`/groups/${groupIdWithReminder}`));
        await expect.poll(async () => (await birthdayNotices([groupIdWithReminder])).length).toBe(1);

        // Leg por UI: el homenajeado no tiene avatar, así que el icono se
        // renderiza (lo deliberado: SI lo tuviera, la tarjeta mostraría la
        // imagen, no el emoji, y aquí no se debe asertar el carácter 🎂).
        // El nombre accesible de la tarjeta es su `summary`. El fetch limita a
        // 20 filas (`lib/notification-utils.ts`), pero la fila nueva es la más
        // reciente y ningún otro spec tiene antelación de insertarse más de un
        // puñado de avisos mientras corre: entra de sobra en la lista.
        const birthdaySummary = `${honoreeName} cumple años pronto en ${groupNameWithReminder}`;
        await page.getByLabel('Ver notificaciones').click();
        await expect(page.getByLabel(birthdaySummary)).toBeVisible({ timeout: 15000 });
    });

    test('desactivar Cumpleaños en su grupo suprime el aviso, y solo en ese grupo', async ({ page }) => {
        await page.goto(`/groups/${groupIdMuted}`);
        await expect(page).toHaveURL(new RegExp(`/groups/${groupIdMuted}`));

        // El montaje anterior ya corrió el RPC con la preferencia por defecto
        // (activada): el aviso de ESTE grupo existe. Se apaga por la UI.
        await page.getByLabel(/Preferencias de notificaciones/).click();
        await expect(page.getByText('Notificaciones del grupo')).toBeVisible();
        await page.getByLabel(/Cumpleaños: activado/).click();
        await expect(page.getByLabel(/Cumpleaños: desactivado/)).toBeVisible();

        await expect
            .poll(() => mutedBirthdayPreferenceEnabled())
            .toBe(false);
        await page.keyboard.press('Escape');
        await expect(page.getByText('Notificaciones del grupo')).toHaveCount(0);

        // Limpia las filas creadas con el interruptor aún activo, recarga para
        // re-disparar el RPC y confirma que desactivado ya no inserta nada: el
        // caso negativo de la promesa del plan.
        const { error: deleteError } = await supabaseAdmin
            .from('notifications')
            .delete()
            .eq('group_id', groupIdMuted);
        if (deleteError) throw new Error(`No se pudieron borrar los avisos del grupo: ${deleteError.message}`);

        // Igual que en la pierna de causalidad: se espera la respuesta del RPC
        // antes de aseverar cero, porque `expect.poll` acierta en la primera
        // muestra mientras el RPC aún no ha corrido.
        const mutedRpc = page.waitForResponse(
            (response) =>
                response.url().includes('/rest/v1/rpc/generate_birthday_reminders') &&
                response.request().method() === 'POST',
        );
        await page.goto(`/groups/${groupIdMuted}`);
        await expect(page).toHaveURL(new RegExp(`/groups/${groupIdMuted}`));
        await mutedRpc;
        await expect.poll(async () => (await birthdayNotices([groupIdMuted])).length).toBe(0);

        // Prueba de punta a punta del filtro: la generación directa también la
        // descarta en silencio (el insert no falla, la fila no aparece), igual
        // que hace el spec de preferencias con `wish_reserved`. El error del
        // insert se comprueba y se lanza: sin fila Y sin error, la única
        // explicación es el trigger, así que un insert fallido no puede
        // colarse como un éxito vacío.
        const { error: insertError } = await supabaseAdmin.from('notifications').insert({
            user_id: memberId,
            actor_id: honoreeId,
            group_id: groupIdMuted,
            type: 'birthday',
        });
        if (insertError) throw new Error(`El insert de sonda debería completarse: ${insertError.message}`);
        await expect.poll(async () => (await birthdayNotices([groupIdMuted])).length).toBe(0);
    });
});
