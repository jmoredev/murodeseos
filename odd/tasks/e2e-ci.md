# Suite E2E determinista y en CI

**Feature:** `e2e-ci`
**Estado:** en curso — el cierre de la suite (E-4) está corregido y verificado; la suite
completa en chromium sigue con 6 fallos de specs que esta feature no toca (E-5, E-6, E-7).
**Inicio:** 2026-09-25
**Rama:** `feat/reservas-privacidad`
**Cierra:** V9 de [`reservas.md`](./reservas.md); el punto «E2E en CI» de
[`endurecimiento.md`](./endurecimiento.md) y [`consolidacion.md`](./consolidacion.md)

## Objetivo

Que la suite Playwright sea determinista en una ejecución limpia y pueda ser un
gate de CI, sin depender del estado que dejaron ejecuciones anteriores.

## Decisiones de esta feature

| # | Decisión | Motivo |
| --- | --- | --- |
| E-A | La aserción de orden se hace sobre el orden del DOM de las tarjetas, no sobre coordenadas `y`. | A 1280 px el mosaico es de 4 columnas (`w-1/2 md:w-1/3 lg:w-1/4`), así que dos tarjetas comparten fila y comparar `y` compara posiciones que resuelven iguales: recibido 537, esperado menor que 537. La tarjeta ya expone `testID="wishlist-card-<id>"`, así que el orden de render es el orden ordenado y es independiente del ancho. |
| E-B | La limpieza de datos de prueba va por `supabaseAdmin`, no por `DELETE /api/wishlist/<id>`. | Las rutas `/api/*` eran de la línea Next.js y ya no existen: cada `afterEach` registraba 404, las filas se acumulaban y el mosaico cambiaba de filas, lo que volvía intermitente el fallo de orden. `wishlist-visibility.spec.ts` ya usa este patrón. |
| E-C | La entrada a la lista de un amigo va directa a `/groups/<id>`, no por la pestaña «Mis grupos». | Mismo patrón que `wishlist-visibility.spec.ts`. La navegación por pestañas dejaba el clic del amigo sobre un nodo no visible. |
| E-D | El gate E2E en CI corre **solo en push a `main`**, y solo el proyecto chromium. | Decisión del usuario: protege `main` sin penalizar cada PR con el arranque del stack. `ubuntu-latest` sí tiene Docker, así que `supabase start` local es viable; el comentario de `ci.yml` que dice lo contrario es inexacto. |
| E-E | El `webServer` de Playwright lanza el CLI de Expo directo (`node node_modules/expo/bin/cli start --web`), nunca `pnpm run web`. | `pnpm` mueve el script a su **propio grupo de procesos**, así que el servidor dev escapaba del `process.kill(-pid, 'SIGKILL')` con el que Playwright limpia el webServer al terminar. El huérfano retenía los pipes de stdio del webServer, el evento `close` del hijo no llegaba nunca y la corrida no terminaba, no imprimía resumen ni devolvía código de salida (14,3 minutos medidos, E-4). Lanzado directo, node reemplaza al shell de `sh -c`, el servidor queda como hijo directo y líder del grupo que Playwright sí mata. |
| E-F | La suite completa se verifica con `CI=1`. | `CI=1` activa exactamente la rama que usará el gate: `workers: 1`, `retries: 2`, `reuseExistingServer: false` y `forbidOnly: true`. Permite verificar la ruta de CI sin un runner real. |

## Evidencia de la verificación (2026-09-26)

**Los dos specs reparados.** `pnpm exec playwright test e2e/already-have-it.spec.ts e2e/wishlist.spec.ts --project=chromium`
en chromium, desde una base sembrada idéntica y sin servidor previo en `:8081`:
`5 passed` (14,5 s, exit 0), `5 passed` (14,4 s, exit 0) y una tercera corrida de
14,3 s. Cero fallos, cero reintentos, cero omitidos; `test-results/.last-run.json`
en `passed`. Ambas corridas usaron 4 workers, así que el determinismo está
demostrado a nivel de test. La limpieza por `supabaseAdmin` deja la base sin
residuo: 0 filas nuevas en `wishlist_items` y el residuo histórico de
`e2e-test@test.com` desaparecido tras el seed.

**El cierre de la suite (E-4).** Antes del arreglo, la misma corrida se quedaba
14,3 minutos en `do_epoll_wait` con 0 hijos, 0 conexiones a `:8081` y el log
congelado; terminaba en ~5 s solo al matar a mano el `expo` huérfano, y solo
entonces imprimía `5 passed`. Después del arreglo, **las cuatro corridas (tres
cortas y la suite completa) terminaron solas**, con su resumen y su código de
salida, sin intervención manual, y `:8081` quedó libre después de cada una, sin
procesos huérfanos.

