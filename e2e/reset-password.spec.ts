import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';
import { createClient } from '@supabase/supabase-js';

// En local el correo lo captura Mailpit (el contenedor se sigue llamando
// `inbucket`, pero el servicio es Mailpit desde hace varias versiones del CLI).
const MAILPIT_URL = process.env.E2E_MAILPIT_URL || 'http://127.0.0.1:54324';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;

const supabaseServiceRoleKey =
    process.env.NEXT_SERVICE_ROLE_KEY ||
    process.env.EXPO_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Faltan env vars para supabaseAdmin en E2E');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

/** Último mensaje de un buzón, como identificador para detectar el nuevo. */
async function latestMessageId(request: any, address: string): Promise<string> {
    const response = await request.get(`${MAILPIT_URL}/api/v1/messages`);
    if (!response.ok()) return '';

    const list = await response.json();
    const mine = (list.messages || []).filter((message: any) =>
        (message.To || []).some((to: any) => to.Address === address));

    return mine[0]?.ID ?? '';
}

/** Cuerpo del mensaje, para sacar el enlace. */
async function messageBody(request: any, id: string): Promise<string> {
    const message = await (await request.get(`${MAILPIT_URL}/api/v1/message/${id}`)).json();

    return message.Text || message.HTML || '';
}

test.describe('Recuperación de contraseña', () => {
    test('pide el enlace y este sale por correo apuntando al sitio', async ({ page, request }) => {
        const previousMessageId = await latestMessageId(request, E2E_CONFIG.user.email);

        await page.goto('/login');
        await page.getByTestId('forgot-password-link').click();
        await page.getByTestId('email-input').fill(E2E_CONFIG.user.email);
        await page.getByTestId('send-recovery-button').click();

        // Mensaje neutro: no revela si el correo tiene cuenta.
        await expect(page.getByTestId('recovery-sent-message')).toBeVisible({ timeout: 15000 });

        // Que el enlace vuelva a `/reset-password` es lo que verifica de verdad el
        // redirect que pide la aplicación; sin él, Supabase usa el Site URL del
        // servidor y el enlace apunta a otro sitio.
        await expect
            .poll(async () => {
                const messageId = await latestMessageId(request, E2E_CONFIG.user.email);
                if (!messageId || messageId === previousMessageId) return '';

                const body = await messageBody(request, messageId);
                const match = body.match(/https?:\/\/[^\s"'<>]*\/reset-password[^\s"'<>]*/);

                return match ? match[0] : '';
            }, { timeout: 30000, message: 'no llegó el correo de recuperación con el enlace al sitio' })
            .toContain('/reset-password');
    });

    test('el enlace del correo permite cambiar la contraseña', async ({ page, request }) => {
        // Usuario desechable: cambiar una contraseña no puede tocar a los usuarios
        // sembrados, que son los que usan los demás specs.
        const email = `recuperacion-${Date.now()}@test.com`;
        const originalPassword = 'Original123!';
        const newPassword = 'NuevaClave456!';

        const created = await supabaseAdmin.auth.admin.createUser({
            email,
            password: originalPassword,
            email_confirm: true,
        });

        const userId = created.data.user?.id;
        expect(userId, 'no se pudo crear el usuario de prueba').toBeTruthy();

        try {
            await page.goto('/login');
            await page.getByTestId('forgot-password-link').click();
            await page.getByTestId('email-input').fill(email);
            await page.getByTestId('send-recovery-button').click();
            await expect(page.getByTestId('recovery-sent-message')).toBeVisible({ timeout: 15000 });

            // El enlace apunta al verificador de GoTrue, que a su vez devuelve al sitio
            // con el código que el navegador canjea (PKCE: el verificador vive en este
            // mismo contexto, así que el recorrido hay que hacerlo en él).
            let verificationLink = '';

            await expect
                .poll(async () => {
                    const messageId = await latestMessageId(request, email);
                    if (!messageId) return '';

                    const body = await messageBody(request, messageId);
                    const match = body.match(/https?:\/\/[^\s"'<>]*\/verify\?[^\s"'<>]+/);

                    verificationLink = match ? match[0] : '';

                    return verificationLink;
                }, { timeout: 30000, message: 'no llegó el correo con el enlace de recuperación' })
                .not.toBe('');

            await page.goto(verificationLink);
            await expect(page).toHaveURL(/\/reset-password/, { timeout: 20000 });

            // El cliente canjea el código al cargar: cuando hay sesión, aparece el formulario.
            await page.getByTestId('new-password-input').fill(newPassword);
            await page.getByTestId('confirm-password-input').fill(newPassword);
            await page.getByTestId('save-password-button').click();

            // La sesión de recuperación ya está iniciada, así que entra directamente.
            await expect(page).toHaveURL(/\/$/, { timeout: 20000 });

            // Y la contraseña nueva es la que vale.
            const signedIn = await supabaseAdmin.auth.signInWithPassword({ email, password: newPassword });
            expect(signedIn.error).toBeNull();
        } finally {
            if (userId) await supabaseAdmin.auth.admin.deleteUser(userId);
        }
    });
});
