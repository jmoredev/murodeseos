import { test, expect, type Page } from '@playwright/test';
import { supabaseAdmin } from './supabase-admin';
import { E2E_CONFIG } from './config';

/**
 * Alturas iguales en la rejilla de tarjetas.
 *
 * El propietario pidió que todas midan lo mismo, «aunque no tengan descripción». Y esto
 * se **mide**, no se mira, por dos motivos:
 *
 *  1. El contenedor tenía que ser **una rejilla de verdad** (`display: grid` con filas
 *     `1fr`): el proyecto **no usaba `grid` en ningún sitio**, así que darlo por hecho
 *     sería suponer dónde está la evidencia. Si nativewind no emite el `display: grid`,
 *     la primera aserción lo dice.
 *  2. Y con la rejilla puesta, la comprobación de fondo: **todas las tarjetas miden lo
 *     mismo** con y sin descripción, con título corto y largo, y en cada ancho.
 *
 * La lista de otro miembro (`app/wishlist/[id]/index.tsx`) usa la misma rejilla; la
 * cubren los E2E de layout que ya existían, que miden desbordes en esa vista.
 */

const createdIds: string[] = [];

/** El título que el propio código cita como caso de 3 líneas a 360px. */
const TITULO_LARGO = 'Auriculares Sony WH-1000XM5';
const TITULO_CORTO = 'Bolso';
const NOTAS = 'Talla M, color negro, con la funda y el cable originales.';

test.afterEach(async () => {
    for (const id of createdIds) {
        await supabaseAdmin.from('wishlist_items').delete().eq('id', id);
    }
    // Se vacía: si no, la lista crece entre pruebas y la limpieza siguiente vuelve a
    // borrar ids ya borrados (y en un reintento, ids de la corrida anterior).
    createdIds.length = 0;
});

/** Cuatro tarjetas que cubren las cuatro combinaciones que hacían descuadrar la rejilla. */
async function sembrarTarjetas() {
    // `data` es un objeto con `users` dentro, no el array: `{ data: { users } }`. Con
    // `{ data: users }` se obtiene el objeto y `users.find` revienta en ejecución.
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 0, perPage: 100 });
    const user = users.find((u) => u.email === E2E_CONFIG.user.email);
    if (!user?.id) throw new Error(`No se encontró el usuario ${E2E_CONFIG.user.email}`);

    const sello = Date.now();
    const filas = [
        { titulo: TITULO_CORTO, notas: '' },
        { titulo: TITULO_LARGO, notas: '' },
        { titulo: TITULO_CORTO, notas: NOTAS },
        { titulo: TITULO_LARGO, notas: NOTAS },
    ].map((fila, indice) => ({
        user_id: user.id,
        title: `${fila.titulo} ${sello}-${indice}`,
        price_numeric: 10 + indice,
        notes: fila.notas,
        links: [],
        image_url: null,
        priority: 'medium' as const,
    }));

    const { data, error } = await supabaseAdmin.from('wishlist_items').insert(filas).select('id');
    if (error) throw new Error(`No se pudieron sembrar las tarjetas: ${error.message}`);
    createdIds.push(...((data ?? []).map((fila) => fila.id) as string[]));
}

/** El contenedor de las tarjetas es el **padre** de una tarjeta (se quitó el envoltorio). */
async function medirRejilla(page: Page) {
    return page
        .locator('[data-testid^="wishlist-card-"]')
        .first()
        .evaluate((tarjeta) => {
            const contenedor = tarjeta.parentElement;
            if (!contenedor) return null;
            const estilo = getComputedStyle(contenedor);
            return {
                display: estilo.display,
                filas: estilo.gridAutoRows,
                columnas: estilo.gridTemplateColumns,
            };
        });
}

async function medirAlturas(page: Page) {
    return page.locator('[data-testid^="wishlist-card-"]').evaluateAll((tarjetas) =>
        tarjetas.map((tarjeta) => ({
            id: (tarjeta.getAttribute('data-testid') ?? '').slice(0, 26),
            alto: Math.round(tarjeta.getBoundingClientRect().height * 100) / 100,
        }))
    );
}

test.describe('Alturas de las tarjetas', () => {
    test.setTimeout(120000);

    // Un test por ancho, en vez de un bucle dentro de uno: así un fallo dice **en qué
    // ancho** falla, y ninguno depende de que el anterior haya pasado.
    for (const ancho of [360, 1280]) {
        test(`todas miden lo mismo a ${ancho}px, con y sin descripción`, async ({ page }) => {
            await sembrarTarjetas();

            await page.setViewportSize({ width: ancho, height: 900 });
            await page.goto('/?tab=wishlist');
            await expect(page.getByLabel('Nuevo deseo')).toBeVisible({ timeout: 20000 });

            // 1) ¿Es de verdad una rejilla? Este era el riesgo declarado: el proyecto no
            //    usaba `grid` en ningún sitio, así que se comprueba en vez de suponerlo.
            const rejilla = await medirRejilla(page);
            expect(rejilla, 'no se encontró el contenedor de tarjetas').not.toBeNull();
            expect(rejilla?.display, 'el contenedor no es una rejilla').toBe('grid');
            expect(
                rejilla?.filas,
                `las filas no son iguales (grid-auto-rows): ${rejilla?.filas}`
            ).toContain('1fr');

            // 2) Y las alturas, medidas una a una.
            const alturas = await medirAlturas(page);
            const distintas = [...new Set(alturas.map((t) => t.alto))];
            expect(
                distintas.length,
                `hay ${distintas.length} alturas distintas entre ${alturas.length} tarjetas: ` +
                    JSON.stringify(alturas)
            ).toBe(1);

            // Y no es una rejilla de una sola tarjeta, que pasaría por accidente.
            expect(alturas.length, 'faltan tarjetas sembradas').toBeGreaterThanOrEqual(4);
        });
    }
});