**La suite completa.** `CI=1 playwright test --project=chromium`: **30 passed /
6 failed / 2 did not run**, 0 flaky, 5,4 min, exit 1. Terminó sola y sin
huérfanos. Los dos specs de esta feature pasan dentro de esa corrida. Los 6
fallos están en specs que esta feature no toca: `create-group.spec.ts:71` y
`:159`, `groups-navigation.spec.ts:21` y `:65`, `profile.spec.ts:19` y
`pwa.spec.ts:14`. Ver E-5, E-6 y E-7.

## Diseño del arreglo

- `e2e/wishlist.spec.ts`: sustituir las seis lecturas de `boundingBox()` por una
  comparación del índice de cada tarjeta entre los `[data-testid^="wishlist-card-"]`
  renderizados, con `expect.poll` en lugar de un `waitForTimeout` fijo; la tarjeta
  se identifica por el texto de su título. La limpieza borra por `id` con
  `supabaseAdmin` y el `afterEach` deja de depender de HTTP.
- `e2e/already-have-it.spec.ts`: navegar a `/groups/${E2E_CONFIG.group.id}`,
  pulsar el nodo visible del amigo y borrar el deseo sembrado por `supabaseAdmin`
  en un `afterEach` (antes quedaba en la base para siempre).
- `playwright.config.ts`: `webServer.command` pasa a
  `node node_modules/expo/bin/cli start --web`, con el comentario que explica por
  qué no puede volver a ser `pnpm run web` (decisión E-E).

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Diagnosticar los dos fallos con reproducción local y evidencia exacta | hecho | Reproducción en chromium: `already-have-it.spec.ts:91` (clic sobre nodo no visible), `wishlist.spec.ts:109` (`y` 537 contra 537, 4 columnas a 1280 px); `afterEach` con 404 por ruta `/api/*` inexistente |
| 2 | Reparar `e2e/wishlist.spec.ts`: orden por orden del DOM y limpieza por `supabaseAdmin` | hecho | Verde en tres corridas de chromium; `supabaseAdmin` deja 0 filas |
| 3 | Reparar `e2e/already-have-it.spec.ts`: navegación directa al grupo, clic visible y limpieza del deseo sembrado | hecho | Verde en tres corridas de chromium; sin deseo residual del amigo |
| 4 | Verificar los dos specs en verde en chromium en ejecución limpia y en reejecución | hecho | `5 passed` × 2 con exit 0, 14,5 s y 14,4 s, desde base sembrada idéntica; 4 workers en ambas |
| 5 | Corregir el cierre de la suite (E-4): sin resumen, sin código de salida y con servidor huérfano | hecho | Causa raíz medida (ver E-4) y `webServer.command` sin `pnpm`; verificado con tres corridas cortas y la suite completa, todas terminando solas |
| 6 | Verificar la suite completa en chromium sin fallos | en curso | `CI=1`: 30 passed / 6 failed / 2 did not run; los 6 fallos son E-5, E-6 y E-7 |
| 7 | Corregir los fallos de la suite completa (E-5, E-6, E-7) | pendiente | Bloquea la tarea 8 |
| 8 | Implementar el gate E2E en CI: job en push a `main`, solo chromium | pendiente | Alcance decidido: solo `main`, solo chromium (E-D) |
| 9 | Documentación: cerrar V9 en `reservas.md` y el punto de CI en `endurecimiento.md` y `consolidacion.md` | pendiente | |

## Defectos encontrados

