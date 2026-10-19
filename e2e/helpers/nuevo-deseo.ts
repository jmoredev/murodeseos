import { expect, type Page } from '@playwright/test';

/**
 * Abre el formulario de deseo desde el «+» de la lista, siguiendo el camino real del usuario.
 *
 * El «+» (`accessibilityLabel: 'Nuevo deseo'` en `components/WishListTab.tsx`) ya **no** abre el
 * formulario: navega a `/wishlist/add` (`app/wishlist/add/index.tsx`), una pantalla que pregunta
 * por el enlace del producto. `No tengo enlace` deja un borrador vacío y vuelve a
 * `/?tab=wishlist`, donde el formulario se abre solo — es el comportamiento de antes, con un
 * toque más.
 *
 * Vive aquí, y no repetido en cada spec, por dos motivos:
 *
 *  1. El paso intermedio es un detalle de la app que puede volver a cambiar; los specs solo
 *     quieren «el formulario abierto».
 *  2. Las esperas no son opcionales: sin ellas, el `fill` del campo de título corre contra una
 *     pantalla que todavía no es el formulario.
 */

/**
 * Ancla del **formulario**: su campo de título (`WishListTab.tsx`).
 *
 * No se usa el título «Nuevo deseo» como ancla a propósito: la pantalla del enlace **también**
 * lo pinta, así que esa aserción pasaría con el formulario aún cerrado y, cuando ambos están en
 * el documento, el locator sería ambiguo. El placeholder del título solo existe en el formulario.
 */
export const CAMPO_TITULO_DEL_DESEO = '¿Qué deseas?';

/** El botón de la pantalla del enlace que decide «sin enlace»: abre el formulario vacío. */
const BOTON_SIN_ENLACE = 'No tengo enlace';

export async function abrirFormularioDeDeseo(page: Page): Promise<void> {
    await page.getByLabel('Nuevo deseo').click();

    // Primero hay que llegar a la pantalla del enlace. Se espera a su botón, que es lo único
    // que se puede pulsar allí sin escribir nada.
    const sinEnlace = page.getByRole('button', { name: BOTON_SIN_ENLACE });
    await expect(sinEnlace).toBeVisible({ timeout: 20000 });
    await sinEnlace.click();

    // Y ahora el formulario, que se abre solo con el borrador vacío. Hasta que este campo no
    // está visible, cualquier `fill` posterior competiría con la navegación de vuelta.
    await expect(page.getByPlaceholder(CAMPO_TITULO_DEL_DESEO)).toBeVisible({ timeout: 20000 });
}
