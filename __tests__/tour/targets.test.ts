import { describe, expect, it, vi } from 'vitest';
import { createTargetRegistry, type TargetRect } from '../../lib/tour/targets';

/**
 * El registro de objetivos es una tienda normal, sin React: guarda «cómo se mide» cada objetivo y
 * la última medida conocida, y avisa a quien escucha cuando esa medida cambia. Aquí no se monta
 * nada; el overlay sólo leerá lo que este módulo ya guardó.
 */

const RECT: TargetRect = { x: 10, y: 20, width: 100, height: 40 };

describe('createTargetRegistry', () => {
    it('sin nada registrado, medir devuelve null', () => {
        const registro = createTargetRegistry();

        expect(registro.measure('tab-deseos')).toBeNull();
    });

    it('registrar no mide por su cuenta: la medida llega cuando se refresca', async () => {
        const registro = createTargetRegistry();

        registro.register('tab-deseos', () => RECT);

        // Registrado pero aún sin medir: el hueco todavía no existe, y el overlay lo sabrá.
        expect(registro.measure('tab-deseos')).toBeNull();

        await registro.refresh('tab-deseos');

        expect(registro.measure('tab-deseos')).toEqual(RECT);
    });

    it('un objetivo que no se puede medir se queda en null y no rompe', async () => {
        const registro = createTargetRegistry();

        registro.register('tab-deseos', () => null);
        await registro.refresh('tab-deseos');

        expect(registro.measure('tab-deseos')).toBeNull();
        // Un identificador que nadie registró tampoco es un error: puede llegar antes que la pantalla.
        await expect(registro.refresh('tab-perfil')).resolves.toBeUndefined();
        expect(registro.measure('tab-perfil')).toBeNull();
    });

    it('una medida con números imposibles se descarta', async () => {
        const registro = createTargetRegistry();

        registro.register('tab-deseos', () => ({ x: Number.NaN, y: 0, width: 10, height: 10 }));
        await registro.refresh('tab-deseos');

        expect(registro.measure('tab-deseos')).toBeNull();
    });

    it('refrescar sin identificador mide todos los objetivos registrados', async () => {
        const registro = createTargetRegistry();
        const otro: TargetRect = { x: 0, y: 500, width: 320, height: 56 };

        registro.register('tab-deseos', () => RECT);
        registro.register('tab-grupos', () => otro);

        await registro.refresh();

        expect(registro.measure('tab-deseos')).toEqual(RECT);
        expect(registro.measure('tab-grupos')).toEqual(otro);
    });

    it('darse de baja olvida la medida y avisa', async () => {
        const registro = createTargetRegistry();
        const oyente = vi.fn();

        registro.register('tab-deseos', () => RECT);
        await registro.refresh('tab-deseos');
        registro.subscribe(oyente);

        registro.unregister('tab-deseos');

        expect(registro.measure('tab-deseos')).toBeNull();
        expect(oyente).toHaveBeenCalledTimes(1);
    });

    it('avisa solo cuando la medida cambia, y reutiliza el mismo rectángulo', async () => {
        const registro = createTargetRegistry();
        const oyente = vi.fn();
        let medida: TargetRect = { ...RECT };

        registro.register('tab-deseos', () => medida);
        registro.subscribe(oyente);

        await registro.refresh('tab-deseos');
        expect(oyente).toHaveBeenCalledTimes(1);

        const primera = registro.measure('tab-deseos');

        // Misma medida con un objeto nuevo: no hay nada que repintar, y la instantánea tiene que
        // seguir siendo la misma referencia o `useSyncExternalStore` entraría en bucle.
        medida = { ...RECT };
        await registro.refresh('tab-deseos');

        expect(oyente).toHaveBeenCalledTimes(1);
        expect(registro.measure('tab-deseos')).toBe(primera);

        medida = { x: 10, y: 60, width: 100, height: 40 };
        await registro.refresh('tab-deseos');

        expect(oyente).toHaveBeenCalledTimes(2);
        expect(registro.measure('tab-deseos')).toEqual(medida);
    });

    it('cancelar la escucha deja de avisar', async () => {
        const registro = createTargetRegistry();
        const oyente = vi.fn();

        registro.register('tab-deseos', () => RECT);
        const cancelar = registro.subscribe(oyente);
        cancelar();

        await registro.refresh('tab-deseos');

        expect(oyente).not.toHaveBeenCalled();
    });

    it('el que se da de baja mientras se le mide no resucita', async () => {
        const registro = createTargetRegistry();
        let resolver: (rect: TargetRect) => void = () => {};

        registro.register(
            'tab-deseos',
            () =>
                new Promise<TargetRect>((resolve) => {
                    resolver = resolve;
                })
        );

        const refresco = registro.refresh('tab-deseos');
        registro.unregister('tab-deseos');
        resolver(RECT);
        await refresco;

        // La promesa llegó tarde: el objetivo ya no está y no puede reaparecer solo.
        expect(registro.measure('tab-deseos')).toBeNull();
    });
});
