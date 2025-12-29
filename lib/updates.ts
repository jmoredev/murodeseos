export interface AppUpdate {
    version: string;
    date: string;
    changes: string[];
}

export const updates: AppUpdate[] = [
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
