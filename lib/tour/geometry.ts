/**
 * Geometría del tour: funciones **puras**, sin React y sin DOM.
 *
 * El overlay no calcula nada por su cuenta: le pasa los rectángulos que midió el registro de
 * objetivos y este módulo decide dónde va el velo, dónde el anillo y dónde la tarjeta. Así la parte
 * difícil —que el velo no deje grietas ni se pise, que la tarjeta no tape lo que explica— se prueba
 * con números, sin montar un navegador.
 *
 * Nada aquí conoce colores ni clases: sólo posiciones y tamaños, en píxeles de pantalla.
 */

export type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type Size = {
    width: number;
    height: number;
};

/** Separación entre el borde del objetivo y el anillo, para que éste no quede pegado. */
export const RING_INSET = 8;

/** Grosor del anillo. */
export const RING_THICKNESS = 3;

/** Margen entre la tarjeta y los bordes de la pantalla (y separación con el hueco). */
export const CARD_MARGIN = 16;

/**
 * A partir de qué ancho la pantalla deja de ser móvil. Es el mismo umbral que `lib/use-is-desktop.ts`
 * (`width > 768` es escritorio) y aquí se usa para lo mismo que allí: decidir en qué banda estamos.
 * No se importa aquel módulo porque exporta un enganche de React y este fichero es geometría pura.
 */
export const SHEET_MAX_WIDTH = 768;

/** Las cuatro piezas de velo. Juntas cubren el viewport menos el hueco. */
export type ScrimPieces = {
    top: Rect;
    bottom: Rect;
    left: Rect;
    right: Rect;
};

export type Ring = Rect & {
    /** Grosor de la línea. */
    thickness: number;
    /** Radio de las esquinas: la mitad del lado más corto, con 16 px como tope. */
    radius: number;
};

/** Dónde acabó la tarjeta. Los cuatro primeros son anclajes; `sheet` es la hoja inferior de móvil. */
export type Placement = 'below' | 'above' | 'left' | 'right' | 'sheet';

export type CardPlacement = Rect & {
    placement: Placement;
};

function clamp(value: number, min: number, max: number): number {
    if (max < min) return max;

    return Math.min(Math.max(value, min), max);
}

