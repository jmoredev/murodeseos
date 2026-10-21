/**
 * Las novedades que el modal anuncia al abrir la app.
 *
 * **La identidad de una novedad es su `id`**, no la versión del producto: `release` es solo la
 * etiqueta que el usuario ve. El motivo está medido y documentado en
 * `odd/tasks/novedades-por-release.md`: hasta 2026-10-21 el modal comparaba contra
 * `package.json`, que quedó congelado en `1.4.0` mientras las publicaciones se hacen con
 * etiquetas de fecha, así que la condición era verdadera siempre y, después de cerrarlo una vez,
 * nadie volvía a ver nada.
 *
 * Regla de operación (también en `docs/DEVELOPMENT.md`): antes de etiquetar una publicación, si
 * el cambio se ve para el usuario, se agrega una entrada **arriba** con un `id` nuevo.
 */
export interface AppUpdate {
    /** Identidad estable de la entrada. Es lo que decide si hay algo nuevo que anunciar. */
    id: string;
    /** Etiqueta visible en el modal (`v2026.10.21`). No se sincroniza con ningún otro archivo. */
    release: string;
    date: string;
    changes: string[];
}

export const updates: AppUpdate[] = [
    {
        id: '2026-10-21-novedades',
        release: '2026.10.21',
        date: '2026-10-21',
        changes: [
            '🔗 Comparte un producto desde el móvil: al compartir un enlace desde el navegador o desde una app de compras, el deseo se abre con el título, la foto, el precio y la moneda ya leídos de la página',
            '💶 El precio guarda su moneda: cada deseo recuerda en qué moneda está (EUR, USD…) y se muestra con el símbolo que corresponde, elegible en el formulario',
            '🎂 Cumpleaños y onomástica: carga tus fechas en el perfil y la app te avisa, con la antelación que elijas para cada grupo',
            '🔔 Avisos a tu medida: cada grupo tiene sus propias preferencias de notificaciones',
            '🎁 Reservas privadas: cuando alguien reserva un deseo te llega el aviso, y el deseo reservado deja de figurar como disponible',
            '🔐 Recupera tu contraseña y cierra sesión desde el perfil',
            '📲 Instala la app: Muro de Deseos se instala en el móvil como una app y ya no arranca en negro',
            '🔗 Enlaces en tus deseos: campo opcional y enlaces en los que se puede hacer clic',
        ],
    },
    {
        id: '2026-05-12-accesibilidad',
        release: '1.4.0',
        date: '2026-05-12',
        changes: [
            '♿ Accesibilidad: foco visible en web, documento en español, enlace «saltar al contenido», modales usables con teclado y lectores de pantalla',
            '📋 Mis grupos: el contador de participantes coincide con el detalle del grupo',
            '🔔 Notificaciones: cada aviso es un control accesible con nombre descriptivo',
            '🎅 Amigo Invisible: diálogo de administración con roles ARIA y cierre con Escape',
        ],
    },
    {
        id: '2026-02-04-notificaciones',
        release: '1.3.0',
        date: '2026-02-04',
        changes: [
            '🔔 Sistema de Notificaciones: Recibe avisos en tiempo real sobre actividad en tus grupos',
            '🎅 Amigo Invisible: Nuevo sistema de sorteos y gestión de Secret Santa mejorado',
            '📱 Optimización Móvil: Rediseño completo del panel de notificaciones para móviles',
            '✅ Tests de Integración: Cobertura total para las nuevas funcionalidades de sorteos',
            '🛠️ Mejoras de UI: Pequeños ajustes visuales para una interfaz más pulida',
        ],
    },
    {
        id: '2026-01-16-privacidad-por-grupos',
        release: '1.2.0',
        date: '2026-01-16',
        changes: [
            '🔒 Privacidad por Grupos: Ahora puedes excluir deseos de grupos específicos',
            '🎨 Rediseño de Lista: Nueva interfaz más moderna y limpia para tus deseos',
            '📱 Navegación Adaptativa: Acceso rápido con botón flotante y menú inferior',
            '✏️ Gestión de Apodos: Cambia alias de miembros y grupos directamente en la tarjeta',
            '🚀 Estabilidad Pro: Mejoras masivas en la fiabilidad de la plataforma y tests E2E',
        ],
    },
    {
        id: '2025-12-29-perfil-e-imagenes',
        release: '1.1.0',
        date: '2025-12-29',
        changes: [
            '👤 Edición de perfil: Ahora puedes cambiar tu nombre y avatar',
            '🔖 Persistencia de pestañas: La aplicación recuerda en qué pestaña estabas',
            '📸 Imágenes en deseos: Sube fotos directamente desde tu dispositivo',
            '🔢 Ordenamiento avanzado: Clasifica tus deseos por prioridad o precio',
            '💶 Mejoras visuales: Mayor claridad en precios y símbolos de moneda',
            '🛠️ Mejoras de estabilidad y corrección de errores en pruebas E2E',
        ],
    },
    {
        id: '2025-12-11-lanzamiento',
        release: '1.0.0',
        date: '2025-12-11',
        changes: [
            '🎉 ¡Lanzamiento oficial de Muro de Deseos!',
            '👥 Crea grupos y comparte con amigos y familia',
            '✨ Asigna apodos personalizados a los miembros del grupo',
            '🎁 Gestiona tu lista de deseos privada',
            '🔄 Actualizaciones en tiempo real',
        ],
    },
];

/** Clave de `localStorage` donde el dispositivo recuerda la última entrada que vio. */
export const LAST_SEEN_UPDATE_ID_KEY = 'lastSeenUpdateId';

/**
 * La entrada más nueva, o `null` si la lista está vacía. Devuelve `null` y no `undefined` para
 * que el tipo no mienta: quien la consuma tiene que decidir qué hacer sin novedades.
 */
export function getLatestUpdate(): AppUpdate | null {
    return updates[0] ?? null;
}

/**
 * ¿Hay algo que anunciar? Sí cuando hay entrada y el dispositivo **no vio esa entrada**.
 *
 * `lastSeenId` se compara contra el `id` y nunca contra `release`: dos entradas pueden compartir
 * etiqueta y aun así ser novedades distintas.
 */
export function shouldAnnounceUpdate(latest: AppUpdate | null, lastSeenId: string | null): boolean {
    return latest !== null && latest.id !== lastSeenId;
}
