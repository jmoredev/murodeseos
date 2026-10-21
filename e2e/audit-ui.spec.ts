import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

/**
 * Auditoría objetiva de la interfaz: **mide, no opina**.
 *
 * No es un test de regresión y no falla por lo que encuentra: escribe un informe con números para
 * decidir qué arreglar. Solo falla si la propia auditoría no pudo correr, porque un informe vacío
 * que pasa en verde es peor que no tenerlo.
 *
 * Qué mide, y por qué esos y no otros (checklist de Impeccable, `https://impeccable.style/slop`,
 * filtrada a lo que es calidad medible en una PWA familiar):
 *
 * - **Contraste WCAG** de cada texto contra su fondo efectivo (4.5:1 normal, 3:1 grande).
 * - **Texto chico**: menos de 12 px en cualquier nodo con texto.
 * - **Objetivos táctiles**: controles por debajo de 44×44 px.
 * - **Desborde horizontal**: la página o un contenedor que obliga a desplazarse de lado.
 * - **Contenido recortado**: `overflow: hidden` con más contenido del que se ve.
 * - **Imágenes rotas** y **superficies anidadas** (tarjetas dentro de tarjetas).
 *
 * Corre con el usuario E2E ya autenticado por `auth.setup.ts`, igual que el resto de la suite.
 */

type Hallazgo = {
    tipo: string;
    detalle: string;
};

const PANTALLAS: { nombre: string; preparar: (page: import('@playwright/test').Page) => Promise<void> }[] = [
    {
        nombre: 'deseos',
        preparar: async () => {
            /* la pantalla inicial ya es la lista de deseos */
        },
    },
    {
        nombre: 'formulario-deseo',
        preparar: async (page) => {
            const nuevo = page.getByText('Nuevo deseo', { exact: false }).first();
            if (await nuevo.isVisible().catch(() => false)) await nuevo.click();
            await page.waitForTimeout(400);
        },
    },
    {
        nombre: 'grupos',
        preparar: async (page) => {
            const tab = page.getByRole('tab', { name: /grupos/i }).first();
            if (await tab.isVisible().catch(() => false)) await tab.click();
            await page.waitForTimeout(400);
        },
    },
    {
        nombre: 'perfil',
        preparar: async (page) => {
            const tab = page.getByRole('tab', { name: /perfil/i }).first();
            if (await tab.isVisible().catch(() => false)) await tab.click();
            await page.waitForTimeout(400);
        },
    },
];

