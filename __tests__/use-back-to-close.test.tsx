import React, { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBackToClose } from '@/lib/use-back-to-close';

/**
 * Arnés mínimo, con la misma forma que los modales reales: un estado `abierto` y
 * un cierre. El `onClose` se crea **en línea** a propósito, como hacen
 * `WishListTab` y `WishDetailModal`: si el hook dependiera del callback,
 * re-renderizar empujaría una entrada de historial nueva en cada render.
 */
function ModalDePrueba({ onCerrar }: { onCerrar: () => void }) {
    const [abierto, setAbierto] = useState(false);
    useBackToClose(abierto, () => {
        setAbierto(false);
        onCerrar();
    });

    return (
        <div>
            <button onClick={() => setAbierto(true)}>abrir</button>
            <button onClick={() => setAbierto(false)}>cerrar con la X</button>
            <span data-testid="estado">{abierto ? 'abierto' : 'cerrado'}</span>
        </div>
    );
}

/**
 * Simula lo que hace el navegador con un gesto de atrás: **la entrada que estaba
 * en la cima se consume**, así que el historial deja de tener nuestra marca y solo
 * despues llega el `popstate`. Sin esto el arnés miente sobre la plataforma: el
 * hook pregunta al historial, no recuerda nada.
 */
function gestoDeAtras() {
    window.history.replaceState(null, '');
    window.dispatchEvent(new PopStateEvent('popstate'));
}

describe('useBackToClose: el gesto de atrás cierra lo que abriste', () => {
    let pushState: ReturnType<typeof vi.spyOn>;
    let back: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Aislar cada caso: el historial de jsdom es global al fichero.
        window.history.replaceState(null, '');
        pushState = vi.spyOn(window.history, 'pushState');
        back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('abrir empuja UNA entrada de historial', () => {
        render(<ModalDePrueba onCerrar={vi.fn()} />);

        fireEvent.click(screen.getByText('abrir'));

        expect(screen.getByTestId('estado').textContent).toBe('abierto');
        expect(pushState).toHaveBeenCalledTimes(1);
    });

    it('re-renderizar mientras está abierto NO empuja otra entrada', () => {
        // El fallo clásico de este patrón: un callback en las dependencias del
        // efecto hace que cada render empuje otra entrada y el gesto necesite
        // varios toques de atrás para cerrar.
        const { rerender } = render(<ModalDePrueba onCerrar={vi.fn()} />);
        fireEvent.click(screen.getByText('abrir'));
        expect(pushState).toHaveBeenCalledTimes(1);

        // Varios renders con el modal abierto…
        for (let i = 0; i < 3; i++) rerender(<ModalDePrueba onCerrar={vi.fn()} />);

        // …y sigue habiendo UNA sola entrada.
        expect(pushState).toHaveBeenCalledTimes(1);
    });

    it('el gesto de atrás CIERRA el modal, en vez de salir de la app', () => {
        const onCerrar = vi.fn();
        render(<ModalDePrueba onCerrar={onCerrar} />);
        fireEvent.click(screen.getByText('abrir'));

        act(() => {
            gestoDeAtras();
        });

        expect(screen.getByTestId('estado').textContent).toBe('cerrado');
        expect(onCerrar).toHaveBeenCalledTimes(1);
        // El gesto ya consumió la entrada: no hay que retirar nada.
        expect(back).not.toHaveBeenCalled();
    });

    it('cerrar con la X no retira la entrada: la reutiliza el modal siguiente', () => {
        // Antes se llamaba a `history.back()` para retirarla, y ese back abría una
        // carrera: es asíncrono e **indistinguible** de un gesto, así que si el
        // usuario abría otro modal entre medias, su `popstate` lo cerraba solo
        // (CRITICAL del refutador). Sin back interno no hay carrera posible; el
        // precio es un toque de atrás que no hace nada, y se acepta.
        render(<ModalDePrueba onCerrar={vi.fn()} />);
        fireEvent.click(screen.getByText('abrir'));
        expect(pushState).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByText('cerrar con la X'));

        expect(screen.getByTestId('estado').textContent).toBe('cerrado');
        expect(back).not.toHaveBeenCalled();

        // Y el modal siguiente reutiliza la entrada que quedó, sin empujar otra.
        fireEvent.click(screen.getByText('abrir'));
        expect(pushState).toHaveBeenCalledTimes(1);
    });

    it('un gesto con la capa vacía consume la entrada gastada y no cierra nada', () => {
        render(<ModalDePrueba onCerrar={vi.fn()} />);
        fireEvent.click(screen.getByText('abrir'));
        fireEvent.click(screen.getByText('cerrar con la X'));

        act(() => {
            gestoDeAtras();
        });

        // No hay capa: el gesto se lleva la entrada gastada y no cierra nada.
        expect(back).not.toHaveBeenCalled();
        expect(screen.getByTestId('estado').textContent).toBe('cerrado');

        // Y a partir de aqui el modal siguiente abre entrada propia, porque la
        // gastada ya se consumió.
        fireEvent.click(screen.getByText('abrir'));
        expect(pushState).toHaveBeenCalledTimes(2);
    });

    it('si no está abierto, no toca el historial', () => {
        render(<ModalDePrueba onCerrar={vi.fn()} />);

        expect(pushState).not.toHaveBeenCalled();
        expect(back).not.toHaveBeenCalled();
    });
});

