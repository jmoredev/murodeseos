import React, { useEffect } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import {
    TourTargetProvider,
    useTourTargetRegistry,
} from '@/components/tour/TourTargetProvider';
import type { TargetRegistry } from '@/lib/tour/targets';

/**
 * Las pestañas llevan ahora los objetivos del tour esparcidos en cada `Pressable` (S7). Este test
 * existe para lo que **no** puede cambiar con eso:
 *
 * 1. La semántica de pestañas: en escritorio, una `tablist` con `role="tab"` y `aria-selected`; en
 *    móvil, botones con `accessibilityState.selected`. Es lo que usan los lectores de pantalla y lo
 *    que T7 necesita para el dock, así que una props de más no puede haberlo pisado.
 * 2. Que las dos formas registren los tres ids: el guion del tour no sabe si está en un móvil o en
 *    un escritorio, y el hueco tiene que encontrar la pestaña que de verdad está en pantalla.
 */

const RAIZ = 'muro';

// `ResponsiveLayout` monta el menú de notificaciones, que abre un canal de realtime y pide las
// notificaciones al montar. Aquí no se prueba nada de eso —ya tiene sus propios tests—, así que se
// sustituye por dobles locales para que la pantalla se pinte sin red.
vi.mock('@/lib/supabase', () => ({
    supabase: {
        channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
        removeChannel: vi.fn(),
    },
}));

vi.mock('@/lib/notification-utils', () => ({
    getNotifications: vi.fn(async () => []),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
}));

vi.mock('@/lib/reminder-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/reminder-utils')>();

    return { ...actual, ensureBirthdayReminders: vi.fn(async () => {}) };
});

const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

function anchoDeVentana(width: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

afterEach(() => {
    if (originalInnerWidth) {
        Object.defineProperty(window, 'innerWidth', originalInnerWidth);
    } else {
        delete (window as unknown as Record<string, unknown>).innerWidth;
    }
});

/** Deja el registro del proveedor a mano del test, sin preguntar por dentro de la pantalla. */
function SondaDeRegistro({ registroRef }: { registroRef: { current: TargetRegistry | null } }) {
    const registro = useTourTargetRegistry();

    useEffect(() => {
        registroRef.current = registro;
    }, [registroRef, registro]);

    return null;
}

function Pintar({
    registroRef,
    onCambiarPestana = vi.fn(),
}: {
    registroRef: { current: TargetRegistry | null };
    onCambiarPestana?: (tab: 'wishlist' | 'groups' | 'profile') => void;
}) {
    return (
        <TourTargetProvider>
            <SondaDeRegistro registroRef={registroRef} />
            <ResponsiveLayout
                userId="user-1"
                activeTab="wishlist"
                setActiveTab={onCambiarPestana}
                onSignOut={vi.fn()}
            >
                <div>{RAIZ}</div>
            </ResponsiveLayout>
        </TourTargetProvider>
    );
}

describe('ResponsiveLayout: la tablist de escritorio sigue siendo la de siempre', () => {
    it('mantiene los roles de pestaña y marca la activa', async () => {
        anchoDeVentana(1280);
        const { container } = render(<Pintar registroRef={{ current: null }} />);

        expect(screen.getByRole('tablist', { name: 'Secciones principales' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Mis deseos' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'Mis grupos' })).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByRole('tab', { name: 'Mi perfil' })).toHaveAttribute('aria-selected', 'false');

        // El contenido sigue donde estaba.
        expect(container.textContent).toContain(RAIZ);
    });

    it('registra los tres objetivos del dock de escritorio', async () => {
        anchoDeVentana(1280);
        const registroRef: { current: TargetRegistry | null } = { current: null };
        render(<Pintar registroRef={registroRef} />);

        await act(async () => {
            await registroRef.current?.refresh();
        });

        for (const id of ['tab-deseos', 'tab-grupos', 'tab-perfil']) {
            expect(registroRef.current?.measure(id), `La pestaña «${id}» no se ha registrado`).not.toBeNull();
        }
    });
});

describe('ResponsiveLayout: el dock de móvil sigue siendo el de siempre', () => {
    it('mantiene los botones con su etiqueta y su toque', async () => {
        anchoDeVentana(375);
        const onCambiarPestana = vi.fn();
        render(<Pintar registroRef={{ current: null }} onCambiarPestana={onCambiarPestana} />);

        expect(screen.queryByRole('tablist')).toBeNull();

        // En móvil las pestañas son botones del dock, con su etiqueta de siempre. Las clases de
        // NativeWind no llegan al DOM en las pruebas (se compilan en el empaquetado), así que lo
        // que se ancla aquí es la semántica que sí se puede leer: el nombre y el toque.
        expect(screen.getByRole('button', { name: 'Mis deseos' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mi perfil' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Mis grupos' }));

        expect(onCambiarPestana).toHaveBeenCalledWith('groups');
    });

    it('registra los tres objetivos del dock de móvil', async () => {
        anchoDeVentana(375);
        const registroRef: { current: TargetRegistry | null } = { current: null };
        render(<Pintar registroRef={registroRef} />);

        await act(async () => {
            await registroRef.current?.refresh();
        });

        for (const id of ['tab-deseos', 'tab-grupos', 'tab-perfil']) {
            expect(registroRef.current?.measure(id), `La pestaña «${id}» no se ha registrado`).not.toBeNull();
        }
    });
});
