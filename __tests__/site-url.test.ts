import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGithubPagesBasePath, getSiteBaseUrl } from '@/lib/site-url';

const originalSiteUrl = process.env.EXPO_PUBLIC_SITE_URL;

afterEach(() => {
    if (originalSiteUrl === undefined) {
        delete process.env.EXPO_PUBLIC_SITE_URL;
    } else {
        process.env.EXPO_PUBLIC_SITE_URL = originalSiteUrl;
    }
    vi.unstubAllGlobals();
});

describe('getGithubPagesBasePath', () => {
    it('devuelve la ruta del repositorio en GitHub Pages', () => {
        vi.stubGlobal('window', {
            location: { hostname: 'jmoredev.github.io', pathname: '/murodeseos/login/' },
        });

        expect(getGithubPagesBasePath()).toBe('/murodeseos');
    });

    it('no devuelve ruta en cualquier otro host', () => {
        vi.stubGlobal('window', { location: { hostname: 'localhost', pathname: '/login' } });

        expect(getGithubPagesBasePath()).toBe('');
    });

    it('no devuelve ruta sin navegador', () => {
        vi.stubGlobal('window', undefined);

        expect(getGithubPagesBasePath()).toBe('');
    });
});

describe('getSiteBaseUrl', () => {
    it('usa EXPO_PUBLIC_SITE_URL cuando está configurada y le quita la barra final', () => {
        process.env.EXPO_PUBLIC_SITE_URL = 'https://jmoredev.github.io/murodeseos/';

        expect(getSiteBaseUrl()).toBe('https://jmoredev.github.io/murodeseos');
    });

    it('sin variable, en GitHub Pages compone el origen con la ruta del repositorio', () => {
        delete process.env.EXPO_PUBLIC_SITE_URL;
        vi.stubGlobal('window', {
            location: {
                hostname: 'jmoredev.github.io',
                pathname: '/murodeseos/login/',
                origin: 'https://jmoredev.github.io',
            },
        });

        expect(getSiteBaseUrl()).toBe('https://jmoredev.github.io/murodeseos');
    });

    it('sin variable, en desarrollo usa el origen actual', () => {
        delete process.env.EXPO_PUBLIC_SITE_URL;
        vi.stubGlobal('window', {
            location: { hostname: 'localhost', pathname: '/login', origin: 'http://localhost:8081' },
        });

        expect(getSiteBaseUrl()).toBe('http://localhost:8081');
    });

    it('sin navegador cae al servidor de desarrollo de Expo', () => {
        delete process.env.EXPO_PUBLIC_SITE_URL;
        vi.stubGlobal('window', undefined);

        expect(getSiteBaseUrl()).toBe('http://localhost:8081');
    });
});
