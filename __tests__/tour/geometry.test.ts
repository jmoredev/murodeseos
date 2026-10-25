import { describe, expect, it } from 'vitest';
import {
    CARD_BORDER,
    CARD_MARGIN,
    CARD_PADDING,
    SHEET_MAX_WIDTH,
    cardHeightForContent,
    cardPlacement,
    ringRect,
    scrimPieces,
    type Rect,
    type Size,
} from '../../lib/tour/geometry';

/**
 * La geometría del tour no sabe de React: recibe rectángulos y devuelve rectángulos. Por eso aquí
 * se prueba la **propiedad** que hace que el overlay se vea bien, no cuatro números copiados a mano:
 * cuatro piezas de velo que cubren el viewport exactamente una vez, un anillo que rodea el hueco y
 * una tarjeta que se coloca sin tapar lo que explica. Si mañana cambia el margen o el inset, estos
 * tests siguen diciendo la verdad; si alguien rompe el teselado, fallan.
 */

const PANTALLA: Size = { width: 1024, height: 768 };
const TARJETA: Size = { width: 320, height: 180 };

function area(rect: Rect): number {
    return rect.width * rect.height;
}

/** Un punto pertenece a un rectángulo con los bordes superior/izquierdo dentro y el resto fuera. */
function contiene(rect: Rect, px: number, py: number): boolean {
    return px >= rect.x && px < rect.x + rect.width && py >= rect.y && py < rect.y + rect.height;
}

/** ¿Se pisan los dos rectángulos algo más que el redondeo de un píxel? */
function seSolapan(a: Rect, b: Rect): boolean {
    const ancho = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const alto = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

    return ancho > 1 && alto > 1;
}

/** El hueco recortado al viewport, que es la única parte que el velo tiene que respetar. */
function recorte(hole: Rect, viewport: Size): Rect {
    const x = Math.min(Math.max(hole.x, 0), viewport.width);
    const y = Math.min(Math.max(hole.y, 0), viewport.height);
    return {
        x,
        y,
        width: Math.min(Math.max(hole.x + hole.width, x), viewport.width) - x,
        height: Math.min(Math.max(hole.y + hole.height, y), viewport.height) - y,
    };
}

/**
 * La propiedad del velo: las cuatro piezas, juntas, son el viewport **menos** el hueco. Ni una
 * grieta (se vería un trozo de página sin oscurecer) ni un solape (se oscurecería dos veces y el
 * borde cantaría). Se comprueba de dos formas: el área suma lo que debe, y una rejilla de puntos
 * interiores cae en exactamente una pieza fuera del hueco y en ninguna dentro.
 */
function comprobarTeselado(hole: Rect, viewport: Size) {
    const piezas = Object.values(scrimPieces(hole, viewport));

    expect(piezas).toHaveLength(4);

    for (const pieza of piezas) {
        expect(pieza.width).toBeGreaterThanOrEqual(0);
        expect(pieza.height).toBeGreaterThanOrEqual(0);
        expect(pieza.x).toBeGreaterThanOrEqual(0);
        expect(pieza.y).toBeGreaterThanOrEqual(0);
        expect(pieza.x + pieza.width).toBeLessThanOrEqual(viewport.width);
        expect(pieza.y + pieza.height).toBeLessThanOrEqual(viewport.height);
    }

    const suma = piezas.reduce((total, pieza) => total + area(pieza), 0);
    expect(suma).toBeCloseTo(viewport.width * viewport.height - area(recorte(hole, viewport)), 6);

    const dentro = recorte(hole, viewport);

    for (let columna = 0; columna < 16; columna++) {
        for (let fila = 0; fila < 16; fila++) {
            const px = (viewport.width * (columna + 0.5)) / 16;
            const py = (viewport.height * (fila + 0.5)) / 16;
            const cubierto = piezas.filter((pieza) => contiene(pieza, px, py)).length;

            expect(cubierto, `el punto (${px}, ${py}) está cubierto ${cubierto} veces`).toBe(
                contiene(dentro, px, py) ? 0 : 1
            );
        }
    }
}