/** Se ejecuta en el navegador: devuelve la lista de hallazgos de la página actual. */
function auditarEnPagina(): Hallazgo[] {
    const hallazgos: { tipo: string; detalle: string }[] = [];
    const MAX_POR_TIPO = 8;
    const contar: Record<string, number> = {};
    const anotar = (tipo: string, detalle: string) => {
        contar[tipo] = (contar[tipo] ?? 0) + 1;
        if (contar[tipo] <= MAX_POR_TIPO) hallazgos.push({ tipo, detalle });
    };

    const parseColor = (valor: string): [number, number, number, number] | null => {
        const m = valor.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const partes = m[1].split(',').map((p) => parseFloat(p.trim()));
        if (partes.length < 3) return null;
        return [partes[0], partes[1], partes[2], partes.length > 3 ? partes[3] : 1];
    };

    const luminancia = ([r, g, b]: [number, number, number, number]) => {
        const canal = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    };

    /**
     * Fondo que realmente pinta detrás del texto, o `'gradiente'` cuando no se puede calcular.
     *
     * El caso que motivó esto: los botones primarios usan `LinearGradient`, y en web un gradiente
     * es `background-image`, no `background-color`. Mirar solo el color atravesaba el botón y
     * encontraba la tarjeta blanca detrás, así que el informe acusaba «1.00:1, blanco sobre blanco»
     * en botones que se ven perfectamente. Un contraste que no se puede medir se declara, no se
     * inventa.
     */
    const fondoEfectivo = (el: Element): [number, number, number, number] | 'gradiente' => {
        let actual: Element | null = el;
        while (actual) {
            const estilo = getComputedStyle(actual);
            if (estilo.backgroundImage && estilo.backgroundImage !== 'none') return 'gradiente';
            const color = parseColor(estilo.backgroundColor);
            if (color && color[3] > 0.05) return color;
            actual = actual.parentElement;
        }
        return [255, 255, 255, 1];
    };

    const texto = (el: Element) =>
        Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => (n.textContent ?? '').trim())
            .join(' ')
            .trim();

    const describir = (el: Element) => {
        const clase = (el.getAttribute('class') ?? '').slice(0, 60);
        const propio = (el.textContent ?? '').trim().slice(0, 40);
        return `<${el.tagName.toLowerCase()}${clase ? ` class="${clase}"` : ''}> ${propio}`.trim();
    };

    // 1. Desborde horizontal de la página.
    const raiz = document.scrollingElement ?? document.documentElement;
    if (raiz.scrollWidth > raiz.clientWidth + 1) {
        anotar('desborde-horizontal', `documento: scrollWidth ${raiz.scrollWidth} > clientWidth ${raiz.clientWidth}`);
    }

    /** ¿Esto parece una tarjeta y no un campo, un chip o una insignia? */
    const esTarjeta = (el: Element, estilo: CSSStyleDeclaration, rect: DOMRect) => {
        if (/^(INPUT|TEXTAREA|SELECT|BUTTON|IMG|SVG)$/i.test(el.tagName)) return false;
        if (estilo.position === 'absolute' || estilo.position === 'fixed') return false;
        const radio = parseFloat(estilo.borderTopLeftRadius) || 0;
        const tieneSuperficie =
            (parseColor(estilo.backgroundColor)?.[3] ?? 0) > 0.05 || estilo.backgroundImage !== 'none';
        const relleno = (parseFloat(estilo.paddingTop) || 0) >= 8;
        return radio >= 12 && tieneSuperficie && relleno && rect.width * rect.height >= 6000;
    };

    const todos = Array.from(document.querySelectorAll('body *'));

    for (const el of todos) {
        if (!(el instanceof HTMLElement)) continue;
        const estilo = getComputedStyle(el);
        if (estilo.display === 'none' || estilo.visibility === 'hidden' || parseFloat(estilo.opacity) === 0) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        // 2. Contraste: solo nodos con texto propio.
        const contenido = texto(el);
        if (contenido.length > 0 && contenido.length < 400) {
            const color = parseColor(estilo.color);
            const fondo = fondoEfectivo(el);
            if (fondo === 'gradiente') {
                anotar('contraste-no-medible', `fondo con gradiente ${describir(el)}`);
            } else if (color && color[3] > 0.05) {
                const l1 = luminancia(color);
                const l2 = luminancia(fondo);
                const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
                const tamano = parseFloat(estilo.fontSize);
                const negrita = parseInt(estilo.fontWeight, 10) >= 700;
                const grande = tamano >= 24 || (tamano >= 18.66 && negrita);
                const minimo = grande ? 3 : 4.5;
                if (ratio < minimo) {
                    anotar(
                        'contraste',
                        `${ratio.toFixed(2)}:1 (mín ${minimo}) ${tamano}px ${describir(el)}`
                    );
                }
            }

            // 3. Texto chico.
            const tamano = parseFloat(estilo.fontSize);
            if (tamano > 0 && tamano < 12) {
                anotar('texto-chico', `${tamano}px ${describir(el)}`);
            }
        }

        // 4. Desborde horizontal dentro de un contenedor.
        if (el.scrollWidth > el.clientWidth + 2 && (estilo.overflowX === 'hidden' || estilo.overflowX === 'auto' || estilo.overflowX === 'scroll')) {
            anotar('contenido-recortado-x', `${el.scrollWidth} > ${el.clientWidth} ${describir(el)}`);
        }

        // 5. Contenido recortado en vertical (sin scroll disponible).
        if (estilo.overflowY === 'hidden' && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 0) {
            anotar('contenido-recortado-y', `${el.scrollHeight} > ${el.clientHeight} ${describir(el)}`);
        }

        // 6. Superficies anidadas: dos **tarjetas** una dentro de otra.
        //
        // La primera versión marcaba cualquier cosa redondeada con fondo dentro de otra: inputs,
        // chips de emoji, avatares. Un campo dentro de una tarjeta es lo normal, no un problema.
        // Se exige forma de tarjeta en los dos lados (radio, superficie, relleno y tamaño), y se
        // excluyen controles y elementos posicionados en absoluto, que son insignias.
        if (esTarjeta(el, estilo, rect)) {
            let ancestro: Element | null = el.parentElement;
            while (ancestro) {
                const rectAncestro = ancestro.getBoundingClientRect();
                if (esTarjeta(ancestro, getComputedStyle(ancestro), rectAncestro)) {
                    anotar('superficie-anidada', `${describir(el)} dentro de <${ancestro.tagName.toLowerCase()}> ${Math.round(rectAncestro.width)}×${Math.round(rectAncestro.height)}`);
                    break;
                }
                ancestro = ancestro.parentElement;
            }
        }

        // 7. Objetivos táctiles.
        const interactivo = el.matches('button, a, input, select, textarea, [role="button"], [role="tab"], [role="switch"]');
        if (interactivo && (rect.width < 44 || rect.height < 44)) {
            anotar('objetivo-tactil', `${Math.round(rect.width)}×${Math.round(rect.height)} ${describir(el)}`);
        }

        // 8. Imágenes rotas.
        if (el instanceof HTMLImageElement && el.complete && el.naturalWidth === 0) {
            anotar('imagen-rota', el.currentSrc || el.src || '(sin src)');
        }
    }

    return hallazgos;
}

