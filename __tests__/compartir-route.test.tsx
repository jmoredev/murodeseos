import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompartirPage from '@/app/compartir/index';
import { takeSharedPayload } from '@/lib/share-target';
import { savePendingShare } from '@/lib/share-draft';

const replace = vi.fn();
let searchParams: Record<string, string> = {};

// `vi.mock` se eleva por encima de los imports, así que la ruta recibe estos dobles aunque el
// import esté arriba. El `replace` y los parámetros se leen de forma diferida (al renderizar),
// no al registrar el mock.
vi.mock('expo-router', () => ({
    useRouter: () => ({ replace, push: vi.fn(), back: vi.fn(), setParams: vi.fn() }),
    useLocalSearchParams: () => searchParams,
    useGlobalSearchParams: () => searchParams,
    Link: ({ children }: any) => children,
    useFocusEffect: vi.fn(),
    useSegments: () => [],
    usePathname: () => '/compartir',
}));

vi.mock('@/lib/share-target', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/share-target')>();
    return { ...actual, takeSharedPayload: vi.fn() };
});

vi.mock('@/lib/share-draft', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/share-draft')>();
    return { ...actual, savePendingShare: vi.fn() };
});

const payload = {
    url: 'https://www.amazon.es/dp/B09B8X9RGM',
    title: 'Producto',
    text: '',
    createdAt: 1_760_000_000_000,
};

const takeSharedPayloadMock = vi.mocked(takeSharedPayload);
const savePendingShareMock = vi.mocked(savePendingShare);

beforeEach(() => {
    vi.clearAllMocks();
    searchParams = {};
});

describe('ruta /compartir', () => {
    it('recoge el compartir y manda a la app, donde el formulario lo va a consumir', async () => {
        searchParams = { share: 'abc123' };
        takeSharedPayloadMock.mockResolvedValue(payload);

        render(<CompartirPage />);

        await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
        expect(takeSharedPayloadMock).toHaveBeenCalledWith('abc123');
        expect(savePendingShareMock).toHaveBeenCalledWith(payload);
    });

    it('sin compartir en la URL no toca la caché y vuelve a la app', async () => {
        searchParams = {};

        render(<CompartirPage />);

        await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
        expect(takeSharedPayloadMock).not.toHaveBeenCalled();
        expect(savePendingShareMock).not.toHaveBeenCalled();
    });

    it('si el compartir ya no está (o quedó ilegible) vuelve a la app sin pendiente', async () => {
        searchParams = { share: 'abc123' };
        takeSharedPayloadMock.mockResolvedValue(null);

        render(<CompartirPage />);

        await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
        expect(savePendingShareMock).not.toHaveBeenCalled();
    });

    it('mientras recoge el compartir muestra que está trabajando, no una pantalla vacía', () => {
        searchParams = { share: 'abc123' };
        // Promesa que no se resuelve: es el estado real mientras la caché responde.
        takeSharedPayloadMock.mockReturnValue(new Promise(() => {}));

        render(<CompartirPage />);

        expect(screen.getByText(/preparando/i)).toBeInTheDocument();
    });
});
