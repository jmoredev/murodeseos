import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';

// En local el correo lo captura Mailpit (el contenedor se sigue llamando
// `inbucket`, pero el servicio es Mailpit desde hace varias versiones del CLI).
const MAILPIT_URL = process.env.E2E_MAILPIT_URL || 'http://127.0.0.1:54324';

test.describe('Recuperación de contraseña', () => {
    test('pide el enlace y este sale por correo apuntando al sitio', async ({ page, request }) => {
        const latestMessageId = async (): Promise<string> => {
            const response = await request.get(`${MAILPIT_URL}/api/v1/messages`);
            if (!response.ok()) return '';

            const list = await response.json();
            const mine = (list.messages || []).filter((message: any) =>
                (message.To || []).some((to: any) => to.Address === E2E_CONFIG.user.email));

            return mine[0]?.ID ?? '';
        };

        const previousMessageId = await latestMessageId();

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
                const messageId = await latestMessageId();
                if (!messageId || messageId === previousMessageId) return '';

                const message = await (await request.get(`${MAILPIT_URL}/api/v1/message/${messageId}`)).json();
                const body = message.Text || message.HTML || '';
                const match = body.match(/https?:\/\/[^\s"'<>]*\/reset-password[^\s"'<>]*/);

                return match ? match[0] : '';
            }, { timeout: 30000, message: 'no llegó el correo de recuperación con el enlace al sitio' })
            .toContain('/reset-password');
    });
});
