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
 * Sobre el detalle de grupo: con datos de demostración no se puede abrir (decisión D1 — no se
 * escribe ninguna fila, así que el grupo de ejemplo no existe en la base de datos y
 * `/groups/[id]` mostraría una pantalla vacía). Se explica con una página dentro de la parada de la
 * lista en vez de navegar a una pantalla que no tiene nada que enseñar.
 *
 * El texto es lo que lee el usuario: español de España, frases cortas, y ninguna promesa que los
 * datos de demostración no puedan cumplir.
 */

import type { TourStep } from './engine';

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
        ],
    },
    {
        id: 'nuevo-deseo',
        targetId: 'nuevo-deseo-form',
        route: '/wishlist/add',
        pages: [
            'Pega aquí el enlace de la tienda. Si la página se puede leer, llegas al formulario con los datos ya puestos.',
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
            'Este es el grupo de bienvenida del tour, con personas de ejemplo. No existe en tu cuenta, así que no hay nada que limpiar cuando termine.',
            'Al abrir un grupo verías quiénes son sus miembros y las reservas de cada deseo, para no regalar dos veces lo mismo. El tour no puede enseñarlo: para abrir un grupo de verdad hace falta que exista, y estos datos de ejemplo viven sólo en esta pantalla.',
        ],
    },
    {
        id: 'unirse',
        targetId: 'unirse-form',
        route: '/groups/join',
        pages: [
            'Con un código de invitación entras en el grupo de otra persona, sin que nadie tenga que buscarte.',
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
