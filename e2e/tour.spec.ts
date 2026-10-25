/**
 * El tour de primer inicio, de punta a punta y en un navegador de verdad (T8, S1 y S4).
 *
 * Lo que se comprueba aquí no lo puede comprobar jsdom: que la cuenta recién registrada acabe en la
 * portada con el tour abierto, que el hueco resaltado y la tarjeta no se pisen (medido con cajas de
 * verdad), que la página de detrás quede inerte sin romper el reparto de altura del `Stack` (riesgo
 * abierto en el Log L10), que Tab no se escape del diálogo, que Escape salte el tour, y que no quede
 * ni un deseo ni una membresía de los datos de ejemplo (S4, decisión D1).
 *
 * La cuenta la crea el propio spec, como `e2e/reset-password.spec.ts` y `scripts/new-user.ts`: se
 * borra y se recrea un usuario **sin** `display_name`, que es exactamente el estado de recién
 * registrado que mira la puerta de entrada de la app. No se usa el `storageState` del proyecto
 * (`playwright/.auth/user.json`) porque ese usuario ya vio el tour: la marca vive en el perfil.
 *
 * Todo lo que se afirma sobre el guion (`TOUR_STEPS`) y sobre los datos de ejemplo (`DEMO_WISHES`,
 * `DEMO_GROUPS`) se lee de la app, no se copia: si mañana cambia el texto, esta prueba sigue
 * hablando del texto que el usuario ve.
 *
 * Al volver de las sub-rutas, el recorrido empuja la portada otra vez, así que la anterior queda
 * montada y oculta (medido al final del guion: tres copias del muro en el documento). Por eso las
 * aserciones de la portada se acotan a lo visible (`filter({ visible: true })`); el número de copias
 * no se fija aquí: es un hallazgo que se reporta, no una conducta que esta prueba apruebe.
 */

import { test, expect, type Page } from '@playwright/test';
import { supabaseAdmin } from './supabase-admin';
import { TOUR_STEPS } from '../lib/tour/steps';
import { DEMO_GROUPS, DEMO_WISHES } from '../lib/tour/demo-data';

// Cada prueba estrena cuenta: el tour sólo se abre con `profiles.tour_completed_at` a NULL (D3).
test.use({ storageState: { cookies: [], origins: [] } });

/** Una caja en píxeles de CSS, como la devuelve `boundingBox()`. */
type Caja = { x: number; y: number; width: number; height: number };

type UsuarioNuevo = {
    id: string;
    email: string;
    password: string;
    nombre: string;
};

const PASSWORD = 'TourE2E123!';

/** ¿Se pisan las dos cajas algo más que el redondeo de un píxel? */
function seSolapan(a: Caja, b: Caja): boolean {
    const ancho = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const alto = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

    return ancho > 1 && alto > 1;
}

/**
 * Crea la cuenta en el estado exacto de recién registrado: existe en `auth` con el correo
 * confirmado y su fila de `profiles` sin nombre.
 *
 * Sin `user_metadata.display_name` a propósito: el trigger `handle_new_user` copia ese metadata al
 * perfil, y vacío es justo lo que hace que la app mande a `/profile/setup` antes del muro.
 */
async function crearUsuarioRecienRegistrado(etiqueta: string): Promise<UsuarioNuevo> {
    const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const email = `tour-${etiqueta}-${sufijo}@test.com`;

    const creado = await supabaseAdmin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
    });

    const id = creado.data.user?.id;
    if (creado.error || !id) {
        throw new Error(`No se pudo crear el usuario del tour: ${creado.error?.message ?? 'sin id'}`);
    }

    return { id, email, password: PASSWORD, nombre: `Tour ${etiqueta} ${sufijo}` };
}

/** Borra la cuenta desechable y lo que cuelgue de ella (misma lista que `scripts/new-user.ts`). */
async function borrarUsuario(user: UsuarioNuevo): Promise<void> {
    // `profiles`, `groups.creator_id` y `wishlist_items.user_id` no tienen `on delete cascade`, así
    // que el borrado del usuario de auth falla si esas filas siguen ahí.
    await supabaseAdmin.from('wishlist_items').delete().eq('user_id', user.id);
    await supabaseAdmin.from('group_members').delete().eq('user_id', user.id);
    await supabaseAdmin.from('groups').delete().eq('creator_id', user.id);
    await supabaseAdmin.from('profiles').delete().eq('id', user.id);
    await supabaseAdmin.auth.admin.deleteUser(user.id);
}

