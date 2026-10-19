import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WishListTab } from '@/components/WishListTab';
import { supabase } from '@/lib/supabase';
import { takePendingShare } from '@/lib/share-draft';
import { requestProductDraft } from '@/lib/extract-product-client';

// La tarjeta no hace falta para probar el formulario, y montarla traería medio árbol de la app.
vi.mock('@/components/WishlistCard', () => ({
    WishlistCard: () => <div data-testid="wishlist-card" />,
    Priority: { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' },
}));

// El pendiente se dobla por el módulo (lo escribe la ruta `/compartir`, que no está en juego
// acá); la construcción del borrador y la regla de no pisar al usuario se usan **de verdad**.
vi.mock('@/lib/share-draft', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/share-draft')>();
    return { ...actual, takePendingShare: vi.fn() };
});

vi.mock('@/lib/extract-product-client', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/extract-product-client')>();
    return { ...actual, requestProductDraft: vi.fn() };
});

const takePendingShareMock = vi.mocked(takePendingShare);
const requestProductDraftMock = vi.mocked(requestProductDraft);

const QUERY = {
    title: '¿Qué deseas?',
    price: '0,00',
    image: 'URL de la foto (opcional)',
    link: 'https://tienda.com/articulo',
    notes: 'Talla, color, detalles...',
};

const sharePayload = {
    url: 'https://www.amazon.es/dp/B09B8X9RGM',
    title: 'Producto de prueba',
    text: 'Mira esto https://www.amazon.es/dp/B09B8X9RGM',
    createdAt: 1_760_000_000_000,
};

function createMockChain(data: any = [], error: any = null) {
    const chain: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data, error }),
        maybeSingle: vi.fn().mockResolvedValue({ data, error }),
        then(resolve: any) {
            return Promise.resolve({ data, error }).then(resolve);
        },
    };
    return chain;
}

beforeEach(() => {
    vi.clearAllMocks();
    (supabase.from as any).mockImplementation(() => createMockChain([]));
});