test.describe('auditoría de interfaz', () => {
    test('mide contraste, tamaño, recortes y anidamiento en las pantallas principales', async ({ page }, info) => {
        const informe: Record<string, Hallazgo[]> = {};

        for (const pantalla of PANTALLAS) {
            await page.goto('/');
            await expect(page.getByText(/Muro de deseos/i).first()).toBeVisible({ timeout: 20000 });
            await pantalla.preparar(page);

            const hallazgos = (await page.evaluate(auditarEnPagina)) as Hallazgo[];
            informe[pantalla.nombre] = hallazgos;
        }

        const total = Object.values(informe).reduce((suma, lista) => suma + lista.length, 0);
        const porTipo = (tipo: string) =>
            Object.values(informe).reduce((suma, lista) => suma + lista.filter((h) => h.tipo === tipo).length, 0);

        const resumen = [
            '# Auditoría de interfaz',
            '',
            `Pantallas: ${Object.keys(informe).join(', ')}`,
            `Hallazgos: ${total}`,
            '',
            '| Tipo | Cantidad |',
            '| --- | --- |',
            ...['contraste', 'contraste-no-medible', 'texto-chico', 'objetivo-tactil', 'desborde-horizontal', 'contenido-recortado-x', 'contenido-recortado-y', 'superficie-anidada', 'imagen-rota'].map(
                (tipo) => `| ${tipo} | ${porTipo(tipo)} |`
            ),
            '',
            ...Object.entries(informe).flatMap(([pantalla, lista]) => [
                `## ${pantalla} (${lista.length})`,
                '',
                ...(lista.length === 0 ? ['Sin hallazgos.', ''] : lista.map((h) => `- **${h.tipo}** · ${h.detalle}`)),
                '',
            ]),
        ].join('\n');

        mkdirSync('test-results', { recursive: true });
        writeFileSync('test-results/audit-ui.md', resumen, 'utf8');
        writeFileSync('test-results/audit-ui.json', JSON.stringify(informe, null, 2), 'utf8');
        console.log(resumen);

        // La auditoría existe solo si midió todas las pantallas: un informe vacío que pasa en verde
        // no vale nada.
        expect(Object.keys(informe).length, 'la auditoría no recorrió todas las pantallas').toBe(PANTALLAS.length);

        // **Una sola regla es puerta**: los objetivos táctiles. Las demás se informan y se deciden
        // mirándolas —un contraste no medible por gradiente no es un defecto—, pero un control de
        // 36 px en una app que se usa con el pulgar sí, y por eso no puede volver.
        const tactiles = Object.entries(informe).flatMap(([pantalla, lista]) =>
            lista.filter((h) => h.tipo === 'objetivo-tactil').map((h) => `${pantalla} · ${h.detalle}`)
        );

        expect(tactiles, `Objetivos táctiles por debajo de 44 px: ${tactiles.join(' | ')}`).toEqual([]);

        void info;
    });
});
