# Consolidar el repositorio en una sola línea de trabajo

**Feature:** `consolidacion`
**Estado:** en curso — consolidación y endurecimiento cerrados y desplegados; queda el trabajo posterior de S8, S11, S12 y S13
**Inicio:** 2026-09-24
**Rama:** `feat/pwa-adaptation`

## Objetivo

Dejar una única fuente de verdad para la aplicación, un único canal de entrega
y una única convención de herramientas, de modo que el producto pueda avanzar
sin la ambigüedad actual sobre qué rama, qué gestor de paquetes y qué destino de
publicación son los reales.

## Contexto encontrado

El repositorio contenía tres líneas de trabajo en paralelo, y el clon local
estaba situado en la abandonada:

| Rama | Fecha | Stack | Versión |
| --- | --- | --- | --- |
| `develop` / `main` | 2026-02-04 | Next.js 16 App Router, `@supabase/ssr`, middleware | 1.3.0 |
| `feature/ui-keepsake` | 2026-05-12 | reescritura a Expo Router + React Native Web + NativeWind | 1.4.0 |
| `feat/pwa-adaptation` | 2026-06-05 | la anterior más PWA y export estático | 1.4.0 |

`develop` es ancestro de `feat/pwa-adaptation` (35 commits por detrás).
`feature/ui-keepsake` también lo es (11 commits por detrás).
`main` no lo es: contiene el merge `49e31a1`, que la otra rama no tiene.

`feat/pwa-adaptation` es la única línea capaz de cumplir el objetivo de
distribución, porque el renderizado en servidor y el middleware de Next.js no
pueden ejecutarse en GitHub Pages, mientras que `expo export --platform web`
genera un sitio estático instalable como PWA en Android y iOS.

El sitio de producción `https://jmoredev.github.io/murodeseos/` se publica desde
la rama `gh-pages-test` (`build_type: legacy`). La rama `gh-pages` está congelada
y sin uso, así que el despliegue manual no tiene efecto sobre lo que ve el
usuario.

## Decisiones

| # | Decisión | Motivo |
| --- | --- | --- |
| D1 | `feat/pwa-adaptation` es la aplicación vigente; la línea Next.js es legado. | Es la única que llega a GitHub Pages y permite una PWA instalable en Android e iOS. |
| D2 | Ver una lista de deseos exige un grupo en común, aplicado en la base de datos. | Hoy cualquier usuario autenticado que conozca un UUID puede leer cualquier lista. |
| D3 | La sorpresa se garantiza en la base de datos: el dueño nunca recibe `reserved_by`. | La regla actual es solo de interfaz y el dueño puede leer la reserva desde el navegador. |
| D4 | Una sola reserva por deseo: gana el primero y el segundo recibe un error claro. | El read-modify-write actual permite que dos personas reserven el mismo regalo en silencio. |
| D5 | La entrada a los grupos sigue siendo abierta por código, con unión instantánea. | Mantiene el comportamiento actual y la baja fricción que busca el producto. |
| D6 | Notificaciones: in-app hoy, push web para la PWA instalada después. | Solo in-app no alcanza a quien tiene la aplicación cerrada. |
| D7 | `main` se actualiza con un merge, no con force-push. | Al no ser ancestro, un force-push borraría el commit `49e31a1`. El merge produce el mismo árbol y conserva la historia. |
| D8 | GitHub Pages se publica mediante GitHub Actions al sitio único. | Solo hay un sitio Pages por repositorio y `gh-pages-test` es producción, no una vista previa: no existe un sitio de previsualización. |
| D9 | Convención de commits: Conventional Commits sin emoji. | Coherente con la disciplina de commits por unidad de trabajo adoptada con gentle-ai. |
| D10 | Se eliminan `.agents/` y `skills-lock.json`. | La configuración de opencode/Cursor queda superada por la del harness. |
| D11 | **pnpm** sustituye a bun y a npm como gestor de paquetes y ejecutor de tareas. | bun no estaba instalado y npm acumula problemas de seguridad recientes. pnpm bloquea por defecto los scripts de ciclo de vida, lo que encaja con la política de dependencias. |

