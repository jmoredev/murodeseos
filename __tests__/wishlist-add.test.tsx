import React, { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WishlistAddPage from '@/app/wishlist/add/index';
import { takePendingDraft } from '@/lib/share-draft';
import { requestProductDraft } from '@/lib/extract-product-client';

/**
 * La pantalla que decide **si hay enlace** antes de abrir el formulario.
 *
 * Lo que se prueba aquí es lo que gasta recursos del usuario: que un enlace inválido **no** salga
 * a la red, que un doble toque no dispare dos peticiones (cada una gasta cuota) y que lo que se
 * pudo leer llegue al formulario como un borrador pendiente. El doble de la extracción es local;
 * el `sessionStorage` que usa `savePendingDraft` es el real del setup, así que el borrador que se
 * lee al final es el que de verdad queda guardado.
 */

const replace = vi.fn();
const back = vi.fn();
const canGoBack = vi.fn();

// `vi.mock` se eleva por encima de los imports, así que la pantalla recibe estos dobles aunque
// el import esté arriba. La navegación se lee de forma diferida (al renderizar), no al registrar
// el mock. `canGoBack` es lo que decide el camino de vuelta: `back()` a la lista que ya está
// montada, o `replace('/?tab=wishlist')` cuando no hay historial detrás (enlace directo).
vi.mock('expo-router', () => {
    // El doble de `useFocusEffect` **no** es un no-op: apagarlo convierte cualquier efecto de
    // foco en nada y deja sin probar los caminos que dependen de él.
    function useFocusEffectEnfocado(callback: any) {
        useEffect(callback, [callback]);
    }

    return {
        useRouter: () => ({ replace, push: vi.fn(), back, canGoBack, setParams: vi.fn() }),
        useLocalSearchParams: () => ({}),
        useGlobalSearchParams: () => ({}),
        Link: ({ children }: any) => children,
        useFocusEffect: useFocusEffectEnfocado,
        useSegments: () => [],
        usePathname: () => '/wishlist/add',
    };
});

vi.mock('@/lib/extract-product-client', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/extract-product-client')>();
    return { ...actual, requestProductDraft: vi.fn() };
});

const requestProductDraftMock = vi.mocked(requestProductDraft);

const LINK_PLACEHOLDER = 'https://tienda.com/articulo';
/** Pegado sin esquema: es lo que se pega de verdad y lo que se tiene que normalizar. */
const LINK_SIN_ESQUEMA = 'www.amazon.es/dp/B09B8X9RGM';
const LINK_NORMALIZADO = 'https://www.amazon.es/dp/B09B8X9RGM';

function escribirEnlace(value: string) {
    fireEvent.change(screen.getByPlaceholderText(LINK_PLACEHOLDER), { target: { value } });
}

beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // El camino normal es volver a una lista que ya está detrás en el historial.
    canGoBack.mockReturnValue(true);
});