function positivo(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Los cuatro rectángulos que oscurecen todo menos el hueco.
 *
 * Se construyen como una **teselación**: primero la franja de arriba y la de abajo ocupando todo el
 * ancho, y luego las dos laterales sólo a la altura del hueco. Así no hay solapes por construcción
 * (cada pieza reclama su banda) y la suma de áreas es exactamente la del viewport menos la del
 * hueco. El hueco se recorta al viewport de antemano: un objetivo que se sale por un borde, o que es
 * más grande que la pantalla, no puede producir piezas negativas.
 */
export function scrimPieces(hole: Rect, viewport: Size): ScrimPieces {
    const ancho = positivo(viewport.width);
    const alto = positivo(viewport.height);

    const izquierda = clamp(hole.x, 0, ancho);
    const arriba = clamp(hole.y, 0, alto);
    const derecha = clamp(hole.x + positivo(hole.width), izquierda, ancho);
    const abajo = clamp(hole.y + positivo(hole.height), arriba, alto);

    return {
        top: { x: 0, y: 0, width: ancho, height: arriba },
        bottom: { x: 0, y: abajo, width: ancho, height: alto - abajo },
        left: { x: 0, y: arriba, width: izquierda, height: abajo - arriba },
        right: { x: derecha, y: arriba, width: ancho - derecha, height: abajo - arriba },
    };
}

/**
 * El anillo que rodea el hueco: el hueco crecido por el inset en los cuatro lados.
 *
 * El radio se queda en la mitad del lado más corto como mucho (así el anillo de una pestaña es una
 * píldora) y nunca pasa de 16 px, el radio de las tarjetas del repo, para que un objetivo grande no
 * acabe con forma de estadio.
 */
export function ringRect(hole: Rect, inset: number, thickness: number): Ring {
    const ancho = positivo(hole.width) + positivo(inset) * 2;
    const alto = positivo(hole.height) + positivo(inset) * 2;

    return {
        x: hole.x - positivo(inset),
        y: hole.y - positivo(inset),
        width: ancho,
        height: alto,
        thickness: positivo(thickness),
        radius: Math.min(16, Math.min(ancho, alto) / 2),
    };
}

/**
 * Dónde va el cuadro de diálogo.
 *
 * El orden es el de la lectura y el del pulgar: debajo del hueco si cabe, encima si no, y si no cabe
 * ni arriba ni abajo, el lado con más sitio. La tarjeta se recorta al viewport con margen antes de
 * decidir, así que un tamaño estimado demasiado grande no empuja nada fuera de la pantalla.
 *
 * En móvil (`ancho <= SHEET_MAX_WIDTH`) gana la **hoja inferior** (S6): una tarjeta flotante al lado
 * del hueco en 360 px se queda sin sitio y acaba encima de lo que explica. La hoja se pega abajo y
 * empieza después del hueco; si el hueco llega al borde inferior (la barra de pestañas), se pega al
 * borde y no hay nada que hacer: es el único sitio que queda.
 */
export function cardPlacement(hole: Rect, viewport: Size, cardSize: Size): CardPlacement {
    const ancho = positivo(viewport.width);
    const alto = positivo(viewport.height);
    const width = Math.min(positivo(cardSize.width), Math.max(0, ancho - CARD_MARGIN * 2));
    const height = Math.min(positivo(cardSize.height), Math.max(0, alto - CARD_MARGIN * 2));

    // Tope por la derecha y por abajo. Con un viewport más pequeño que dos márgenes no hay forma de
    // dejar el margen: la tarjeta ya viene recortada a cero y se pega a lo que quede.
    const xMaxima = ancho - width - CARD_MARGIN;
    const yMaxima = alto - height - CARD_MARGIN;

    if (ancho <= SHEET_MAX_WIDTH) {
        // La hoja ocupa el ancho útil entero: en 360 px, una tarjeta estrecha flotando encima de la
        // página se lee peor que una banda apoyada en el borde inferior.
        const anchoHoja = Math.max(0, ancho - CARD_MARGIN * 2);
        const altoHoja = Math.min(positivo(cardSize.height), Math.max(0, alto - CARD_MARGIN * 2));
        const debajoDelHueco = hole.y + positivo(hole.height) + CARD_MARGIN;
        const yMinima = Math.max(CARD_MARGIN, alto - altoHoja - CARD_MARGIN);

        return {
            x: CARD_MARGIN,
            y: clamp(debajoDelHueco, CARD_MARGIN, yMinima),
            width: anchoHoja,
            height: altoHoja,
            placement: 'sheet',
        };
    }

    // Centrada en el hueco, pero sin salirse: en un hueco pegado a un borde se desplaza.
    const x = clamp(hole.x + positivo(hole.width) / 2 - width / 2, CARD_MARGIN, xMaxima);
    const yDebajo = hole.y + positivo(hole.height) + CARD_MARGIN;
    const yEncima = hole.y - height - CARD_MARGIN;

    if (yDebajo <= yMaxima) {
        return { x, y: yDebajo, width, height, placement: 'below' };
    }

    if (yEncima >= CARD_MARGIN) {
        return { x, y: yEncima, width, height, placement: 'above' };
    }

    // Ni debajo ni encima: al lado con más sitio. Se alinea con el hueco en vertical.
    const sitioDerecha = ancho - (hole.x + positivo(hole.width));
    const sitioIzquierda = hole.x;
    const y = clamp(hole.y + positivo(hole.height) / 2 - height / 2, CARD_MARGIN, yMaxima);

    if (sitioDerecha >= sitioIzquierda) {
        return {
            x: clamp(hole.x + positivo(hole.width) + CARD_MARGIN, CARD_MARGIN, xMaxima),
            y,
            width,
            height,
            placement: 'right',
        };
    }

    return {
        x: clamp(hole.x - width - CARD_MARGIN, CARD_MARGIN, xMaxima),
        y,
        width,
        height,
        placement: 'left',
    };
}