| ID | Defecto | Estado | Evidencia |
| --- | --- | --- | --- |
| E-1 | La aserción de orden por coordenada `y` es inválida en un mosaico multicolumna | corregido por la tarea 2 | Ambas tarjetas en la fila de `y = 537` |
| E-2 | La limpieza de `wishlist.spec.ts` llama a una ruta `/api/*` que ya no existe: 404 en cada `afterEach`, filas acumuladas y fallo intermitente | corregido por la tarea 2 | `request.delete(.../api/wishlist/<id>)` en `e2e/wishlist.spec.ts:27`; `app/api` no existe; 7 filas acumuladas de `e2e-test@test.com` antes del reseed |
| E-3 | La navegación por pestañas deja el clic del amigo sobre un nodo no visible | corregido por la tarea 3 | `getByText('Juan Perez').first()` resuelve a un `div` no visible tras `?tab=groups` |
| E-4 | La corrida nunca termina: sin resumen, sin código de salida y con el servidor dev huérfano en `:8081` | corregido y verificado | Causa raíz medida: Playwright lanza el `webServer` con `detached: true` y en el teardown hace `process.kill(-childPid, 'SIGKILL')`; `pnpm` pone el script en su propio grupo, así que `expo` escapaba (`ppid=pnpm`, `pgid` propio) y retenía los pipes de stdio: el evento `close` del hijo no llegaba y `waitForCleanup` esperaba para siempre. Con el CLI directo, `expo` es el hijo directo de Playwright y líder del grupo que sí se mata. |
| E-5 | Cuatro tests buscan un ancla `a[href*="/groups/create"]` que la app nunca renderiza | abierto | `create-group.spec.ts:71` y `:159`, `groups-navigation.spec.ts:21` y `:65`: `element(s) not found` y timeout de 30 s. La ruta `app/groups/create` sí existe, pero la entrada es un `Pressable` con `router.push('/groups/create')` (`components/GroupsTab.tsx:328,373`), no un enlace. La expectativa del test es la que está mal |
| E-6 | `profile.spec.ts:19` no ve «Mi Perfil» | abierto | `expect(page.getByText('Mi Perfil', { exact: true }).last()).toBeVisible()` con `element(s) not found` en los 3 intentos (timeout 15 s), con el aviso de React Native Web `Unexpected text node: . A text node cannot be a child of a <View>` en consola. Hipótesis sin verificar: o un defecto real de render, o el nodo queda fuera del viewport |
| E-7 | `pwa.spec.ts:14` espera el añil `#4F46E5` y la app emite `#aa2c32` | abierto | Recibido `#aa2c32` 33 veces. El color nuevo es consistente en `app/_layout.tsx:17`, `app.json:31`, `public/manifest.json:8` y `tailwind.config.cjs:12`, así que la expectativa del spec es obsoleta |

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Arreglar la aserción en vez de la aplicación: el orden real podría estar mal | El orden lo calcula `components/WishListTab.tsx:106-118`; el spec verifica el orden de render, que es la consecuencia observable de ese comparador. Si el orden fuera incorrecto, el spec debe fallar y la corrección va en el componente. Verificado: pasa |
| Un gate E2E en CI añade minutos a cada PR y puede volverse ruidoso | Alcance decidido por el usuario: solo `main`, solo chromium (E-D). La corrida completa medida tarda 5,4 min con `workers: 1` |
| El arreglo de E-4 depende de que el CLI de Expo no se reagrupe en el futuro | Si una versión futura de Expo lanzara el servidor en otro grupo, el defecto volvería. La comprobación barata está en *Mediciones*, y el gate en CI pondría un techo de tiempo que lo haría visible |
| `node node_modules/expo/bin/cli` asume el layout hoisted de pnpm | Verificado en este repo (`node_modules/expo/bin/cli` existe y `expo --version` da 54.0.27). Con un install no hoisted habría que resolver la ruta por el binario del paquete |

## Mediciones (trampas ya pagadas)

- `pgrep` sin `-f` compara el **nombre** del proceso. El servidor dev de Expo se
  llama `node-MainThread` y Playwright `node`, así que `pgrep -a "[e]xpo"` sale
  vacío **aunque el servidor esté vivo**. Chequeos fiables:
  `pgrep -af "[e]xpo/bin/cli"` y el puerto, `ss -ltn | grep 8081`.
- Nunca canalizar la salida de Playwright a `tail`/`head`. Si algo mata la
  tubería se pierden la salida y el código de salida, y quedan huérfanos que la
  corrida siguiente reutiliza en silencio vía `reuseExistingServer: true`.
  Redirigir a un archivo y leerlo después.
- Para verificar la causa y no solo el resultado, durante la corrida:
  `ps -eo pid,ppid,pgid,sid,cmd | grep -E "[e]xpo|[p]laywright"`. Con el defecto,
  `ppid` era `pnpm` y el grupo era propio; con el arreglo, `ppid` es el proceso de
  Playwright y el grupo es el que el teardown mata.

## Fuera de alcance

- Los otros proyectos de navegador (firefox, webkit, Mobile Chrome, Mobile Safari):
  siguen existiendo para uso local; solo chromium está verificado.
- `test:e2e:prepare` y el seed, que hoy funcionan.
- El lint bloqueante y S11/S12/S13.
