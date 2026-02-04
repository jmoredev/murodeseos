export interface AppUpdate {
    version: string;
    date: string;
    changes: string[];
}

export const updates: AppUpdate[] = [
    {
        version: '1.3.0',
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
        version: '1.2.0',
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
        version: '1.1.0',
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
        version: '1.0.0',
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

export function getLatestUpdate(): AppUpdate {
    return updates[0];
}
