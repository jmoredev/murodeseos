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
| `postbuild.cjs` | Paso posterior al export web: genera `404.html`, `.nojekyll`, copia los activos de la PWA e inyecta el manifiesto y el idioma del documento en el HTML. |

## Uso

```bash
# Poblar la base de datos de prueba
npm run seed

# Preparar todo lo necesario para las pruebas E2E (arranca Supabase local y puebla)
npm run test:e2e:prepare

# Export web para publicar
npm run build:deploy
```

Los scripts de TypeScript se ejecutan con `tsx`, que ya es una dependencia de
desarrollo. No necesitas instalarlo por separado.

## Usuarios de prueba

| Correo | Contraseña | Nombre |
| --- | --- | --- |
| juan@test.com | Test123! | Juan Pérez |
| maria@test.com | Test123! | María García |
| ana@test.com | Test123! | Ana López |
| carlos@test.com | Test123! | Carlos Ruiz |
| e2e-test@test.com | E2ETest123! | E2E Test User |

## Aviso

Ninguno de estos scripts debe ejecutarse contra el proyecto Supabase de
producción: `seed-complete-database.ts` reinicia datos.