describe('formulario prellenado desde un compartir', () => {
    it('abre el deseo con lo que leyó la extracción', async () => {
        takePendingShareMock.mockReturnValue(sharePayload);
        requestProductDraftMock.mockResolvedValue({
            status: 'ok',
            draft: {
                title: 'Lámpara de pie',
                priceText: '89,99',
                imageUrl: 'https://tienda.example/img.jpg',
                notes: 'Una descripción',
            },
        });

        render(<WishListTab userId="user-1" />);

        await waitFor(() => expect(screen.getByPlaceholderText(QUERY.title)).toHaveValue('Lámpara de pie'));
        expect(screen.getByPlaceholderText(QUERY.price)).toHaveValue('89,99');
        expect(screen.getByPlaceholderText(QUERY.link)).toHaveValue(sharePayload.url);
        expect(screen.getByPlaceholderText(QUERY.image)).toHaveValue('https://tienda.example/img.jpg');
        expect(screen.getByPlaceholderText(QUERY.notes)).toHaveValue('Una descripción');
        expect(requestProductDraftMock).toHaveBeenCalledWith(sharePayload.url);
    });

    it('abre el formulario al instante, sin esperar a la red', async () => {
        takePendingShareMock.mockReturnValue(sharePayload);
        // Promesa que no se resuelve: es lo que pasa mientras el servidor lee la página.
        requestProductDraftMock.mockReturnValue(new Promise(() => {}));

        render(<WishListTab userId="user-1" />);

        // El enlace y el título del share ya están; el resto se completará cuando llegue.
        expect(screen.getByPlaceholderText(QUERY.link)).toHaveValue(sharePayload.url);
        expect(screen.getByPlaceholderText(QUERY.title)).toHaveValue('Producto de prueba');
    });

    it('si la extracción falla, el deseo se puede crear igual y se explica por qué', async () => {
        // S2 y S5: una tienda que bloquea no puede impedir crear el deseo. El enlace es el dato
        // que nunca se pierde, y el aviso evita que el usuario crea que la app no hizo nada.
        takePendingShareMock.mockReturnValue(sharePayload);
        requestProductDraftMock.mockResolvedValue({ status: 'unavailable', reason: 'dns-failed' });

        render(<WishListTab userId="user-1" />);

        expect(screen.getByPlaceholderText(QUERY.link)).toHaveValue(sharePayload.url);
        await waitFor(() => expect(screen.getByText(/no pudimos leer/i)).toBeInTheDocument());
        expect(screen.getByPlaceholderText(QUERY.title)).toHaveValue('Producto de prueba');
    });

    it('no pisa lo que el usuario escribió mientras la extracción viajaba', async () => {
        takePendingShareMock.mockReturnValue(sharePayload);
        let resolverExtraccion: (value: any) => void = () => {};
        requestProductDraftMock.mockReturnValue(
            new Promise((resolve) => {
                resolverExtraccion = resolve;
            }) as any,
        );

        render(<WishListTab userId="user-1" />);

        const titleInput = screen.getByPlaceholderText(QUERY.title);
        fireEvent.change(titleInput, { target: { value: 'Mi título' } });

        await act(async () => {
            resolverExtraccion({
                status: 'ok',
                draft: { title: 'Lámpara de pie', priceText: '89,99', imageUrl: null, notes: null },
            });
        });

        expect(screen.getByPlaceholderText(QUERY.title)).toHaveValue('Mi título');
        // El precio no lo tocó nadie, así que entra.
        expect(screen.getByPlaceholderText(QUERY.price)).toHaveValue('89,99');
    });

    it('sin compartir pendiente no abre nada ni llama a la extracción', async () => {
        takePendingShareMock.mockReturnValue(null);

        await act(async () => {
            render(<WishListTab userId="user-1" />);
        });

        expect(screen.queryByPlaceholderText(QUERY.title)).not.toBeInTheDocument();
        expect(requestProductDraftMock).not.toHaveBeenCalled();
    });

    it('un compartir sin enlace abre el formulario con el texto como título', async () => {
        takePendingShareMock.mockReturnValue({ ...sharePayload, url: null, title: '', text: 'Una lámpara' });

        render(<WishListTab userId="user-1" />);

        expect(screen.getByPlaceholderText(QUERY.title)).toHaveValue('Una lámpara');
        expect(screen.getByPlaceholderText(QUERY.link)).toHaveValue('');
        expect(requestProductDraftMock).not.toHaveBeenCalled();
    });

    it('mientras la lista todavía carga no afirma que esté vacía', async () => {
        // El formulario abierto durante la carga es un estado que este feature hace alcanzable:
        // antes, el «Cargando deseos…» tapaba todo hasta que la lista llegaba. Al dejarlo ver, la
        // lista de atrás no puede decir «Tu lista está vacía» —no lo sabe todavía— y menos con el
        // modal transparente del escritorio.
        takePendingShareMock.mockReturnValue(sharePayload);
        requestProductDraftMock.mockReturnValue(new Promise(() => {}));
        const neverResolving = createMockChain([]);
        neverResolving.then = () => new Promise(() => {});
        (supabase.from as any).mockImplementation(() => neverResolving);

        render(<WishListTab userId="user-1" />);

        expect(screen.getByPlaceholderText(QUERY.title)).toHaveValue('Producto de prueba');
        expect(screen.queryByText('Tu lista está vacía')).not.toBeInTheDocument();
    });

    it('el compartir se consume una sola vez: volver a montar la pestaña no reabre el deseo', async () => {
        let pendiente: typeof sharePayload | null = sharePayload;
        takePendingShareMock.mockImplementation(() => {
            const actual = pendiente;
            pendiente = null;
            return actual;
        });
        requestProductDraftMock.mockResolvedValue({
            status: 'ok',
            draft: { title: 'Lámpara', priceText: null, imageUrl: null, notes: null },
        });

        const first = render(<WishListTab userId="user-1" />);
        await waitFor(() => expect(screen.getByPlaceholderText(QUERY.title)).toHaveValue('Lámpara'));
        first.unmount();

        render(<WishListTab userId="user-1" />);

        await waitFor(() => expect(takePendingShareMock).toHaveBeenCalledTimes(2));
        expect(screen.queryByPlaceholderText(QUERY.title)).not.toBeInTheDocument();
        expect(requestProductDraftMock).toHaveBeenCalledTimes(1);
    });
});