## Fuera de alcance

- Ninguna funcionalidad nueva de producto en esta feature.
- Ninguna reescritura de migraciones existentes: producción tiene datos reales,
  así que todo cambio de esquema es aditivo y solo hacia delante.
- Ningún cambio en el sistema de diseño visual.

## Restricciones

- El proyecto Supabase de producción `bztfzifafqulelcxycqk` tiene usuarios y
  datos reales. Las migraciones deben ser aditivas y nunca reiniciar el esquema.
- El repositorio es público, así que la clave anónima del bundle publicado es
  pública por diseño y la corrección de las políticas RLS es la única frontera
  de acceso real.
- El despliegue exige las variables de Supabase en tiempo de compilación:
  `lib/supabase.ts` se niega a cargarse sin ellas.

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Preservar el cambio local de `.gitignore` y cambiar a `feat/pwa-adaptation` | hecho | entrada del stash "local .atl/ gitignore entry" |
| 2 | Ignorar el directorio local de estado de Pi | hecho | `1540ba5` |
| 3 | Registrar este diario de decisiones | hecho | `05c8928` |
| 4 | Fusionar `feat/pwa-adaptation` en `main` y publicar | hecho | `dc3b189`, merge sin force-push; árbol idéntico a la rama |
| 5 | Eliminar la rama remota `develop` | hecho | borrada en remoto y local, era ancestro de `main` |
| 6 | Sustituir bun y npm por pnpm en scripts y documentación | hecho | `484bdb4`, `4a5a9ff` |
| 7 | Eliminar `.agents/` y `skills-lock.json` | hecho | `0b9da3a` |
| 8 | Añadir el flujo de CI: tipos y tests unitarios en cada pull request | hecho | `3ea161a` |
| 9 | Añadir el flujo de despliegue: build y publicación en GitHub Pages | hecho | `3ea161a` |
| 10 | Cambiar la fuente de GitHub Pages a GitHub Actions | hecho | `build_type: workflow`; despliegue verificado |
| 11 | Auditar políticas RLS, migraciones aplicadas y privilegios de funciones contra producción | hecho | auditoría completa en [`endurecimiento.md`](./endurecimiento.md): 21/21 migraciones aplicadas, 9 tablas de `public` con RLS activo, advisors de 3 hallazgos a 1 |
| 12 | Añadir migraciones para visibilidad por grupo, reserva única y privacidad de la reserva | hecho | `20260925120000_wishlist_reservations_privacy.sql` (fase 1) y `20260928120000_drop_reserved_by_window.sql` (fase 2), aplicadas y verificadas en producción el 2026-09-28; cierran S1, S2 y D4 |
| 13 | Dejar el lint en verde y convertirlo en puerta bloqueante | **hecho** | De 35 problemas (16 errores, 19 avisos) a **cero**, y el gate ahora rechaza también los avisos: `eslint --max-warnings 0` en el guion y el paso de CI sin `continue-on-error`. Lo mecánico fueron avisos de variables e importaciones sin usar, dos importaciones mal colocadas, comillas sin escapar en JSX y un componente anónimo en un mock. Lo que exigió criterio fueron los diez `react-hooks/set-state-in-effect`: el estado que se sincronizaba con un parámetro de la URL (pestaña activa, código de invitación, aviso de cuenta creada) ahora se **deriva** en el render; «¿está montado?» y «¿es escritorio?» se leen con **`useSyncExternalStore`** en vez de fijarlos con un efecto; el brindis y el modal de confirmación conservan su transición de entrada arrancándola en el **siguiente cuadro** de animación; y los dos efectos que lanzan trabajo asíncrono cruzan un **límite asíncrono explícito**. Las dos advertencias de dependencias que quedan están desactivadas en línea **con su motivo escrito**. Verificado: lint limpio incluidos avisos, `tsc`, 142 tests unitarios y la suite completa de chromium **40/40 sin inestables**. La revisión nativa (tier alto, cuatro lentes) bloqueó en **R4-001**, un defecto propio: el brindis agendaba su entrada con `window.requestAnimationFrame`; corregido en `c680389` usando el global, y el validador dirigido aprobó la corrección. Commits `521087d` y `c680389` |
| 14 | Llevar los tests E2E al CI | hecho | workflow reutilizable `.github/workflows/e2e.yml`, invocado en cada pull request y por `deploy.yml` antes de publicar. Primera corrida real verde en PR #14 (~270 s) y segunda en PR #15 (220 s). `main` exige `E2E gate / Chromium suite` y `Types and unit tests` con `enforce_admins`. El motivo que figuraba aquí era inexacto: `ubuntu-latest` sí ofrece Docker |

