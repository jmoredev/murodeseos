import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    draftFromShare,
    mergeUntouchedWishFields,
    savePendingShare,
    takePendingShare,
    PENDING_SHARE_KEY,
} from '@/lib/share-draft';

const payload = {
    url: 'https://www.amazon.es/dp/B09B8X9RGM',
    title: 'Producto de prueba',
    text: 'Mira esto https://www.amazon.es/dp/B09B8X9RGM',
    createdAt: 1_760_000_000_000,
};

beforeEach(() => {
    sessionStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('compartir pendiente entre la ruta y el formulario', () => {
    it('guarda y devuelve el compartir, y lo consume una sola vez', () => {
        savePendingShare(payload);

        expect(takePendingShare()).toEqual(payload);
        // Sin esto, cada montaje del formulario volvería a abrir el mismo deseo.
        expect(takePendingShare()).toBeNull();
        expect(sessionStorage.getItem(PENDING_SHARE_KEY)).toBeNull();
    });

    it('sin nada guardado devuelve null', () => {
        expect(takePendingShare()).toBeNull();
    });

    it('lo guardado corrupto se descarta en vez de romper el arranque', () => {
        sessionStorage.setItem(PENDING_SHARE_KEY, '{no es json');

        expect(takePendingShare()).toBeNull();
        expect(sessionStorage.getItem(PENDING_SHARE_KEY)).toBeNull();
    });

    it('lo guardado con otra forma se descarta', () => {
        sessionStorage.setItem(PENDING_SHARE_KEY, JSON.stringify({ title: 7 }));

        expect(takePendingShare()).toBeNull();
    });

    it('sin sessionStorage (SSR) no tira y no devuelve nada', () => {
        const original = (globalThis as any).sessionStorage;
        (globalThis as any).sessionStorage = undefined;

        try {
            expect(() => savePendingShare(payload)).not.toThrow();
            expect(takePendingShare()).toBeNull();
        } finally {
            (globalThis as any).sessionStorage = original;
        }
    });
});

describe('borrador inicial a partir del compartir', () => {
    it('con enlace: título de la hoja y el enlace como único vínculo', () => {
        expect(draftFromShare(payload)).toEqual({
            title: 'Producto de prueba',
            links: ['https://www.amazon.es/dp/B09B8X9RGM'],
        });
    });

    it('sin enlace: el texto compartido pasa a ser el título, porque es lo único que hay', () => {
        expect(
            draftFromShare({ ...payload, url: null, title: '', text: '  Una lámpara de El Corte Inglés  ' }),
        ).toEqual({
            title: 'Una lámpara de El Corte Inglés',
            links: [],
        });
    });

    it('con enlace pero sin título no inventa un título con el texto del share', () => {
        // El texto suele repetir el enlace; usarlo como título dejaría «Mira esto https://…»
        // escrito en el deseo. El título lo trae la extracción.
        expect(draftFromShare({ ...payload, title: '', text: 'Mira esto https://www.amazon.es/dp/x' })).toEqual({
            title: '',
            links: ['https://www.amazon.es/dp/B09B8X9RGM'],
        });
    });
});

describe('aplicar la extracción sin pisar al usuario', () => {
    const prefilled = { title: '', notes: '', imageUrl: '', links: ['https://tienda.example/p/1'], priceText: '' };

    it('rellena los campos que siguen como los dejó el compartir', () => {
        const merged = mergeUntouchedWishFields({
            current: { ...prefilled },
            prefilled,
            extracted: {
                title: 'Lámpara de pie',
                notes: 'Una descripción',
                imageUrl: 'https://tienda.example/img.jpg',
                priceText: '89,99',
            },
        });

        expect(merged).toEqual({
            title: 'Lámpara de pie',
            notes: 'Una descripción',
            imageUrl: 'https://tienda.example/img.jpg',
            links: ['https://tienda.example/p/1'],
            priceText: '89,99',
        });
    });

    it('no pisa lo que el usuario ya escribió mientras la extracción viajaba', () => {
        const merged = mergeUntouchedWishFields({
            current: { ...prefilled, title: 'Mi título', priceText: '12' },
            prefilled,
            extracted: { title: 'Lámpara de pie', priceText: '89,99' },
        });

        expect(merged.title).toBe('Mi título');
        expect(merged.priceText).toBe('12');
    });

    it('un campo vacío en la extracción no borra nada', () => {
        const merged = mergeUntouchedWishFields({
            current: { ...prefilled, notes: 'algo' },
            prefilled: { ...prefilled, notes: 'algo' },
            extracted: { notes: '', title: 'Lámpara' },
        });

        expect(merged.notes).toBe('algo');
        expect(merged.title).toBe('Lámpara');
    });

    it('compara los enlaces por contenido, no por referencia', () => {
        const merged = mergeUntouchedWishFields({
            current: { ...prefilled, links: ['https://tienda.example/p/1'] },
            prefilled,
            extracted: { notes: 'nota' },
        });

        expect(merged.links).toEqual(['https://tienda.example/p/1']);
    });
});
