import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WishlistCard, GiftItem } from '@/components/WishlistCard';
import { vi, describe, it, expect, beforeEach } from 'vitest';

/**
 * El código de la tarjeta, en texto, para afirmar las **reglas de estilo** donde
 * viven. Hace falta porque nativewind **compila** las clases: en el DOM no queda
 * `shrink-0`, sino una clase atómica generada, así que buscar la clase en el
 * elemento renderizado es buscar donde la regla no está. Es el mismo patrón que
 * usan `contrast-floor` y `typography-floor`: la regla se lee del código y su
 * **efecto** se mide en el navegador (aquí, el E2E a 360px con el precio más
 * largo posible).
 */
const CARD_SOURCE = fs.readFileSync(path.resolve(process.cwd(), 'components/WishlistCard.tsx'), 'utf8');

/**
 * El `className` que sigue a un `testID` en el código, que es donde vive la regla de
 * estilo. Se delimita por el testID y el **cierre de su etiqueta**; antes era una
 * **ventana fija** (`slice(0, 200)`), y una ventana de N caracteres puede incluir o
 * excluir cosas por accidente si alguien reordena los atributos o alarga las clases.
 */
function claseDeLaEtiqueta(source: string, testID: string): string {
    const desde = source.indexOf(testID);
    if (desde === -1) throw new Error(`El testID ${testID} no está en el código`);

    const etiqueta = source.slice(desde, finDeLaEtiqueta(source, desde));
    return etiqueta.match(/className=\{?[`"]([^`"]*)[`"]/)?.[1] ?? '';
}

/**
 * Dónde cierra la etiqueta que empieza en `desde`: el primer `>` que **no** sea parte de
 * una flecha. Buscar solo el primer `>` parece lo mismo y no lo es — en el botón hay un
 * `onPress={() => {` antes del `className`, así que cortaba dentro del manejador y no
 * llegaba a leer la clase.
 */
function finDeLaEtiqueta(source: string, desde: number): number {
    for (let i = desde; i < source.length; i += 1) {
        if (source[i] === '>' && source[i - 1] !== '=') return i;
    }
    return source.length;
}

describe('WishlistCard', () => {
    const mockItem: GiftItem = {
        id: '1',
        title: 'Test Gift',
        links: ['https://example.com'],
        imageUrl: 'https://example.com/image.jpg',
        price: 25,
        notes: 'Some notes',
        priority: 'high',
        reservationState: 'available'
    };

    const mockOnClick = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly with all props', () => {
        render(<WishlistCard item={mockItem} isOwner={true} onClick={mockOnClick} />);

        expect(screen.getByText('Test Gift')).toBeInTheDocument();
        expect(screen.getByText('Some notes')).toBeInTheDocument();
        // Priority badge
        expect(screen.getByText(/Prioridad Alta/i)).toBeInTheDocument();
        // Enlace recortado y clickeable
        expect(screen.getByRole('link', { name: /example\.com/i })).toBeInTheDocument();
        // Tarjeta clickeable: el nombre accesible es título + prioridad + precio,
        // así que se busca por subcadena y no por igualdad exacta.
        expect(screen.getByLabelText(new RegExp(mockItem.title))).toBeInTheDocument();
    });

    it('formats price with Euro symbol correctly', () => {
        render(<WishlistCard item={mockItem} isOwner={true} />);
        expect(screen.getByText('25,00 €')).toBeInTheDocument();
    });

    it('pinta un precio de 0 como precio y no como ausencia', () => {
        // Cambio de contrato al pasar a número: `'0'` era verdadero y `''` falso,
        // pero con un número el `0` es falso, así que una comprobación de veracidad
        // habría escondido un precio real detrás de «Sin precio».
        render(<WishlistCard item={{ ...mockItem, price: 0 }} isOwner={true} />);
        expect(screen.getByText('0,00 €')).toBeInTheDocument();
        expect(screen.queryByText('Sin precio')).not.toBeInTheDocument();
    });

    it('anuncia el precio con el mismo símbolo de euro que el texto visible', () => {
        // Control negativo de la revisión R3-a11y-price, corregido de raíz: el
        // precio accesible vivía en `accessibilityValue`, que react-native-web
        // **ignora** en un `role="button"` (no emite `aria-valuetext`), así que no
        // llegaba al DOM en absoluto. Ahora viaja en el nombre accesible con el
        // mismo «€» del texto visible.
        render(<WishlistCard item={mockItem} isOwner={true} />);
        const label = screen
            .getByTestId(`wishlist-card-${mockItem.id}`)
            .querySelector('[aria-label]')
            ?.getAttribute('aria-label');

        expect(label).toContain('25,00 €');
    });

    it('displays "Sin precio" when price is missing', () => {
        const itemWithoutPrice = { ...mockItem, price: undefined };
        render(<WishlistCard item={itemWithoutPrice} isOwner={true} />);
        expect(screen.getByText('Sin precio')).toBeInTheDocument();
    });

    it('renders different priority badges', () => {
        const lowPriorityItem: GiftItem = { ...mockItem, priority: 'low' };
        const { rerender } = render(<WishlistCard item={lowPriorityItem} isOwner={true} />);
        expect(screen.getByText(/Prioridad Baja/i)).toBeInTheDocument();

        const mediumPriorityItem: GiftItem = { ...mockItem, priority: 'medium' };
        rerender(<WishlistCard item={mediumPriorityItem} isOwner={true} />);
        expect(screen.getByText(/Prioridad Media/i)).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        render(<WishlistCard item={mockItem} isOwner={true} onClick={mockOnClick} />);

        fireEvent.click(screen.getByText('Test Gift'));
        expect(mockOnClick).toHaveBeenCalledWith(mockItem);
    });

    it('does not call onClick when reserving', () => {
        const onReserve = vi.fn();
        render(
            <WishlistCard
                item={{ ...mockItem, reservationState: 'available' }}
                isOwner={false}
                onClick={mockOnClick}
                onReserve={onReserve}
            />
        );

        fireEvent.click(screen.getByTestId('wish-reserve-button'));
        expect(onReserve).toHaveBeenCalledWith(expect.objectContaining({ id: mockItem.id }));
        expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('renders the reserved state for a viewer when another user reserved it', () => {
        // El check del chip de reserva es un icono (sin texto accesible propio):
        // la etiqueta «Reservado por ti» es el texto que queda junto al icono.
        const onReserve = vi.fn();
        render(
            <WishlistCard
                item={{ ...mockItem, reservationState: 'reserved_by_other' }}
                isOwner={false}
                onReserve={onReserve}
            />
        );

        expect(screen.getByText('🔒 Reservado')).toBeInTheDocument();
        expect(screen.getByText('No disponible')).toBeInTheDocument();
        expect(screen.queryByTestId('wish-reserve-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('wish-cancel-reserve-button')).not.toBeInTheDocument();
    });

    it('renders the mine state and cancel action for a viewer who reserved it', () => {
        const onCancelReserve = vi.fn();
        render(
            <WishlistCard
                item={{ ...mockItem, reservationState: 'reserved_by_me' }}
                isOwner={false}
                onCancelReserve={onCancelReserve}
            />
        );

        // El «✓ Reservado por ti» original era un único <Text> con el glifo y la
        // etiqueta; ahora el check es un icono y la etiqueta un texto propio.
        expect(screen.getByText('Reservado por ti')).toBeInTheDocument();
        expect(screen.getByTestId('wish-cancel-reserve-button')).toBeInTheDocument();
        expect(screen.queryByTestId('wish-reserve-button')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('wish-cancel-reserve-button'));
        expect(onCancelReserve).toHaveBeenCalledWith(expect.objectContaining({ id: mockItem.id }));
    });

    it('el chip del precio no cede y la fila de chips envuelve', () => {
        // La regla, en el código: el precio `shrink-0` (no se encoge nunca) y la fila
        // `flex-wrap` (si no caben juntos, el enlace baja de línea). Antes los dos
        // chips encogían y el que se recortaba era el precio.
        expect(CARD_SOURCE).toContain('flex-row flex-wrap items-center justify-between');
        const claseDelPrecio = claseDeLaEtiqueta(CARD_SOURCE, 'wish-price-');
        expect(claseDelPrecio).toContain('shrink-0');
        expect(claseDelPrecio).not.toContain('shrink ');

        // Y en el DOM, que el chip existe y pinta el precio entero (formato español).
        render(<WishlistCard item={mockItem} isOwner={true} />);
        const chip = screen.getByTestId(`wish-price-${mockItem.id}`);
        expect(chip).toHaveTextContent('25,00 €');
    });

    it('el enlace es un botón con el dominio y dice a dónde va', () => {
        render(<WishlistCard item={{ ...mockItem, links: ['https://www.amazon.es/dp/B0EXAMPLE'] }} isOwner={true} />);

        const link = screen.getByLabelText(/Abrir enlace: amazon\.es/);
        // Se ve el dominio, nunca la URL: el enlace real no se pinta.
        expect(link).toHaveTextContent('amazon.es');
        expect(link).not.toHaveTextContent('https://');
    });

    it('«Ya lo tengo» tiene forma de botón, no de enlace suelto', () => {
        // La forma, en el código: la MISMA que el botón secundario de la app
        // («Cancelar reserva»). Antes no tenía ni fondo ni borde.
        const claseDelBoton = claseDeLaEtiqueta(CARD_SOURCE, 'wish-already-have');
        expect(claseDelBoton).toContain('bg-surface-container-high');
        expect(claseDelBoton).toContain('rounded-full');
        expect(claseDelBoton).toContain('min-h-[44px]');

        // Y en el DOM sigue siendo el botón que borra (o marca) el deseo, con su etiqueta.
        const onDelete = vi.fn();
        render(<WishlistCard item={mockItem} isOwner={true} onDelete={onDelete} />);
        const boton = screen.getByTestId('wish-already-have');
        expect(boton).toHaveAccessibleName('Marcar como ya lo tengo');
        fireEvent.click(boton);
        expect(onDelete).toHaveBeenCalledWith(mockItem);
    });
});
