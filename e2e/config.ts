/**
 * Configuración de credenciales y datos para tests E2E
 * Este archivo centraliza todos los datos predecibles del usuario de test
 */

export const E2E_CONFIG = {
    // Credenciales del usuario E2E
    user: {
        email: 'e2e-test@test.com',
        password: 'E2ETest123!',
        displayName: 'E2E Test User',
        avatar: '🤖'
    },
    // Usuario secundario para pruebas de interacción
    secondaryUser: {
        email: 'juan@test.com',
        password: 'Test123!',
        displayName: 'Juan Pérez',
        avatar: '👨‍💻'
    },

    // Grupo E2E
    group: {
        id: 'E2E001',
        name: 'E2E Test Group',
        icon: '🧪'
    },

    // Items de wishlist predecibles
    wishlistItems: [
        {
            title: 'E2E Test Item 1',
            price: '100.00',
            priority: 'high'
        },
        {
            title: 'E2E Test Item 2',
            price: '50.00',
            priority: 'medium'
        },
        {
            title: 'E2E Test Item 3',
            price: '25.00',
            priority: 'low'
        }
    ]
}

// URLs base para tests
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Timeouts para tests
export const TIMEOUTS = {
    navigation: 5000,
    element: 3000,
    api: 10000
}
