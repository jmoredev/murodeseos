import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: './e2e',
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    /* In CI, add the list reporter so a failing gate prints per-test lines to
       the log: the html reporter alone writes a report to disk and prints
       almost nothing, which would make a CI failure unreadable. */
    reporter: process.env.CI ? [['list'], ['html']] : 'html',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: 'http://127.0.0.1:8081',
        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    /* Configure projects for major browsers */
    projects: [
        // 1. SETUP: Este corre primero y crea el archivo user.json
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
        },
        // 2. TESTS: Corren después del setup
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },

        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },

        {
            name: 'webkit',
            use: {
                ...devices['Desktop Safari'],
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },

        /* Test against mobile viewports. */
        {
            name: 'Mobile Chrome',
            use: {
                ...devices['Pixel 5'],
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'Mobile Safari',
            use: {
                ...devices['iPhone 12'],
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        // IMPORTANTE: no usar "pnpm run web" aquí. pnpm mueve el script a su propio
        // grupo de procesos, por lo que el servidor dev escapa del kill(-pid) con el
        // que Playwright limpia el webServer al terminar: queda un huérfano en :8081
        // sosteniendo los pipes de stdio y la corrida se cuelga sin resumen ni código de salida.
        // Lanzar el CLI de Expo directo (node reemplaza al shell de "sh -c") mantiene
        // el proceso dentro del grupo del webServer, que sí es matable.
        command: 'node node_modules/expo/bin/cli start --web',
        url: 'http://127.0.0.1:8081',
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
    },
})
