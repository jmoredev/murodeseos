/**
 * Datos de demostración del tour: lo que enseñan las pantallas que, con una cuenta recién creada,
 * estarían vacías.
 *
 * Decisión D1: viven **en el cliente** y se inyectan por propiedad en `WishListTab` y `GroupsTab`.
 * No se escribe ninguna fila, así que no hay nada que limpiar si el usuario salta el tour, y se
 * puede enseñar un grupo de tres personas: inventar miembros en la base de datos es imposible,
 * porque `group_members.user_id` apunta a `auth.users`.
 *
 * Decisión D5: además de las listas de la portada, el tour entra en el grupo de ejemplo y en la
 * lista de una de sus personas (`app/groups/[id]` y `app/wishlist/[id]`). Esas dos pantallas piden
 * a la base de datos por id, así que con un id del tour no piden nada: no existen allí, y lo que se
 * pinta es lo de este fichero, mientras el tour está en marcha. Aquí se guardan los miembros con la
 * forma que el detalle del grupo consume y la lista de una miembro con un deseo ya reservado.
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

/**
 * Un miembro del grupo con la forma exacta que consume `app/groups/[id]`: la fila de
 * `group_members` (`user_id`, `role`) con su perfil incrustado. No es una copia que se parece: la
 * pantalla del grupo pinta `member.profiles.display_name` y `member.profiles.avatar_url`, así que
 * los mismos campos se llaman igual aquí (D1, D5).
 */
export type DemoGroupMember = {
    user_id: string;
    role: 'admin' | 'member';
    profiles: { display_name: string; avatar_url: string };
};

/**
 * Las personas del grupo de bienvenida, tal y como se ven al abrirlo (D5).
 *
 * Son las mismas tres de `DEMO_GROUP.members` —la tarjeta de la lista y la rejilla del detalle tienen
 * que hablar de las mismas personas— y ninguna existe en `auth.users`: inventar miembros de verdad
 * es imposible, porque `group_members.user_id` apunta a `auth.users` (D1).
 */
export const DEMO_GROUP_MEMBERS: readonly DemoGroupMember[] = [
    {
        user_id: 'tour-member-1',
        role: 'member',
        profiles: { display_name: 'Marta', avatar_url: '🦊' },
    },
    {
        user_id: 'tour-member-2',
        role: 'admin',
        profiles: { display_name: 'Javier', avatar_url: '🐼' },
    },
    {
        user_id: 'tour-member-3',
        role: 'member',
        profiles: { display_name: 'Lucía', avatar_url: '🐨' },
    },
];

/** La miembro cuya lista se abre en la parada `deseos-miembro` (D5). */
export const DEMO_MEMBER: DemoGroupMember = DEMO_GROUP_MEMBERS[0];

/**
 * La lista de Marta, con un deseo ya reservado por otra persona.
 *
 * Es lo que el tour no podía enseñar sin entrar en un grupo: la tarjeta de un deseo reservado, la
 * que tapa la imagen y avisa «Reservado» para que nadie regale dos veces lo mismo. El estado viaja
 * en `reservationState`, el campo que `WishlistCard` ya pinta; aquí no se reimplementa nada.
 */
export const DEMO_MEMBER_WISHES: readonly GiftItem[] = [
    {
        id: 'tour-member-wish-1',
        title: 'Sartén de hierro de 24 cm',
        links: [],
        imageUrl: IMAGEN_DE_MUESTRA,
        price: 34.5,
        currency: 'EUR',
        notes: 'Curada, para que no se pegue la tortilla.',
        priority: 'high',
        reservationState: 'reserved_by_other',
    },
    {
        id: 'tour-member-wish-2',
        title: 'Suscripción a una revista de viajes',
        links: [],
        imageUrl: IMAGEN_DE_MUESTRA,
        price: 45,
        currency: 'EUR',
        notes: 'Doce números, uno por mes.',
        priority: 'medium',
        reservationState: 'available',
    },
    {
        id: 'tour-member-wish-3',
        title: 'Bicicleta de paseo',
        links: [],
        imageUrl: IMAGEN_DE_MUESTRA,
        price: 320,
        currency: 'EUR',
        notes: 'Con cesta, para ir al mercado.',
        priority: 'low',
        reservationState: 'available',
    },
];

/**
 * ¿Este id es uno de los miembros de ejemplo? Es la puerta de las dos pantallas del tour: con un id
 * del tour **no se pregunta a la base de datos** (no existe: pedirlo daría un 404 y una pantalla de
 * error) y se pintan los datos de arriba mientras el tour está en marcha.
 */
export function demoMemberById(id: string): DemoGroupMember | undefined {
    return DEMO_GROUP_MEMBERS.find((miembro) => miembro.user_id === id);
}

/** La lista de deseos de un miembro del tour, o `undefined` si ese id no es uno de ellos. */
export function demoWishesForMember(id: string): readonly GiftItem[] | undefined {
    return id === DEMO_MEMBER.user_id ? DEMO_MEMBER_WISHES : undefined;
}