/** Las filas que el usuario tiene en una tabla, contadas con la clave de servicio. */
async function contarFilas(
    tabla: 'wishlist_items' | 'group_members',
    userId: string,
): Promise<number> {
    const { count, error } = await supabaseAdmin
        .from(tabla)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (error) throw new Error(`No se pudo contar ${tabla}: ${error.message}`);

    return count ?? 0;
}

/** `profiles.tour_completed_at`: la marca del tour en el perfil (D2). */
async function marcaDelTour(userId: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('tour_completed_at')
        .eq('id', userId)
        .single();

    if (error) throw new Error(`No se pudo leer profiles.tour_completed_at: ${error.message}`);

    return (data?.tour_completed_at as string | null) ?? null;
}

/**
 * Entra con la cuenta nueva y recorre el alta hasta la portada, que es donde arranca el tour (L8):
 * el recorrido no empieza en `/profile/setup` para no sacar al usuario de la mitad del alta.
 */
async function altaHastaLaPortada(page: Page, user: UsuarioNuevo): Promise<void> {
    await page.goto('/login');
    await page.getByTestId('email-input').fill(user.email);
    await page.getByTestId('password-input').fill(user.password);
    await page.getByTestId('login-button').click();

    await page.waitForURL(/\/profile\/setup/, { timeout: 30000 });
    await page.getByTestId('setup-name-input').fill(user.nombre);
    await page.getByTestId('setup-continue-button').click();
    await page.getByTestId('setup-save-button').click();

    await page.waitForURL((url) => url.pathname === '/', { timeout: 30000 });
}

/**
 * Con el tour fuera, la cuenta nueva estrena el modal de Novedades (Log L4: el tour va primero y el
 * modal espera). Se comprueba que aparece y se cierra, porque su capa tapa las pestañas de debajo.
 */
async function cerrarNovedades(page: Page): Promise<void> {
    const entendido = page.getByRole('button', { name: '¡Entendido!' });

    await expect(entendido, 'el modal de Novedades no esperó al tour (L4)').toBeVisible({
        timeout: 20000,
    });
    await entendido.click();

    // Se afirma que **no se ve**, no que no esté: al volver de las sub-rutas el `Stack` deja
    // montadas las portadas anteriores, así que en el documento puede quedar más de un modal y un
    // `toHaveCount(0)` por texto contaría copias que no ve nadie.
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0);
}

/**
 * Cambia de pestaña por la etiqueta accesible, que es la misma en el dock móvil y en la tablist.
 *
 * Se acota a lo visible porque el `Stack` deja montadas —ocultas— las portadas anteriores cuando el
 * recorrido vuelve de una sub-ruta, y sus elementos siguen contando para un localizador por
 * `aria-label`.
 */
async function abrirPestana(page: Page, nombre: 'Mis deseos' | 'Mis grupos'): Promise<void> {
    await page.getByLabel(nombre, { exact: true }).filter({ visible: true }).click();
}

/** ¿El foco del navegador sigue dentro de la tarjeta del tour? */
async function focoDentroDeLaTarjeta(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const tarjeta = document.querySelector('[data-testid="tour-card"]');
        const activo = document.activeElement;

        return !!tarjeta && !!activo && tarjeta.contains(activo);
    });
}

