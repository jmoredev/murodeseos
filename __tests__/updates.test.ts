import { describe, expect, it } from 'vitest';
import { getLatestUpdate, shouldAnnounceUpdate, type AppUpdate } from '../lib/updates';

/**
 * La regla de «Novedades»: se anuncia la entrada más nueva cuando el dispositivo no la vio.
 *
 * Esta es la parte que se rompió en silencio y que el modal no podía probar: el gate viejo
 * comparaba contra `package.json`, que quedó congelado en `1.4.0` desde 2026-05-12 mientras las
 * publicaciones se hacen con etiquetas de fecha. Con dos números iguales la condición era
 * verdadera para siempre y, después de la primera vez, nadie volvía a ver nada. La identidad de
 * una novedad es su propio `id`, que no depende de ningún otro archivo.
 */

const ENTRADA: AppUpdate = {
    id: '2026-10-21-novedades',
    release: '2026.10.21',
    date: '2026-10-21',
    changes: ['Compartir un producto desde el móvil'],
};

const ANTERIOR: AppUpdate = {
    id: '2026-05-12-accesibilidad',
    release: '1.4.0',
    date: '2026-05-12',
    changes: ['Foco visible en web'],
};

describe('shouldAnnounceUpdate', () => {
    it('anuncia cuando el dispositivo no vio nada todavía', () => {
        expect(shouldAnnounceUpdate(ENTRADA, null)).toBe(true);
    });

    it('anuncia cuando la última entrada vista es otra distinta', () => {
        expect(shouldAnnounceUpdate(ENTRADA, ANTERIOR.id)).toBe(true);
    });

    it('no anuncia cuando el dispositivo ya vio exactamente esta entrada', () => {
        expect(shouldAnnounceUpdate(ENTRADA, ENTRADA.id)).toBe(false);
    });

    it('no anuncia cuando no hay ninguna entrada', () => {
        expect(shouldAnnounceUpdate(null, null)).toBe(false);
        expect(shouldAnnounceUpdate(null, ENTRADA.id)).toBe(false);
    });

    it('no depende de la etiqueta visible de la release', () => {
        // Dos entradas con la misma `release` y distinto `id` son novedades distintas: la etiqueta
        // es para el usuario, la identidad es el `id`.
        const otra = { ...ENTRADA, id: '2026-10-21-otra' };

        expect(shouldAnnounceUpdate(otra, ENTRADA.id)).toBe(true);
    });
});

describe('getLatestUpdate', () => {
    it('devuelve la primera entrada del listado', () => {
        const latest = getLatestUpdate();

        expect(latest).not.toBeNull();
        expect(latest?.id).toBeTruthy();
        expect(latest?.release).toBeTruthy();
        expect(latest?.changes.length).toBeGreaterThan(0);
    });
});