/**
 * Dos hallazgos CRITICAL de la revisión nativa, los dos reales:
 *
 * - `R3-001`: cada instancia añadía su propio `popstate` sin coordinarse. Con dos
 *   modales abiertos, **un** gesto cerraba **los dos** (todos los escuchadores
 *   atendían el mismo evento), y cerrar uno con la ✕ llamaba a `history.back()`,
 *   cuyo `popstate` cerraba el otro sin querer.
 * - `R3-002`: si el llamador no podía cerrar (guardando), el hook daba el gesto
 *   por consumido igualmente y no reponía la entrada, así que **el siguiente
 *   atrás salía de la aplicación**: el arreglo se anulaba a sí mismo.
 */
describe('useBackToClose con varios modales y con un cierre que no puede ocurrir', () => {
    let pushState: ReturnType<typeof vi.spyOn>;
    let back: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        window.history.replaceState(null, '');
        pushState = vi.spyOn(window.history, 'pushState');
        back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function DosModales({ onCerrarArriba, onCerrarAbajo }: { onCerrarArriba: () => void; onCerrarAbajo: () => void }) {
        const [abajo, setAbajo] = useState(false);
        const [arriba, setArriba] = useState(false);
        useBackToClose(abajo, () => {
            setAbajo(false);
            onCerrarAbajo();
        });
        useBackToClose(arriba, () => {
            setArriba(false);
            onCerrarArriba();
        });
        return (
            <div>
                <button onClick={() => setAbajo(true)}>abrir abajo</button>
                <button onClick={() => setArriba(true)}>abrir arriba</button>
                <span data-testid="abajo">{abajo ? 'abierto' : 'cerrado'}</span>
                <span data-testid="arriba">{arriba ? 'abierto' : 'cerrado'}</span>
            </div>
        );
    }

    it('con dos modales abiertos, UN gesto cierra sólo el de arriba', () => {
        const cerrarAbajo = vi.fn();
        const cerrarArriba = vi.fn();
        render(<DosModales onCerrarAbajo={cerrarAbajo} onCerrarArriba={cerrarArriba} />);
        fireEvent.click(screen.getByText('abrir abajo'));
        fireEvent.click(screen.getByText('abrir arriba'));

        act(() => {
            gestoDeAtras();
        });

        // El de arriba se cierra; el de abajo NO.
        expect(screen.getByTestId('arriba').textContent).toBe('cerrado');
        expect(screen.getByTestId('abajo').textContent).toBe('abierto');
        expect(cerrarArriba).toHaveBeenCalledTimes(1);
        expect(cerrarAbajo).not.toHaveBeenCalled();

        // Y el gesto siguiente cierra el que queda, sin salir de la aplicación.
        act(() => {
            gestoDeAtras();
        });
        expect(screen.getByTestId('abajo').textContent).toBe('cerrado');
        expect(cerrarAbajo).toHaveBeenCalledTimes(1);
    });

    function ModalQueNoPuedeCerrar({ onIntento }: { onIntento: () => void }) {
        const [abierto, setAbierto] = useState(false);
        const [noPuedeCerrar, setNoPuedeCerrar] = useState(false);
        useBackToClose(abierto, () => {
            onIntento();
            if (noPuedeCerrar) return false;
            setAbierto(false);
            return true;
        });
        return (
            <div>
                <button onClick={() => setAbierto(true)}>abrir</button>
                <button onClick={() => setNoPuedeCerrar(true)}>poner a guardar</button>
                <span data-testid="estado">{abierto ? 'abierto' : 'cerrado'}</span>
            </div>
        );
    }

    it('si el cierre no puede ocurrir, la entrada se repone y el modal sigue abierto', async () => {
        // El caso real: guardando, la ✕ no cierra (y el atrás nativo tampoco).
        // Sin reponer la entrada, el gesto se da por consumido y el SIGUIENTE
        // atrás sale de la aplicación.
        const intento = vi.fn();
        render(<ModalQueNoPuedeCerrar onIntento={intento} />);
        fireEvent.click(screen.getByText('abrir'));
        fireEvent.click(screen.getByText('poner a guardar'));
        expect(pushState).toHaveBeenCalledTimes(1);

        act(() => {
            gestoDeAtras();
        });

        expect(intento).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('estado').textContent).toBe('abierto');

        // La reposición es deliberadamente diferida: React aplica el cierre de forma
        // asíncrona y hasta el siguiente turno no se sabe si hay capa que mantener.
        await vi.waitFor(() => {
            expect(pushState).toHaveBeenCalledTimes(2);
        });
    });

    it('el cierre con la X deja la entrada a reutilizar, sin back interno', () => {
        // El arreglo del CRITICAL del refutador, dicho como contrato: **no hay
        // `history.back()` interno**. Su `popstate` era indistinguible de un gesto y
        // podía cerrar el modal que el usuario acabara de abrir.
        const cerrar = vi.fn();
        render(<ModalDePrueba onCerrar={cerrar} />);

        fireEvent.click(screen.getByText('abrir'));
        fireEvent.click(screen.getByText('cerrar con la X'));

        expect(back).not.toHaveBeenCalled();

        // Aunque alguien dispare un `popstate` después (como haría el navegador si
        // hubiéramos retrocedido), no hay ningún modal que cerrar.
        act(() => {
            gestoDeAtras();
        });
        expect(cerrar).not.toHaveBeenCalled();
    });
});
