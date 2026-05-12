# Muro de Deseos

App web (Expo Router + React Native Web) para listas de regalos y grupos de intercambio, con backend en Supabase.

## Requisitos

- [Bun](https://bun.sh/)
- Variables `EXPO_PUBLIC_SUPABASE_*` (ver `docs/DEVELOPMENT.md`)

## Comandos

| Acción | Comando |
|--------|---------|
| Instalar | `bun install` |
| Desarrollo | `bun run dev` |
| Tests unitarios | `bun run test:unit` |
| Lint | `bun run lint` |
| Export web | `bun run build` |
| E2E (Playwright + Supabase local) | `bun run test:e2e` |

## Documentación

- [Guía de desarrollo](docs/DEVELOPMENT.md) — entorno, Supabase, rendimiento, arquitectura.
- [Diseño (Keepsake)](docs/DESIGN.md) — tokens, tipografía, reglas visuales.
- [Usuario E2E](docs/E2E-USER.md) — credenciales y datos de prueba.
- [Changelog](CHANGELOG.md) — cambios por versión.