describe('scrimPieces: cuatro rectángulos que teselan el viewport', () => {
    it('un hueco en el centro deja las cuatro piezas y no deja ni grieta ni solape', () => {
        comprobarTeselado({ x: 380, y: 300, width: 240, height: 120 }, PANTALLA);
    });

    it('un hueco pegado a la esquina superior izquierda no produce piezas negativas', () => {
        const piezas = scrimPieces({ x: 0, y: 0, width: 120, height: 60 }, PANTALLA);

        // Sin sitio arriba ni a la izquierda, esas dos piezas quedan a cero (no a -60).
        expect(piezas.top).toEqual({ x: 0, y: 0, width: PANTALLA.width, height: 0 });
        expect(piezas.left).toEqual({ x: 0, y: 0, width: 0, height: 60 });
        comprobarTeselado({ x: 0, y: 0, width: 120, height: 60 }, PANTALLA);
    });

    it('un hueco pegado al borde inferior y derecho no produce piezas negativas', () => {
        comprobarTeselado(
            { x: PANTALLA.width - 80, y: PANTALLA.height - 40, width: 80, height: 40 },
            PANTALLA
        );
    });

    it('un objetivo más grande que la pantalla se recorta y aun así sale sin negativos', () => {
        const hole: Rect = { x: -200, y: -100, width: 4000, height: 3000 };
        const piezas = scrimPieces(hole, PANTALLA);

        for (const pieza of Object.values(piezas)) {
            expect(pieza.width).toBeGreaterThanOrEqual(0);
            expect(pieza.height).toBeGreaterThanOrEqual(0);
        }

        // El hueco se come el viewport entero, así que el velo no tiene nada que oscurecer.
        expect(area(piezas.top) + area(piezas.bottom) + area(piezas.left) + area(piezas.right)).toBe(0);
    });

    it('un hueco parcialmente fuera se recorta al viewport y tesela igual', () => {
        comprobarTeselado({ x: -40, y: 700, width: 200, height: 100 }, PANTALLA);
    });
});

describe('ringRect: el anillo rodea el hueco', () => {
    it('crece por el inset en los cuatro lados y conserva el grosor pedido', () => {
        const anillo = ringRect({ x: 100, y: 200, width: 80, height: 40 }, 8, 3);

        expect(anillo).toMatchObject({
            x: 92,
            y: 192,
            width: 96,
            height: 56,
            thickness: 3,
        });
        expect(anillo.radius).toBeGreaterThan(0);
    });

    it('con un hueco vacío sigue siendo solo el inset, sin tamaños negativos', () => {
        const anillo = ringRect({ x: 10, y: 10, width: 0, height: 0 }, 8, 0);

        expect(anillo.width).toBe(16);
        expect(anillo.height).toBe(16);
        expect(anillo.thickness).toBe(0);
        expect(anillo.radius).toBeGreaterThanOrEqual(0);
    });
});

describe('cardHeightForContent: la tarjeta mide lo que mide su contenido', () => {
    it('suma el relleno y el filo de arriba y de abajo al contenido medido', () => {
        // El caso real medido en Chromium: un contenido de 190 px en una tarjeta de 152 px (D4).
        expect(cardHeightForContent(190)).toBe(190 + (CARD_PADDING + CARD_BORDER) * 2);
        expect(cardHeightForContent(214)).toBe(214 + (CARD_PADDING + CARD_BORDER) * 2);
    });

    it('deja al contenido el alto que pide, sin comérselo con el relleno ni con el filo', () => {
        // Es la cuenta que hace que `scrollHeight` y `clientHeight` coincidan en el navegador: del
        // alto de la tarjeta se descuentan el relleno y el filo, y queda el contenido entero.
        const altoDeLaTarjeta = cardHeightForContent(214);

        expect(altoDeLaTarjeta - (CARD_PADDING + CARD_BORDER) * 2).toBe(214);
    });

    it('un contenido sin medir deja la tarjeta en su relleno, nunca en un alto negativo', () => {
        expect(cardHeightForContent(0)).toBe((CARD_PADDING + CARD_BORDER) * 2);
        expect(cardHeightForContent(-400)).toBe((CARD_PADDING + CARD_BORDER) * 2);
        expect(cardHeightForContent(Number.NaN)).toBe((CARD_PADDING + CARD_BORDER) * 2);
    });

    it('crece con el contenido: una página más larga da una tarjeta más alta', () => {
        expect(cardHeightForContent(214)).toBeGreaterThan(cardHeightForContent(190));
    });
});

