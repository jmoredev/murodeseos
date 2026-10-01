import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationMenu } from '@/components/NotificationMenu';
import { getNotifications, markAsRead, markAllAsRead } from '@/lib/notification-utils';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock local: sólo NotificationMenu necesita la suscripción realtime
// (`channel/on/subscribe` + `removeChannel`), así que no toca el mock global
// de `vitest.setup.ts`.
vi.mock('@/lib/supabase', () => ({
    supabase: {
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn(),
        })),
        removeChannel: vi.fn(),
    },
}));

vi.mock('@/lib/notification-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/notification-utils')>();
    return {
        ...actual,
        getNotifications: vi.fn(),
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
    };
});

const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

function setWindowWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

const notifications = [
    { id: '1', user_id: 'user-1', actor_id: 'actor-1', type: 'wish_added', is_read: false, created_at: new Date().toISOString() },
    { id: '2', user_id: 'user-1', actor_id: 'actor-2', type: 'wish_reserved', is_read: true, created_at: new Date().toISOString() },
] as any[];

async function openMenu() {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Ver notificaciones' }));
    });
}

describe('NotificationMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getNotifications).mockResolvedValue(notifications);
        vi.mocked(markAsRead).mockResolvedValue(undefined as any);
        vi.mocked(markAllAsRead).mockResolvedValue(undefined as any);
    });

    afterEach(() => {
        if (originalInnerWidth) {
            Object.defineProperty(window, 'innerWidth', originalInnerWidth);
        } else {
            delete (window as any).innerWidth;
        }
    });

    it('renders the mobile full-screen portal in the 640-768 band (700px)', async () => {
        setWindowWidth(700);
        render(<NotificationMenu userId="user-1" />);
        await openMenu();

        // Variante móvil: pantalla completa con botón de cierre propio.
        expect(screen.getByRole('button', { name: 'Cerrar notificaciones' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
        // La variante de escritorio no debe aparecer.
        expect(screen.queryByText('Sólo las últimas 20')).not.toBeInTheDocument();
    });

    it('renders the mobile branch at exactly 768px (breakpoint is > 768)', async () => {
        setWindowWidth(768);
        render(<NotificationMenu userId="user-1" />);
        await openMenu();

        expect(screen.getByRole('button', { name: 'Cerrar notificaciones' })).toBeInTheDocument();
        expect(screen.queryByText('Sólo las últimas 20')).not.toBeInTheDocument();
    });

    it('renders the desktop floating dropdown above 768px (1024px)', async () => {
        setWindowWidth(1024);
        render(<NotificationMenu userId="user-1" />);
        await openMenu();

        // Variante escritorio: bocadillo flotante con pie de recorte.
        await waitFor(() => {
            expect(screen.getByText('Sólo las últimas 20')).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: 'Leer todas' })).toBeInTheDocument();
        // La variante móvil no debe aparecer.
        expect(screen.queryByRole('button', { name: 'Cerrar notificaciones' })).not.toBeInTheDocument();
    });

    it('switches to the mobile branch when the window is resized below the breakpoint while open', async () => {
        setWindowWidth(1024);
        render(<NotificationMenu userId="user-1" />);
        await openMenu();
        await waitFor(() => {
            expect(screen.getByText('Sólo las últimas 20')).toBeInTheDocument();
        });

        setWindowWidth(700);
        await act(async () => {
            window.dispatchEvent(new Event('resize'));
        });

        expect(screen.getByRole('button', { name: 'Cerrar notificaciones' })).toBeInTheDocument();
        expect(screen.queryByText('Sólo las últimas 20')).not.toBeInTheDocument();
    });
});
