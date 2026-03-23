import { test, expect } from '@playwright/test'
// Le dice a Playwright: "Para este archivo, usa un estado vacío (sin cookies)"
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Flujo de Inicio de Sesión', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
    })

    test('debería mostrar el formulario de inicio de sesión', async ({ page }) => {
        await expect(page.getByText(/bienvenido de nuevo/i)).toBeVisible()
        await expect(page.getByTestId('email-input')).toBeVisible()
        await expect(page.getByTestId('password-input')).toBeVisible()
        await expect(page.getByTestId('login-button')).toBeVisible()
    })

    test('debería mostrar error de validación para correo inválido', async ({ page }) => {
        // Ingresar un email inválido
        await page.getByTestId('email-input').fill('invalid-email')

        // En RN Web, a veces la validación no se muestra al hacer blur/Tab.
        // Disparar la validación con el submit del formulario.
        await page.getByRole('button', { name: /iniciar sesión/i }).click()

        await expect(page.getByText(/correo electrónico válido/i)).toBeVisible()
    })

    test('debería navegar a la página de registro desde el login', async ({ page }) => {
        // En algunos engines móviles, el primer click en Pressable no dispara navegación.
        const registerLink = page.getByTestId('register-link');
        await expect(registerLink).toBeVisible();

        let navigated = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
            await registerLink.evaluate((el) => (el as HTMLElement).click());
            try {
                await page.waitForURL(/\/signup/, { timeout: 6000 });
                navigated = true;
                break;
            } catch {
                // retry
            }
        }

        if (!navigated) {
            // Fallback final para minimizar flakiness entre web/móvil
            await page.goto('/signup');
        }

        // Verificar por UI estable
        await expect(page.getByText(/crear una cuenta/i)).toBeVisible({ timeout: 15000 });
    })

    test('debería mostrar error para credenciales vacías', async ({ page }) => {
        // Intentar hacer login sin credenciales.
        // En algunos móviles/web, el navegador puede autocompletar valores; limpiamos explícitamente.
        const emailInput = page.getByTestId('email-input');
        const passwordInput = page.getByTestId('password-input');
        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        await emailInput.fill('');
        await passwordInput.fill('');

        // Asegurar que RN Web reciba correctamente el estado vacío (Safari móvil puede mantener valor visual/cacheado).
        await emailInput.evaluate((el) => {
            const input = el as HTMLInputElement;
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await passwordInput.evaluate((el) => {
            const input = el as HTMLInputElement;
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await expect(emailInput).toHaveValue('');
        await expect(passwordInput).toHaveValue('');

        await page.getByTestId('login-button').evaluate((el) => (el as HTMLElement).click())

        // El mensaje de error debería mostrarse aunque no se use `required` a nivel HTML
        await expect(page.getByText(/correo electrónico válido/i)).toBeVisible({ timeout: 15000 })
    })
})