## Defectos encontrados y resueltos en esta feature

| ID | Defecto | Evidencia |
| --- | --- | --- |
| R1 | `expo-font`, `expo-linear-gradient` y `expo-splash-screen` declarados en 55.x mientras Expo SDK 54 espera 14.0.x, 15.0.x y 31.0.x | `4a5a9ff` |
| R2 | `package-lock.json` desincronizado y `bun.lock` con dos copias de `expo-font` | `4a5a9ff` |
| R3 | `eslint.config.mjs` importaba `eslint-config-next`, que no es dependencia de esta rama | `dfc354d` |
| R4 | Diez errores de tipos: dos por restos de Next.js y ocho por tipado de React Native Web y del SDK | `b85f8d4` |
| R5 | `middleware.ts` y `next.config.ts` eran los últimos archivos que importaban `next` | `b046de7` |
| R6 | `seed` y `seed:clean` apuntaban a archivos inexistentes; `dev` ejecutaba `next dev` | `484bdb4` |
| R7 | Un `.js` compilado del script de seed estaba commiteado | `484bdb4` |
| R8 | Cinco SVG de `create-next-app` sin usar se publicaban en cada build | `6cf6ad5` |
| R9 | `scripts/README.md` documentaba scripts que no existen | `484bdb4` |

## Defectos conocidos para la fase de seguridad

El detalle, la evidencia y el plan de cada uno están en
[`endurecimiento.md`](./endurecimiento.md).

| ID | Defecto | Estado |
| --- | --- | --- |
| S1 | El dueño del deseo puede leer `reserved_by`: la sorpresa es falsificable | **cerrado y verificado en producción** (2026-09-28): la fase 2 retiró la columna, así que la autoría ya no está en `wishlist_items` |
| S2 | Cualquier usuario autenticado lee cualquier lista sin grupo en común | **cerrado y verificado en producción** (2026-09-28): la política SELECT exige grupo compartido no excluido |
| S3 | Las notificaciones se pueden insertar en nombre de otros usuarios | cerrado y verificado |
| S4 | La política de actualización de `wishlist_items` es permisiva y depende de un trigger | cerrado y verificado |
| S5 | Funciones `SECURITY DEFINER` alcanzables por RPC | cerrado y verificado |
| S6 | Listado del bucket de Storage por usuarios anónimos | cerrado y verificado |
| S7 | `draw_performed` ausente de la restricción de tipos de notificación | cerrado y verificado |
| S8 | **El registro fija `emailRedirectTo` a `http://localhost:8081/login`**, así que con la confirmación por correo activa ningún usuario nuevo puede confirmar su cuenta | **cerrado** el 2026-09-28: `lib/site-url.ts` compone el enlace desde `EXPO_PUBLIC_SITE_URL` o desde el sitio actual |
| S9 | `EXPO_PUBLIC_SITE_URL` se documenta en `env.example` pero no se usa en ningún sitio | **cerrado**: la usa `lib/site-url.ts` para los enlaces de correo, y `deploy.yml` la pasa al build desde la variable del repositorio |
| S10 | Copia de credenciales olvidada en `public.tmp_auth_users` y `tmp_auth_identities` | cerrado y verificado |
| S11 | Protección de contraseñas filtradas desactivada | abierto, depende del plan de Supabase |
| S12 | Las rutas dinámicas devuelven 404 aunque sirven el shell de la SPA | abierto, preexistente |
| S13 | SQL antiguo en `database/` que revertiría el endurecimiento y destruiría datos | abierto |
| S14 | El fallback de la ruta base del sitio en `lib/site-url.ts` es el nombre del repositorio escrito a mano | abierto, sugerencia de la revisión | podría leerse de `app.json` (`experiments.baseUrl`), que ya lo declara; hoy solo entra si la URL no trae primer segmento |

