# Scripts de datos y publicación

Utilidades de apoyo para desarrollo, pruebas y publicación. No forman parte del
bundle de la aplicación.

## Requisitos

- **Docker** en marcha: `supabase start` levanta el stack local de Supabase.
- **`.env.local`** en la raíz con las claves del proyecto de desarrollo:

```env
EXPO_PUBLIC_SUPABASE_URL=tu-url-de-supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

La `service_role` key tiene acceso completo a la base de datos. Úsala solo en
desarrollo local y nunca contra el proyecto de producción.

## Contenido

| Script | Para qué sirve |
| --- | --- |
| `seed-complete-database.ts` | Reinicia y puebla la base de datos de prueba: usuarios, perfiles, grupos, membresías y listas de deseos. |
| `setup-e2e-user.ts` | Borra y recrea el usuario de pruebas E2E con su perfil completo. |
| `new-user.ts` | Deja un usuario en estado de recién registrado (sin nombre en el perfil) para recorrer el alta completa desde el login. |
| `postbuild.cjs` | Paso posterior al export web: genera `404.html`, `.nojekyll`, copia los activos de la PWA e inyecta los enlaces del manifiesto, favicon e `apple-touch-icon` con base path absoluto en el HTML. El idioma vive en `app/+html.tsx`. |
| `capture-product-fixtures.ts` | Captura páginas de producto reales a `test/fixtures/product-pages/` (`<id>.html.gz` + `manifest.json`) para los tests de extracción de producto. Es la única excepción al «no uses estos scripts contra producción»: no toca Supabase, solo descarga HTML público, con una petición por semilla, pausa y sin reintentos. Detalle en `test/fixtures/product-pages/README.md`. |

## Uso

```bash
# Poblar la base de datos de prueba
npm run seed

# Dejar el usuario de pruebas en estado de recién registrado
pnpm run user:new

# Preparar todo lo necesario para las pruebas E2E (arranca Supabase local y puebla)
npm run test:e2e:prepare

# Export web para publicar
npm run build:deploy
```

Los scripts de TypeScript se ejecutan con `tsx`, que ya es una dependencia de
desarrollo. No necesitas instalarlo por separado.

### Usuario recién registrado

La puerta del login (`app/(auth)/login/index.tsx`) manda a `/profile/setup` solo cuando
`profiles.display_name` está vacío, y ese estado se pierde en cuanto guardas el perfil.
Este script lo reconstruye: borra el usuario y sus datos (deseos, grupos que creó,
membresías, alias, avisos, cuotas e imágenes de Storage) y lo vuelve a crear con el
correo ya confirmado y sin nombre.

```bash
pnpm run user:new
pnpm run user:new -- --email otro@test.com --password OtraClave123!
```

Solo toca ese usuario: el resto de la base queda como está. Se niega a correr contra un
Supabase que no sea local salvo que le pases `--allow-remote`, porque usa la clave de
servicio y borra filas.

### Fixtures de páginas de producto

```bash
# Congelar las páginas de las tiendas declaradas en scripts/lib/fixture-capture.ts
npx tsx scripts/capture-product-fixtures.ts

# Solo algunas (una o varias, separadas por coma)
npx tsx scripts/capture-product-fixtures.ts --only=mediamarkt-es,zara-es
```

No requiere Docker ni `.env.local`: descarga HTML público. Las semillas, el criterio de la
lista y la convención de los fixtures están en `scripts/lib/fixture-capture.ts` y en
`test/fixtures/product-pages/README.md`.

## Usuarios de prueba

| Correo | Contraseña | Nombre |
| --- | --- | --- |
| juan@test.com | Test123! | Juan Pérez |
| maria@test.com | Test123! | María García |
| ana@test.com | Test123! | Ana López |
| carlos@test.com | Test123! | Carlos Ruiz |
| e2e-test@test.com | E2ETest123! | E2E Test User |
| nuevo@test.com | NuevoTest123! | *(sin nombre: lo crea `new-user.ts`, sin perfil guardado)* |

## Aviso

Ninguno de estos scripts debe ejecutarse contra el proyecto Supabase de
producción: `seed-complete-database.ts` reinicia datos.
