import { describe, expect, it, vi } from 'vitest';
import {
    createResolveHost,
    type DnsRecordType,
} from '../../supabase/functions/_shared/product-extraction/net/resolve-host.ts';

/**
 * El resolvedor de DNS que la Edge Function le inyecta a `safeFetch` es una **fábrica** para
 * poder probar el fallo cerrado en Node, sin red: se le pasa una función que devuelve lo que
 * cada familia respondería. Lo que se afirma es el efecto observable completo: si tira o no, y
 * qué direcciones devuelve, incluida la familia que falló.
 */

describe('createResolveHost', () => {
    it('devuelve las direcciones A y AAAA juntas', async () => {
        const resolveDns = vi.fn(async (_host: string, tipo: DnsRecordType) =>
            tipo === 'A' ? ['93.184.216.34'] : ['2606:2800:220:1:248:1893:25c8:1946']
        );
        const resolveHost = createResolveHost(resolveDns);

        await expect(resolveHost('shop.example')).resolves.toEqual([
            '93.184.216.34',
            '2606:2800:220:1:248:1893:25c8:1946',
        ]);
        // Las dos familias se piden: una dirección AAAA sola no cierra el contraste de la guarda.
        expect(resolveDns).toHaveBeenCalledWith('shop.example', 'A');
        expect(resolveDns).toHaveBeenCalledWith('shop.example', 'AAAA');
    });

    it('tira cuando ninguna familia devuelve direcciones', async () => {
        const resolveHost = createResolveHost(async () => []);

        await expect(resolveHost('shop.example')).rejects.toThrow();
    });

    it('no tira cuando AAAA falla pero A responde', async () => {
        const resolveHost = createResolveHost(async (_host, tipo) => {
            if (tipo === 'AAAA') throw new Error('sin AAAA');
            return ['93.184.216.34'];
        });

        await expect(resolveHost('shop.example')).resolves.toEqual(['93.184.216.34']);
    });

    it('no tira cuando A falla pero AAAA responde', async () => {
        const resolveHost = createResolveHost(async (_host, tipo) => {
            if (tipo === 'A') throw new Error('sin A');
            return ['2606:2800::1'];
        });

        await expect(resolveHost('shop.example')).resolves.toEqual(['2606:2800::1']);
    });

    it('tira cuando las dos familias fallan', async () => {
        const resolveHost = createResolveHost(async () => {
            throw new Error('DNS caído');
        });

        await expect(resolveHost('shop.example')).rejects.toThrow();
    });
});