## Hallazgos informativos de la revisión del lint

La revisión nativa del cierre de la tarea 13 (tier alto, cuatro lentes) bloqueó una
sola vez, por **R4-001** (crítico y propio de este cambio), y aprobó la corrección.
El resto de los hallazgos que devolvió son **informativos**: no bloquean, no reabren
la revisión y se trabajan aparte. La columna «nota» es mi lectura del código, no el
texto del revisor; la revisión entrega identificador, lente, ubicación y gravedad.

| ID | Lente | Ubicación | Gravedad | Nota (lectura propia) |
| --- | --- | --- | --- | --- |
| R1-shared-admin-client-session-guard | riesgo | `e2e/supabase-admin.ts:36-38` | sugerencia | El cliente administrativo compartido por worker no debería servir para iniciar sesión; hoy lo evita la disciplina documentada, no el código. |
| R2-create-icon-dead-state | legibilidad | `app/groups/create/index.tsx:12` | sugerencia | `const [icon] = useState('🎁')` descarta el modificador: estado muerto, previo a este cambio. |
| R2-groups-loading-comment | legibilidad | `components/GroupsTab.tsx:31-32` | aviso | El comentario que escribí sobre el estado de carga quedó en un punto donde ya no describe lo que pasa. |
| R2-hydration-idiom-duplicated | legibilidad | `components/ConfirmModal.tsx:29-33` | sugerencia | El idioma de montaje con `useSyncExternalStore` está repetido en tres componentes; pide un ayudante compartido. |
| R3-groups-loading-reset | fiabilidad | `components/GroupsTab.tsx:147-149` | aviso | Verificado: al repetirse el efecto por cambio de usuario, `loading` ya está en `false`, así que se ve contenido viejo mientras recarga. |
| R3-tab-empty-param | fiabilidad | `app/index.tsx:20-25` | aviso | Verificado: un `?tab=` vacío no es `null`, así que `activeTab` queda en cadena vacía y no coincide con ninguna pestaña. Se arregla con `params.tab ? … : null`. |
| R3-toast-raf-race | fiabilidad | `components/Toast.tsx:22` | aviso | Con `duration` muy corta, el temporizador de cierre puede correr antes que el cuadro de entrada. |
| R4-002 | resiliencia | `components/GroupsTab.tsx:149` | aviso | Mismo asunto que R3-groups-loading-reset, visto desde el límite asíncrono que introduje. |
| R4-003 | resiliencia | `app/groups/join/index.tsx:1` | aviso | Verificado: la importación de `React` no se usa en el archivo (no hay ninguna referencia a `React.`). Es anterior a este cambio. |

## Verificación

- `pnpm install --frozen-lockfile`, `pnpm run typecheck` y `pnpm run test:unit`
  pasan: 12 archivos, 115 tests, 1 pendiente.
- `pnpm run build` genera `dist` con 12 rutas estáticas y el paso `postbuild`.
- CI en verde sobre `main`.
- Despliegue verificado de extremo a extremo: el sitio publica el bundle
  `entry-bfc9892c64be4e952129ba66e1a93df6.js`, distinto del que servía la rama
  `gh-pages-test`; todas las rutas responden 200; los activos de la PWA están
  presentes; y el bundle apunta a `bztfzifafquulelcxycqk.supabase.co` con la
  clave anónima de producción, así que los secretos son los correctos.

## Consecuencia

Con `build_type: workflow` las ramas `gh-pages` y `gh-pages-test` dejan de
participar en la publicación. `gh-pages` llevaba congelada desde mayo y
`gh-pages-test` era el sitio en producción; ambas son eliminables una vez el
nuevo canal demuestre ser estable.

## Pendiente de decisión

`feat/pwa-adaptation` y `feature/ui-keepsake` ya están contenidas en `main` y
pueden borrarse cuando se quiera.
