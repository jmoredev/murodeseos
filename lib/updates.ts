export interface AppUpdate {
    version: string;
    date: string;
    changes: string[];
}

export const updates: AppUpdate[] = [
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
