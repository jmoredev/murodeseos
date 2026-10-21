import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import WhatsNewModal from '@/components/WhatsNewModal';
import { LAST_SEEN_UPDATE_ID_KEY, getLatestUpdate } from '@/lib/updates';

/**
 * El cableado del modal, no solo la regla: `shouldAnnounceUpdate` se prueba sola en
 * `updates.test.ts`, y acá se prueba que el componente la use y que guarde el `id`.
 *
 * El e2e cubre lo mismo en un navegador de verdad, pero necesita el stack local; este test corre
 * sin nada levantado y por eso es la red que queda cuando el e2e no se puede ejecutar.
 */
const latest = getLatestUpdate();

/**
 * `localStorage` no existe en este entorno: Node define un global que queda deshabilitado sin
 * `--localstorage-file`, y el setup del repo solo mockea `sessionStorage`. Se define acá, en el
 * ámbito del archivo, antes de que el componente lea nada.
 */
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = String(value);
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
    };
})();

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
});

describe('WhatsNewModal', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('se abre la primera vez, muestra la release de la entrada y guarda su id al cerrarse', async () => {
        const user = userEvent.setup();
        render(<WhatsNewModal />);

        const dialogo = screen.getByRole('dialog');
        expect(dialogo).toBeInTheDocument();
        expect(screen.getByText('Novedades')).toBeInTheDocument();
        expect(screen.getByText(`v${latest?.release}`)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '¡Entendido!' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(localStorage.getItem(LAST_SEEN_UPDATE_ID_KEY)).toBe(latest?.id);
    });

    it('no se abre cuando el dispositivo ya vio esta misma entrada', () => {
        localStorage.setItem(LAST_SEEN_UPDATE_ID_KEY, latest?.id ?? '');

        render(<WhatsNewModal />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('se abre cuando el dispositivo vio otra entrada anterior', () => {
        localStorage.setItem(LAST_SEEN_UPDATE_ID_KEY, '2025-12-11-lanzamiento');

        render(<WhatsNewModal />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