describe('pantalla del enlace del deseo', () => {
    it('con el campo vacío no llama a la extracción y explica las dos salidas', () => {
        render(<WishlistAddPage />);

        fireEvent.click(screen.getByLabelText('Aceptar'));

        // El texto incluye la salida a mano: es la pista que necesita quien no tiene un enlace.
        expect(screen.getByText(/Pega un enlace válido/)).toHaveTextContent('No tengo enlace');
        expect(requestProductDraftMock).not.toHaveBeenCalled();
        expect(back).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
        expect(sessionStorage.getItem('murodeseos:pending-wish-draft')).toBeNull();
    });

    it('con texto que no es una URL tampoco llama a la extracción', () => {
        render(<WishlistAddPage />);

        escribirEnlace('lámpara de pie');
        fireEvent.click(screen.getByLabelText('Aceptar'));

        expect(screen.getByText(/Pega un enlace válido/)).toBeInTheDocument();
        expect(requestProductDraftMock).not.toHaveBeenCalled();
        expect(back).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
    });

    it('con un enlace válido lee la página, deja el borrador lleno y va al formulario', async () => {
        let resolver: (value: unknown) => void = () => {};
        requestProductDraftMock.mockReturnValue(
            new Promise((resolve) => {
                resolver = resolve;
            }) as any,
        );

        render(<WishlistAddPage />);

        escribirEnlace(LINK_SIN_ESQUEMA);
        fireEvent.click(screen.getByLabelText('Aceptar'));

        // Se pide el enlace ya normalizado, que es lo que se va a guardar.
        expect(requestProductDraftMock).toHaveBeenCalledTimes(1);
        expect(requestProductDraftMock).toHaveBeenCalledWith(LINK_NORMALIZADO);
        // Mientras lee se ve qué está pasando y no se puede disparar nada más.
        expect(screen.getByText(/Leyendo/)).toBeInTheDocument();
        expect(screen.getByLabelText('Aceptar')).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByLabelText('No tengo enlace')).toHaveAttribute('aria-disabled', 'true');
        expect(back).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();

        await act(async () => {
            resolver({
                status: 'ok',
                draft: {
                    title: 'Lámpara de pie',
                    priceText: '89,99',
                    imageUrl: 'https://tienda.example/img.jpg',
                },
            });
        });

        expect(takePendingDraft()).toEqual({
            title: 'Lámpara de pie',
            priceText: '89,99',
            imageUrl: 'https://tienda.example/img.jpg',
            links: [LINK_NORMALIZADO],
        });
        // Vuelve a la lista que ya estaba montada: `replace` sobre el índice apilaría una segunda
        // copia de la lista (dos juegos de tarjetas, de fetches y de suscripciones).
        expect(back).toHaveBeenCalledTimes(1);
        expect(replace).not.toHaveBeenCalled();
    });

    it('lo que la extracción no leyó queda como campo vacío en el borrador, no ausente', async () => {
        requestProductDraftMock.mockResolvedValue({
            status: 'ok',
            draft: { title: null, priceText: null, imageUrl: null },
        });

        render(<WishlistAddPage />);

        escribirEnlace(LINK_NORMALIZADO);
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Aceptar'));
        });

        expect(takePendingDraft()).toEqual({
            title: '',
            priceText: '',
            imageUrl: '',
            links: [LINK_NORMALIZADO],
        });
        expect(back).toHaveBeenCalledTimes(1);
        expect(replace).not.toHaveBeenCalled();
    });

    it('si la página no se puede leer se queda con el motivo y el enlace a mano', async () => {
        requestProductDraftMock.mockResolvedValue({ status: 'unavailable', reason: 'dns-failed' });

        render(<WishlistAddPage />);

        escribirEnlace(LINK_NORMALIZADO);
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Aceptar'));
        });

        await waitFor(() => expect(screen.getByText(/No pudimos leer esa página/)).toBeInTheDocument());
        expect(screen.getByText(/No pudimos leer esa página/)).toHaveTextContent(/a mano/i);
        // No se navega: quien decide es el usuario, con el botón de abajo.
        expect(back).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
        expect(sessionStorage.getItem('murodeseos:pending-wish-draft')).toBeNull();

        fireEvent.click(screen.getByLabelText('Continuar a mano'));

        expect(takePendingDraft()).toEqual({ links: [LINK_NORMALIZADO] });
        expect(back).toHaveBeenCalledTimes(1);
        expect(replace).not.toHaveBeenCalled();
    });

    it('la cuota agotada se cuenta como cuota, no como una página ilegible', async () => {
        // Es una espera, no un problema de la tienda: si se dijera «no pudimos leer la página»
        // el usuario cambiaría de enlace en vez de esperar unos minutos.
        requestProductDraftMock.mockResolvedValue({ status: 'unavailable', reason: 'quota-exceeded' });

        render(<WishlistAddPage />);

        escribirEnlace(LINK_NORMALIZADO);
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Aceptar'));
        });

        await waitFor(() => expect(screen.getByText(/unos minutos/i)).toBeInTheDocument());
        expect(screen.queryByText(/No pudimos leer esa página/)).not.toBeInTheDocument();
        expect(back).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
    });

    it('«No tengo enlace» abre el formulario vacío y no sale a la red nunca', async () => {
        render(<WishlistAddPage />);

        // Con un enlace escrito y todo: este botón no lee nada.
        escribirEnlace(LINK_NORMALIZADO);
        fireEvent.click(screen.getByLabelText('No tengo enlace'));

        expect(requestProductDraftMock).not.toHaveBeenCalled();
        // `{}` es un borrador válido: significa «abre el formulario vacío».
        expect(takePendingDraft()).toEqual({});
        expect(back).toHaveBeenCalledTimes(1);
        expect(replace).not.toHaveBeenCalled();
    });

    it('con un enlace directo, sin historial detrás, cae al índice en vez de quedarse sin salida', async () => {
        // Un enlace directo a `/wishlist/add` no tiene lista detrás: `back()` no llevaría a
        // ninguna parte, así que el respaldo es el índice con la pestaña de la lista.
        canGoBack.mockReturnValue(false);

        render(<WishlistAddPage />);

        fireEvent.click(screen.getByLabelText('No tengo enlace'));

        expect(canGoBack).toHaveBeenCalled();
        expect(back).not.toHaveBeenCalled();
        expect(replace).toHaveBeenCalledWith('/?tab=wishlist');
    });

    it('un doble toque durante la lectura no dispara una segunda petición', async () => {
        // Cada petición gasta cuota del usuario, así que la guarda es un tope real, no estético.
        let resolver: (value: unknown) => void = () => {};
        requestProductDraftMock.mockReturnValue(
            new Promise((resolve) => {
                resolver = resolve;
            }) as any,
        );

        render(<WishlistAddPage />);

        escribirEnlace(LINK_NORMALIZADO);
        fireEvent.click(screen.getByLabelText('Aceptar'));
        fireEvent.click(screen.getByLabelText('Aceptar'));
        fireEvent.click(screen.getByLabelText('Aceptar'));

        expect(requestProductDraftMock).toHaveBeenCalledTimes(1);
        expect(back).not.toHaveBeenCalled();

        await act(async () => {
            resolver({ status: 'unavailable', reason: 'quota-exceeded' });
        });
    });
});
