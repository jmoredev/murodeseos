/**
 * Datos de demostración del tour: lo que enseñan las pantallas que, con una cuenta recién creada,
 * estarían vacías.
 *
 * Decisión D1: viven **en el cliente** y se inyectan por propiedad en `WishListTab` y `GroupsTab`.
 * No se escribe ninguna fila, así que no hay nada que limpiar si el usuario salta el tour, y se
 * puede enseñar un grupo de tres personas: inventar miembros en la base de datos es imposible,
 * porque `group_members.user_id` apunta a `auth.users`.
 *
 * Los tipos son los de verdad —`GiftItem` y `Group`, los que ya consumen las listas—, no copias que
 * sólo se parecen: si la forma de un deseo o de un grupo cambia, esto deja de compilar en vez de
 * mentir. Y los identificadores llevan el prefijo `tour-` para que quien los vea en un log o en una
 * captura sepa de dónde salen.
 */

import type { Group } from '@/components/GroupCard';
import type { GiftItem } from '@/components/WishlistCard';

/**
 * La imagen de muestra es el marcador de posición que ya usa la suite de extremo a extremo
 * (`e2e/wishlist.spec.ts`): un HTTPS corriente que el navegador pinta sin pasar por la caché de
 * nadie. No se añade ninguna tubería de assets para esto.
 */
const IMAGEN_DE_MUESTRA = 'https://placehold.co/600x400/png';

/** Los tres deseos del tour. Se pintan en este orden: la lista no los reordena. */
export const DEMO_WISHES: readonly GiftItem[] = [
    {
        id: 'tour-wish-1',
        title: 'Auriculares con cancelación de ruido',
        links: [],
        imageUrl: IMAGEN_DE_MUESTRA,
        price: 89.95,
        currency: 'EUR',
        notes: 'Inalámbricos, que aguanten el tren entero.',
        priority: 'high',
    },
    {
        id: 'tour-wish-2',
        title: 'Cafetera italiana de 6 tazas',
        links: [],
        imageUrl: IMAGEN_DE_MUESTRA,
        price: 24.9,
        currency: 'EUR',
        notes: 'De acero, para el fuego de casa.',
        priority: 'medium',
    },
    {
        id: 'tour-wish-3',
        title: 'Mochila de senderismo de 30 litros',
        links: [],
        imageUrl: IMAGEN_DE_MUESTRA,
        price: 59.99,
        currency: 'EUR',
        notes: 'Con funda de lluvia, para la sierra.',
        priority: 'low',
    },
];

/**
 * El grupo de bienvenida del tour.
 *
 * `totalMemberCount` incluye a quien está mirando —es el contrato de la tarjeta—, así que son cuatro
 * participantes: el usuario nuevo y los tres que ya estaban.
 */
export const DEMO_GROUP: Group = {
    id: 'tour-group',
    name: 'Bienvenida',
    icon: '🎉',
    totalMemberCount: 4,
    members: [
        { id: 'tour-member-1', name: 'Marta', avatar: '🦊' },
        { id: 'tour-member-2', name: 'Javier', avatar: '🐼' },
        { id: 'tour-member-3', name: 'Lucía', avatar: '🐨' },
    ],
};

/** Lo que la pestaña de grupos espera cuando el tour está activo: un grupo, tres personas. */
export const DEMO_GROUPS: readonly Group[] = [DEMO_GROUP];
