/**
 * El guion del recorrido de primer uso (S3, D4).
 *
 * Una parada por pantalla: deseos, el botón de añadir, la pantalla de alta, los grupos, unirse con
 * código, el perfil y las notificaciones. El orden es el del uso normal de la app —se enseña qué
 * hay, luego cómo se añade— y el motor lo recorre de arriba abajo.
 *
 * Cada parada apunta a un `targetId` que la pantalla registra sola (S7) y dice dónde vive: `tab`
 * cuando es una pestaña de la portada (estado, no ruta) y `route` cuando es una pantalla de
 * expo-router. Un objetivo sin destino dejaría la parada esperando una medida que nunca llega.
 *
 * Sobre el grupo de ejemplo: además de verlo en la lista, el recorrido **entra** en él y en la
 * lista de una de sus personas (D5). Esas dos pantallas piden el grupo y la lista por id a la base de
 * datos, así que con un id del tour no piden nada y pintan los datos de demostración (D1): así se
 * enseña lo que de verdad hay dentro de un grupo —sus miembros, y sus deseos con el que ya está
 * reservado—, en vez de contarlo con palabras.
 *
 * **Cada página tiene que caber sin desplazar** (S3): la tarjeta del tour no es una ventana de
 * lectura, es un cartel. El presupuesto de abajo está calculado para el ancho útil de un móvil de
 * 360 px y lo vigila `__tests__/tour/steps.test.ts`; el reparto real en píxeles lo vigila la prueba
 * de extremo a extremo, que recorre las páginas y mide si sobra alto. Cuando una explicación no
 * cabe, se parte en otra página: el motor ya sabe recorrerlas.
 *
 * El texto es lo que lee el usuario: español de España, frases cortas, y ninguna promesa que los
 * datos de demostración no puedan cumplir.
 */

import type { TourStep } from './engine';

/**
 * Lo máximo que puede ocupar una página del guion, en caracteres (S3).
 *
 * Es un presupuesto de redacción, no una regla de negocio: 120 caracteres caben en cuatro líneas de
 * la tarjeta en un móvil de 360 px. Pasarse no rompe la app —la tarjeta se adapta a la página— pero
 * convierte el cartel en un párrafo, que es justo lo que el usuario pidió evitar.
 */
export const MAX_CARACTERES_PAGINA = 120;

/** Y un tope de páginas por parada: un paso con seis páginas es otro párrafo, más largo. */
export const MAX_PAGINAS_POR_PARADA = 4;

export const TOUR_STEPS: readonly TourStep[] = [
    {
        id: 'bienvenida',
        targetId: 'tab-deseos',
        tab: 'wishlist',
        pages: [
            'Este es tu muro de deseos. Lo que apuntes aquí lo verán las personas con las que compartas un grupo.',
            'Durante el tour verás deseos y un grupo de ejemplo: no están guardados en tu cuenta y desaparecerán al terminar.',
        ],
    },
    {
        id: 'lista-deseos',
        targetId: 'deseos-lista',
        tab: 'wishlist',
        pages: [
            'Aquí se van colocando tus deseos. Puedes ordenarlos por nombre, precio o prioridad.',
        ],
    },
    {
        id: 'agregar-deseo',
        targetId: 'deseos-agregar',
        tab: 'wishlist',
        pages: [
            'Con este botón añades un deseo: pegas el enlace del producto y la app intenta rellenarlo por ti.',
            'Al pulsarlo se abre la pantalla de añadir deseo, que es la siguiente parada.',
        ],
    },
    {
        id: 'nuevo-deseo',
        targetId: 'nuevo-deseo-form',
        route: '/wishlist/add',
        pages: [
            'Desde el botón de añadir has llegado aquí. Pega el enlace de la tienda y la app intenta rellenar los datos por ti.',
            'Si no hay enlace, o la página no se puede leer, el deseo se escribe a mano y el enlace no se pierde.',
        ],
    },
    {
        id: 'grupos',
        targetId: 'tab-grupos',
        tab: 'groups',
        pages: [
            'Aquí están los grupos en los que participas. Cada grupo es una lista compartida: lo que apunta uno lo ve el resto.',
        ],
    },
    {
        id: 'lista-grupos',
        targetId: 'grupos-lista',
        tab: 'groups',
        pages: [
            'Este es el grupo de bienvenida del tour, con personas de ejemplo: no está en tu cuenta y no hay nada que limpiar.',
            'Al abrir un grupo ves a sus miembros: al pulsar en uno de ellos consultas sus deseos.',
            'Y en los deseos verás cuáles ya están reservados, para no regalar dos veces lo mismo.',
            'Como es de ejemplo, el tour puede abrirlo: es la siguiente parada.',
        ],
    },
    {
        id: 'detalle-grupo',
        targetId: 'grupo-participantes',
        route: '/groups/tour-group',
        pages: [
            'Ya estás dentro del grupo de bienvenida: estas tarjetas son sus personas.',
            'Ni el grupo ni sus miembros existen en tu cuenta: viven en esta pantalla y se van con el tour.',
        ],
    },
    {
        id: 'deseos-miembro',
        targetId: 'deseos-miembro',
        route: '/wishlist/tour-member-1',
        pages: [
            'Al pulsar en una persona se abre su lista: así ves lo que quiere sin preguntárselo.',
            'Fíjate en el deseo con el candado: ya está reservado, para que nadie lo regale dos veces.',
        ],
    },
    {
        id: 'unirse-boton',
        targetId: 'grupos-unirse',
        tab: 'groups',
        pages: [
            'Con este botón te unes a un grupo cuando alguien te pasa su código de invitación.',
        ],
    },
    {
        id: 'unirse',
        targetId: 'unirse-form',
        route: '/groups/join',
        pages: [
            'Aquí pegas esa invitación. Con el código de otra persona entras en su grupo, sin que nadie tenga que buscarte.',
        ],
    },
    {
        id: 'crear-grupo',
        targetId: 'grupos-crear',
        tab: 'groups',
        pages: [
            'Y con este otro botón creas un grupo nuevo: tú quedas dentro y compartes su código para que entren los demás.',
        ],
    },
    {
        id: 'perfil',
        targetId: 'tab-perfil',
        tab: 'profile',
        pages: [
            'En Mi perfil eliges tu nombre público, tu avatar y tus tallas, para que tus grupos sepan qué regalarte.',
        ],
    },
    {
        id: 'notificaciones',
        targetId: 'notificaciones',
        tab: 'profile',
        pages: [
            'La campana reúne los avisos de tus grupos: deseos nuevos, reservas y cumpleaños.',
            'Durante el tour está vacía: nadie ha hecho nada todavía.',
        ],
    },
];