describe('cardPlacement: la tarjeta no tapa lo que explica', () => {
    it('si cabe debajo del hueco, va debajo y centrada en él', () => {
        const tarjeta = cardPlacement({ x: 400, y: 200, width: 200, height: 60 }, PANTALLA, TARJETA);

        expect(tarjeta.placement).toBe('below');
        expect(tarjeta.y).toBe(200 + 60 + CARD_MARGIN);
        // Centrada en el hueco: 400 + 100 - 160 = 340, y cabe con margen.
        expect(tarjeta.x).toBe(340);
        expect(tarjeta.width).toBe(TARJETA.width);
        expect(tarjeta.height).toBe(TARJETA.height);
    });

    it('cerca del borde inferior va encima del hueco', () => {
        const hole: Rect = { x: 400, y: 600, width: 200, height: 120 };
        const tarjeta = cardPlacement(hole, PANTALLA, TARJETA);

        expect(tarjeta.placement).toBe('above');
        expect(tarjeta.y + tarjeta.height).toBeLessThanOrEqual(hole.y);
        expect(tarjeta.y).toBeGreaterThanOrEqual(CARD_MARGIN);
    });

    it('si no cabe en ningún sitio se recorta y se queda dentro del viewport con margen', () => {
        const enorme: Size = { width: 2000, height: 2000 };
        const tarjeta = cardPlacement({ x: 400, y: 200, width: 200, height: 60 }, PANTALLA, enorme);

        expect(tarjeta.width).toBe(PANTALLA.width - CARD_MARGIN * 2);
        expect(tarjeta.height).toBe(PANTALLA.height - CARD_MARGIN * 2);
        expect(tarjeta.x).toBeGreaterThanOrEqual(CARD_MARGIN);
        expect(tarjeta.y).toBeGreaterThanOrEqual(CARD_MARGIN);
        expect(tarjeta.x + tarjeta.width).toBeLessThanOrEqual(PANTALLA.width - CARD_MARGIN);
        expect(tarjeta.y + tarjeta.height).toBeLessThanOrEqual(PANTALLA.height - CARD_MARGIN);
    });

    it('en un viewport estrecho elige hoja inferior y la deja por debajo del hueco', () => {
        const movil: Size = { width: 360, height: 740 };
        const hole: Rect = { x: 20, y: 120, width: 320, height: 56 };
        const tarjeta = cardPlacement(hole, movil, TARJETA);

        expect(tarjeta.placement).toBe('sheet');
        expect(tarjeta.x).toBe(CARD_MARGIN);
        expect(tarjeta.width).toBe(movil.width - CARD_MARGIN * 2);
        // La hoja empieza después del hueco: no lo tapa.
        expect(tarjeta.y).toBeGreaterThanOrEqual(hole.y + hole.height);
        expect(tarjeta.y + tarjeta.height).toBeLessThanOrEqual(movil.height - CARD_MARGIN);
    });

    it('en móvil, con el hueco en la barra de pestañas, la hoja va encima y no lo tapa', () => {
        // El caso real de S6: la barra inferior del dock. Pegada abajo no cabe nada debajo de ella.
        const movil: Size = { width: 360, height: 740 };
        const hole: Rect = { x: 20, y: 650, width: 320, height: 56 };
        const tarjeta = cardPlacement(hole, movil, TARJETA);

        expect(tarjeta.placement).toBe('sheet');
        // Sube por encima del hueco en vez de apoyarse en el borde inferior encima de él.
        expect(tarjeta.y + tarjeta.height).toBeLessThanOrEqual(hole.y);
        expect(tarjeta.y).toBeGreaterThanOrEqual(CARD_MARGIN);
    });

    it('en móvil, si el hueco no deja sitio a ningún lado, la hoja se apoya abajo con su alto entero', () => {
        const movil: Size = { width: 360, height: 740 };
        // Un hueco que no deja ni la tarjeta entera debajo (200+400+16 > 740-180-16) ni encima
        // (200-180-16 < 16): el caso de una lista de deseos que ocupa media pantalla.
        const hole: Rect = { x: 0, y: 200, width: 360, height: 400 };
        const tarjeta = cardPlacement(hole, movil, TARJETA);

        expect(tarjeta.placement).toBe('sheet');
        // Se apoya en el borde inferior con el alto que necesita, sin recortarlo: recortar el alto
        // es lo que obligaba a desplazar el texto (S3), que es lo que el tour no puede permitir.
        expect(tarjeta.height).toBe(TARJETA.height);
        expect(tarjeta.y + tarjeta.height).toBe(movil.height - CARD_MARGIN);
        // Y sí, pisa la parte baja del hueco: es el patrón normal de una hoja inferior.
        expect(seSolapan(tarjeta, hole)).toBe(true);
    });

    it('en móvil, con un hueco más alto que la pantalla, la hoja se apoya abajo con el alto que necesita', () => {
        // El caso medido en Chromium (odd/tasks/tour-ajustes-visuales.md, D4): la lista de deseos
        // resaltada ocupa de 184 a 990 en una pantalla de 844, así que no queda banda a ningún lado.
        const movil: Size = { width: 390, height: 844 };
        const hole: Rect = { x: 16, y: 184, width: 358, height: 806 };
        const tarjeta = cardPlacement(hole, movil, { width: 328, height: 222 });

        expect(tarjeta.placement).toBe('sheet');
        expect(tarjeta.height).toBe(222);
        expect(tarjeta.y).toBe(movil.height - 222 - CARD_MARGIN);
        expect(tarjeta.y + tarjeta.height).toBe(movil.height - CARD_MARGIN);
    });

    it('en móvil, una tarjeta más alta que el viewport se recorta al viewport menos los dos márgenes', () => {
        const movil: Size = { width: 390, height: 844 };
        const hole: Rect = { x: 16, y: 184, width: 358, height: 806 };
        const tarjeta = cardPlacement(hole, movil, { width: 328, height: 5000 });

        expect(tarjeta.placement).toBe('sheet');
        expect(tarjeta.height).toBe(movil.height - CARD_MARGIN * 2);
        expect(tarjeta.y).toBe(CARD_MARGIN);
        expect(tarjeta.y + tarjeta.height).toBe(movil.height - CARD_MARGIN);
    });

    it('en móvil, una tarjeta más alta que la estimación sigue sin tapar el hueco de la barra de pestañas', () => {
        // El caso que motivó medir en vez de estimar: la tarjeta de verdad mide 420 px, no 190, y
        // la colocación tiene que hacerse con esa altura o el crecimiento acaba encima del hueco.
        const movil: Size = { width: 360, height: 740 };
        const hole: Rect = { x: 20, y: 650, width: 320, height: 56 };
        const tarjeta = cardPlacement(hole, movil, { width: 328, height: 420 });

        expect(tarjeta.placement).toBe('sheet');
        expect(tarjeta.height).toBe(420);
        expect(tarjeta.y + tarjeta.height).toBeLessThanOrEqual(hole.y);
        expect(tarjeta.y).toBeGreaterThanOrEqual(CARD_MARGIN);
    });

    it('el ancho del umbral pertenece a móvil: 768 es hoja y 769 no', () => {
        const hole: Rect = { x: 100, y: 100, width: 120, height: 40 };

        expect(cardPlacement(hole, { width: SHEET_MAX_WIDTH, height: 900 }, TARJETA).placement).toBe('sheet');
        expect(cardPlacement(hole, { width: SHEET_MAX_WIDTH + 1, height: 900 }, TARJETA).placement).not.toBe('sheet');
    });
});