test.describe('Tour de primer inicio', () => {
    // Tres altas completas por prueba y cinco proyectos de navegador: el presupuesto por defecto
    // (30 s) no llega ni al arranque del servidor de desarrollo.
    test.setTimeout(180_000);

    test('recorre las nueve paradas con datos de ejemplo y no deja nada detrás', async ({ page }) => {
        const user = await crearUsuarioRecienRegistrado('recorrido');

        try {
            await altaHastaLaPortada(page, user);

            const tarjeta = page.getByTestId('tour-card');

            // --- S2: la tarjeta del tour, con la primera página del guion --------------------
            await expect(tarjeta).toBeVisible({ timeout: 30000 });
            await expect(tarjeta).toHaveAttribute('role', 'dialog');
            await expect(tarjeta).toHaveAttribute('aria-modal', 'true');
            await expect(
                tarjeta.getByText(`Paso 1 de ${TOUR_STEPS.length}`),
            ).toBeVisible();
            await expect(tarjeta.getByText('Página 1 de 2')).toBeVisible();
            await expect(tarjeta.getByText(TOUR_STEPS[0].pages[0])).toBeVisible();
            // Los tres controles del diálogo se anuncian por su nombre accesible (S1).
            await expect(page.getByRole('button', { name: 'Saltar el tour' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Siguiente página del tour' })).toBeVisible();

            // --- S2/S7: el hueco resaltado rodea la pestaña y la tarjeta no lo tapa ----------
            const objetivo = page.getByLabel('Mis deseos', { exact: true });
            await expect(objetivo).toBeVisible();

            await expect
                .poll(
                    async () => {
                        const cajaTarjeta = await tarjeta.boundingBox();
                        const cajaObjetivo = await objetivo.boundingBox();
                        const cajaAnillo = await page.getByTestId('tour-ring').boundingBox();

                        if (!cajaTarjeta || !cajaObjetivo || !cajaAnillo) return 'sin medidas';

                        const rodeado =
                            cajaAnillo.x <= cajaObjetivo.x + 1 &&
                            cajaAnillo.y <= cajaObjetivo.y + 1 &&
                            cajaAnillo.x + cajaAnillo.width >=
                                cajaObjetivo.x + cajaObjetivo.width - 1 &&
                            cajaAnillo.y + cajaAnillo.height >=
                                cajaObjetivo.y + cajaObjetivo.height - 1;

                        if (!rodeado) return `el anillo no rodea la pestaña: ${JSON.stringify(cajaAnillo)}`;

                        return seSolapan(cajaTarjeta, cajaObjetivo)
                            ? `la tarjeta tapa el hueco: tarjeta ${JSON.stringify(cajaTarjeta)}, ` +
                                  `pestaña ${JSON.stringify(cajaObjetivo)}`
                            : 'bien';
                    },
                    { timeout: 15000, message: 'la tarjeta del tour no deja ver la zona resaltada' },
                )
                .toBe('bien');

            // --- L10: la página de detrás queda inerte y sigue ocupando el alto de la ventana ----
            const pagina = page.getByTestId('tour-page');
            await expect(pagina).toHaveAttribute('aria-hidden', 'true');
            expect(await pagina.getAttribute('inert')).not.toBeNull();

            const ventana = page.viewportSize();
            const cajaPagina = await pagina.boundingBox();
            expect(ventana).not.toBeNull();
            expect(cajaPagina, 'la página envuelta no tiene caja').not.toBeNull();
            // `tour-page` envuelve la página con `flex: 1`: si perdiera el reparto de altura del
            // `Stack`, la app quedaría a media pantalla y el hueco mediría contra otra caja.
            expect(
                Math.abs(cajaPagina!.height - ventana!.height),
                `la página mide ${cajaPagina!.height}px y la ventana ${ventana!.height}px`,
            ).toBeLessThanOrEqual(1);

            // --- S4: con el tour vivo, la cuenta vacía enseña los deseos de ejemplo -----------
            const deseosDemo = page.getByTestId('tour-demo-wishes').filter({ visible: true });
            await expect(deseosDemo).toBeVisible({ timeout: 20000 });
            await expect(
                page.locator('[data-testid^="wishlist-card-"]').filter({ visible: true }),
            ).toHaveCount(DEMO_WISHES.length);
            for (const deseo of DEMO_WISHES) {
                await expect(deseosDemo).toContainText(deseo.title);
            }

            // --- S3/S4: recorrido completo, parada por parada y página por página -------------
            const indiceGrupos = TOUR_STEPS.findIndex((paso) => paso.id === 'grupos');
            const ultimaPagina = TOUR_STEPS.reduce((total, paso) => total + paso.pages.length, 0);
            const gruposDemo = page.getByTestId('tour-demo-groups').filter({ visible: true });
            let paginaActual = 1;

            for (const [indicePaso, paso] of TOUR_STEPS.entries()) {
                for (const [indicePagina, texto] of paso.pages.entries()) {
                    if (paso.route) {
                        const ruta = paso.route;
                        await expect(page).toHaveURL((url) => url.pathname === ruta, {
                            timeout: 30000,
                        });
                    } else {
                        // Las paradas de pestaña viven en la portada, también al volver de una
                        // sub-ruta (S3).
                        await expect(page).toHaveURL((url) => url.pathname === '/', {
                            timeout: 30000,
                        });
                    }

                    // La tarjeta se desmonta mientras el objetivo de la parada nueva no tiene
                    // medida: aparece cuando la pantalla ya se puede medir.
                    await expect(tarjeta).toBeVisible({ timeout: 30000 });
                    await expect(
                        tarjeta.getByText(`Paso ${indicePaso + 1} de ${TOUR_STEPS.length}`),
                    ).toBeVisible();
                    await expect(
                        tarjeta.getByText(`Página ${indicePagina + 1} de ${paso.pages.length}`),
                    ).toBeVisible();
                    await expect(tarjeta).toContainText(texto);

                    // La parada de los grupos es donde el guion enseña el grupo de bienvenida: un
                    // grupo con tres personas, que sólo existe en la pantalla (S4, D1).
                    if (indicePaso === indiceGrupos) {
                        await expect(gruposDemo).toBeVisible({ timeout: 20000 });
                        await expect(
                            page
                                .getByLabel('Bienvenida, 4 participantes', { exact: true })
                                .filter({ visible: true }),
                        ).toBeVisible();
                        for (const miembro of DEMO_GROUPS[0].members) {
                            await expect(gruposDemo).toContainText(miembro.name);
                        }
                    }

                    if (paginaActual < ultimaPagina) {
                        await page.getByRole('button', { name: 'Siguiente página del tour' }).click();
                    }

                    paginaActual += 1;
                }
            }

            // --- S1/D2: terminar cierra el tour y marca la cuenta ----------------------------
            await page.getByRole('button', { name: 'Terminar el tour' }).click();

            await expect(tarjeta).toHaveCount(0);
            await expect(page.getByTestId('tour-scrim-top')).toHaveCount(0);
            // Al cerrar, la página vuelve a estar disponible: sin esto el usuario se queda con una
            // app que no responde al teclado después del tour.
            await expect(pagina).not.toHaveAttribute('inert');

            await expect
                .poll(() => marcaDelTour(user.id), {
                    timeout: 20000,
                    message: 'el perfil no quedó marcado al terminar el tour (D2)',
                })
                .not.toBeNull();

            // --- S4/D1: los datos de ejemplo se van con el tour, y la cuenta sigue vacía ------
            await cerrarNovedades(page);

            await abrirPestana(page, 'Mis deseos');
            await expect(page.getByTestId('tour-demo-wishes')).toHaveCount(0);
            for (const deseo of DEMO_WISHES) {
                await expect(page.getByText(deseo.title, { exact: true })).toHaveCount(0);
            }
            await expect(
                page.getByText('Tu lista está vacía').filter({ visible: true }),
            ).toBeVisible({ timeout: 20000 });

            await abrirPestana(page, 'Mis grupos');
            await expect(page.getByTestId('tour-demo-groups')).toHaveCount(0);
            await expect(
                page.getByText('No tienes grupos aún').filter({ visible: true }),
            ).toBeVisible({ timeout: 20000 });
            await expect(page.getByText('Bienvenida')).toHaveCount(0);

            // Y nada se escribió: los datos de ejemplo viven en el cliente (D1).
            expect(await contarFilas('wishlist_items', user.id)).toBe(0);
            expect(await contarFilas('group_members', user.id)).toBe(0);
        } finally {
            await borrarUsuario(user);
        }
    });

    test('se puede saltar en la primera página y no vuelve tras recargar', async ({ page }) => {
        const user = await crearUsuarioRecienRegistrado('salto');

        try {
            await altaHastaLaPortada(page, user);

            const tarjeta = page.getByTestId('tour-card');

            // S1: el tour se puede saltar desde la primera página, sin haberlo recorrido.
            await expect(tarjeta).toBeVisible({ timeout: 30000 });
            await expect(
                tarjeta.getByText(`Paso 1 de ${TOUR_STEPS.length}`),
            ).toBeVisible();

            await page.getByRole('button', { name: 'Saltar el tour' }).click();

            // El velo se va con la tarjeta: un tour cerrado no deja la pantalla oscurecida.
            await expect(tarjeta).toHaveCount(0);
            await expect(page.getByTestId('tour-scrim-top')).toHaveCount(0);
            await expect(page.getByTestId('tour-page')).not.toHaveAttribute('inert');

            await expect
                .poll(() => marcaDelTour(user.id), {
                    timeout: 20000,
                    message: 'el perfil no quedó marcado al saltar el tour (D2)',
                })
                .not.toBeNull();

            // S4: saltar en la primera página no deja datos de ejemplo a medias.
            await cerrarNovedades(page);
            await expect(page.getByTestId('tour-demo-wishes')).toHaveCount(0);
            await expect(
                page.getByText('Tu lista está vacía').filter({ visible: true }),
            ).toBeVisible({ timeout: 20000 });
            expect(await contarFilas('wishlist_items', user.id)).toBe(0);
            expect(await contarFilas('group_members', user.id)).toBe(0);

            // S1/D3: al recargar no vuelve. La marca se lee en segundo plano al arrancar, así que
            // se espera a que la portada esté montada y del todo cargada (su lista vacía) y se da
            // un margen acotado antes de afirmar que la tarjeta no apareció.
            await page.reload();
            await expect(
                page.getByText('Tu lista está vacía').filter({ visible: true }),
            ).toBeVisible({ timeout: 30000 });
            await page.waitForTimeout(2000);
            await expect(tarjeta).toHaveCount(0);
            await expect(page.getByTestId('tour-scrim-top')).toHaveCount(0);
            expect(await marcaDelTour(user.id)).not.toBeNull();
        } finally {
            await borrarUsuario(user);
        }
    });

    test('con el teclado: Tab no sale del diálogo y Escape salta el tour', async ({ page }) => {
        const user = await crearUsuarioRecienRegistrado('teclado');

        try {
            await altaHastaLaPortada(page, user);

            const tarjeta = page.getByTestId('tour-card');
            await expect(tarjeta).toBeVisible({ timeout: 30000 });

            // El foco entra en la tarjeta al abrir el tour; desde ahí, Tab recorre sus controles
            // y no se escapa a la página de detrás (`inert`), que es lo que ni jsdom ni un
            // `pointerEvents` pueden garantizar en un navegador de verdad.
            expect(await focoDentroDeLaTarjeta(page), 'el foco no entró en la tarjeta').toBe(true);

            for (let pulsacion = 1; pulsacion <= 5; pulsacion += 1) {
                await page.keyboard.press('Tab');
                expect(
                    await focoDentroDeLaTarjeta(page),
                    `el tabulador ${pulsacion} sacó el foco del diálogo`,
                ).toBe(true);
            }

            // Y hacia atrás tampoco: Mayús+Tab envuelve al último control en vez de salir.
            await page.keyboard.press('Shift+Tab');
            expect(
                await focoDentroDeLaTarjeta(page),
                'Mayús+Tab sacó el foco del diálogo',
            ).toBe(true);

            // S1 con teclado: Escape salta el tour.
            await page.keyboard.press('Escape');
            await expect(tarjeta).toHaveCount(0);
            await expect(page.getByTestId('tour-scrim-top')).toHaveCount(0);

            await expect
                .poll(() => marcaDelTour(user.id), {
                    timeout: 20000,
                    message: 'el perfil no quedó marcado al saltar el tour con Escape (D2)',
                })
                .not.toBeNull();

            await cerrarNovedades(page);
            await expect(page.getByTestId('tour-demo-wishes')).toHaveCount(0);
            await expect(
                page.getByText('Tu lista está vacía').filter({ visible: true }),
            ).toBeVisible({ timeout: 20000 });
            expect(await contarFilas('wishlist_items', user.id)).toBe(0);
            expect(await contarFilas('group_members', user.id)).toBe(0);
        } finally {
            await borrarUsuario(user);
        }
    });
});

/**
 * Lo que el usuario ve del overlay, leído del estilo **calculado**.
 *
 * Se lee el estilo calculado y no el código a propósito: el defecto que persigue esta prueba era
 * invisible en el código, porque las clases de Tailwind estaban escritas y la hoja las tenía — el
 * `Animated.View` de `reanimated` las descartaba al pintar (odd/tasks/tour-ajustes-visuales.md, L2).
 */
type ColoresDelTour = {
    /** Opacidad del relleno de cada trozo del velo que ocupa sitio en pantalla. */
    velos: { id: string; alpha: number }[];
    /** Opacidad del fondo de la tarjeta: 1 es opaca. */
    tarjetaAlpha: number;
    /** Color del anillo que rodea el objetivo. */
    anilloBorde: string;
};

async function coloresDelTour(page: Page): Promise<ColoresDelTour> {
    return page.evaluate(() => {
        /** El alfa de un `background-color`/`border-color` calculado (`rgba(...)` o `rgb(...)`). */
        const alfa = (color: string): number => {
            const partes = /rgba?\(([^)]+)\)/.exec(color)?.[1].split(',').map(Number) ?? [];

            return partes.length >= 4 ? partes[3] : partes.length === 3 ? 1 : 0;
        };

        const trozos = ['top', 'bottom', 'left', 'right'];
        const velos = trozos
            .map((lado) => {
                const nodo = document.querySelector(`[data-testid="tour-scrim-${lado}"]`);
                if (!nodo) return null;

                const caja = nodo.getBoundingClientRect();

                return {
                    id: lado,
                    alpha: alfa(getComputedStyle(nodo).backgroundColor),
                    // Un trozo sin alto o sin ancho no oscurece nada y no se le exige color.
                    visible: caja.width > 1 && caja.height > 1,
                };
            })
            .filter((velo): velo is { id: string; alpha: number; visible: boolean } => velo !== null)
            .filter((velo) => velo.visible)
            .map(({ id, alpha }) => ({ id, alpha }));

        const tarjeta = document.querySelector('[data-testid="tour-card"]');
        const anillo = document.querySelector('[data-testid="tour-ring"]');

        return {
            velos,
            tarjetaAlpha: tarjeta ? alfa(getComputedStyle(tarjeta).backgroundColor) : 0,
            anilloBorde: anillo ? getComputedStyle(anillo).borderTopColor : '',
        };
    });
}

/**
 * El texto de la tarjeta cabe sin desplazar: `scrollHeight` es lo que mide el contenido y
 * `clientHeight` lo que se ve. Un píxel de holgura absorbe el redondeo del navegador.
 */
async function sobraDeAlto(page: Page): Promise<number> {
    return page.evaluate(() => {
        const contenido = document.querySelector('[data-testid="tour-card-content"]');
        if (!contenido) return 0;

        return contenido.scrollHeight - contenido.clientHeight;
    });
}

test.describe('Tour de primer inicio: se lee sin esfuerzo', () => {
    // El velo, la tarjeta y el reparto de páginas se juzgan en el tamaño en que más aprieta: la
    // pantalla de un móvil, que es donde el tour se usa de verdad (mobile-first, S6 del tour).
    test.use({ viewport: { width: 390, height: 844 } });
    test.setTimeout(180_000);

    test('oscurece el resto, la tarjeta es opaca y ninguna página obliga a desplazar', async ({
        page,
    }) => {
        const user = await crearUsuarioRecienRegistrado('legible');

        try {
            await altaHastaLaPortada(page, user);

            const tarjeta = page.getByTestId('tour-card');
            await expect(tarjeta).toBeVisible({ timeout: 30000 });

            const totalPaginas = TOUR_STEPS.reduce((total, paso) => total + paso.pages.length, 0);

            for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
                await expect(tarjeta, `la tarjeta no llegó a la página ${pagina}`).toBeVisible({
                    timeout: 30000,
                });

                // --- S1/S2: el velo oscurece y la tarjeta tiene fondo ------------------
                await expect
                    .poll(async () => (await coloresDelTour(page)).velos.length, {
                        message: `la página ${pagina} no tiene velo`,
                    })
                    .toBeGreaterThan(0);

                const colores = await coloresDelTour(page);

                for (const velo of colores.velos) {
                    expect(
                        velo.alpha,
                        `el velo ${velo.id} no oscurece nada (alfa ${velo.alpha}) en la página ${pagina}`,
                    ).toBeGreaterThanOrEqual(0.5);
                }

                expect(
                    colores.tarjetaAlpha,
                    `la tarjeta no tiene fondo en la página ${pagina}`,
                ).toBe(1);

                // El anillo se veía negro porque el color de marca tampoco se aplicaba.
                expect(
                    colores.anilloBorde,
                    `el anillo salió negro en la página ${pagina}`,
                ).not.toBe('rgb(0, 0, 0)');

                // --- S3: el texto cabe sin desplazar ----------------------------------
                await expect
                    .poll(async () => sobraDeAlto(page), {
                        timeout: 5000,
                        message: `la página ${pagina} del tour obliga a desplazar el texto`,
                    })
                    .toBeLessThanOrEqual(1);

                if (pagina < totalPaginas) {
                    await page.getByRole('button', { name: 'Siguiente página del tour' }).click();
                }
            }

            await page.getByRole('button', { name: 'Terminar el tour' }).click();
            await expect(tarjeta).toHaveCount(0);
        } finally {
            await borrarUsuario(user);
        }
    });
});
