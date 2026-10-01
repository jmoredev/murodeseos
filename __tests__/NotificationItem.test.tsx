import { render, screen } from '@testing-library/react'
import { NotificationItem } from '@/components/NotificationItem'
import { describe, it, expect, vi } from 'vitest'
import type { Notification } from '@/lib/notification-utils'

const baseNotification: Notification = {
    id: 'n1',
    user_id: 'user-1',
    actor_id: 'actor-1',
    type: 'birthday',
    is_read: false,
    created_at: new Date().toISOString(),
    actor: {
        display_name: 'Ana García',
        avatar_url: '',
    },
    group: {
        name: 'Familia',
    },
}

const renderNotification = (overrides: Partial<Notification> = {}) =>
    render(
        <NotificationItem
            notification={{ ...baseNotification, ...overrides }}
            onClick={vi.fn()}
        />
    )

describe('NotificationItem', () => {
    it('muestra la notificación de cumpleaños con el nombre del homenajeado', () => {
        renderNotification()

        // El nombre del homenajeado aparece en el contenido renderizado.
        expect(
            screen.getByText(
                (_, element) =>
                    element?.tagName === 'P' &&
                    element.textContent === 'Ana García cumple años pronto en Familia.'
            )
        ).toBeInTheDocument()
    })

    it('expone el resumen como nombre accesible en las notificaciones de cumpleaños', () => {
        renderNotification()

        const button = screen.getByRole('button', {
            name: 'Ana García cumple años pronto en Familia',
        })
        // El aria-label es el único texto que lee un lector de pantalla: debe
        // coincidir exactamente con el resumen completo.
        expect(button).toHaveAttribute('aria-label', 'Ana García cumple años pronto en Familia')
    })

    it('muestra la notificación de onomástico con el nombre del homenajeado', () => {
        renderNotification({ type: 'name_day' })

        expect(
            screen.getByText(
                (_, element) =>
                    element?.tagName === 'P' &&
                    element.textContent === 'Ana García celebra su onomástica pronto en Familia.'
            )
        ).toBeInTheDocument()
    })

    it('expone el resumen como nombre accesible en las notificaciones de onomástico', () => {
        renderNotification({ type: 'name_day' })

        expect(
            screen.getByRole('button', {
                name: 'Ana García celebra su onomástica pronto en Familia',
            })
        ).toHaveAttribute('aria-label', 'Ana García celebra su onomástica pronto en Familia')
    })

    it('mantiene el texto por defecto para un tipo desconocido o antiguo', () => {
        // Tipo fuera de la unión conocida: el caso `default` debe seguir igual.
        renderNotification({ type: 'legacy_unknown' as unknown as Notification['type'] })

        expect(
            screen.getByText(
                (_, element) =>
                    element?.tagName === 'P' && element.textContent === 'Notificación'
            )
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Notificación' })).toHaveAttribute(
            'aria-label',
            'Notificación'
        )
    })
})
