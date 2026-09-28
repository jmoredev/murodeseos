# Suite E2E determinista y en CI

**Feature:** `e2e-ci`
**Estado:** en curso — la suite completa en chromium pasa **38/38 con `CI=1`** (exit 0) y el
gate ya corre en CI; el cierre de la suite (E-4) y los cinco fallos de specs (E-5 a E-9) están
corregidos. Quedan la tarea 9 (cierre documental), el defecto abierto E-10 y la decisión
pendiente E-I (el gate detecta, no bloquea).
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
| E-G | El spec que muta el fixture compartido lo restaura; el spec que lo consume no se adapta a la mutación. | `profile.spec.ts` renombraba al usuario E2E (`Usuario E2E <timestamp>`) y no lo devolvía, así que `wishlist-visibility.spec.ts:136` buscaba `E2E Test User` y agotaba el timeout. La causa es la fuga, no la dependencia: el nombre sembrado es parte del contrato de la suite. Restaurar en el origen deja la suite independiente del orden de archivos y, además, segura bajo ejecución paralela local. |
| E-H | Al corregir una expectativa obsoleta no se debilita la aserción. | La auditoría del diff confirma que ninguna aserción se borró, comentó ni aflojó (sin `force: true` añadido, sin timeouts subidos, sin `test.skip`), y que cada cadena nueva es la que la app renderiza de verdad. |
| E-I | El gate corría después del merge y solo detectaba; **decisión del usuario: debe bloquear las dos cosas**. | El job se extrajo a `.github/workflows/e2e.yml` (`workflow_call`), `ci.yml` lo llama en los pull requests (gate del merge) y `deploy.yml` lo llama antes de publicar, con `deploy.needs: [build, e2e]` (gate del publish). El publish es de fallo cerrado: `deploy` no tiene `if` ni `continue-on-error`, `deploy-pages` aparece una sola vez en el repositorio y una corrida fallida **o cancelada** no es un éxito, así que la versión publicada queda en pie. Aviso importante: «bloquear el merge» depende además de una regla de protección de rama en los ajustes de GitHub, que **no vive en el repositorio**; el check a exigir es `E2E gate / Chromium suite` (llamador / job llamado) y solo se puede confirmar en la primera corrida real. |
| E-J | El reporter del gate es `list` además de `html` cuando corre en CI. | Con solo el reporter `html`, un fallo de CI no imprime casi nada en el log y el gate se vuelve indepurable. Se prueban las tres partes del objetivo de E-D (push a main, solo chromium, sin secretos) y además que un fallo se lea en el log. |

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

### La suite completa reparada (tarea 7, misma fecha)

Los 2 tests que aparecían como «did not run» en la corrida anterior pertenecían a
`wishlist-visibility.spec.ts`. Al liberarse la suite, uno de ellos afloró un sexto defecto que
el registro previo no podía ver (E-9). Corregidos los cinco fallos de specs y la fuga de
fixture, la corrida completa da **38 passed / 0 failed / 0 flaky / 0 did not run, exit 0,
1,1–1,2 min**, reproducida de forma independiente por un verificador separado sobre el mismo
árbol.

**Diagnóstico.** Los cinco fallos eran expectativas obsoletas de los specs, no defectos de la
aplicación. E-5: `a[href*="/groups/create"]` no existía porque la entrada es un
`PrimaryButton` con `router.push` (`components/GroupsTab.tsx:329,376`) y solo `/groups/join`
es un `<Link asChild>` real. E-6: `getByText('Mi Perfil', { exact: true })` es sensible a
mayúsculas y la app renderiza `Mi perfil`. E-7: el añil `#4F46E5` no aparece en ninguna parte
de la app; el color es `#aa2c32` en las cuatro declaraciones. E-8: `Toca para cambiar el
icono` no existe en la app, que renderiza `Icono del grupo`
(`app/groups/create/index.tsx:59`). E-9: `profile.spec.ts` mutaba el fixture compartido y no
lo restauraba.

**Causalidad de E-9, medida.** La secuencia `profile.spec.ts` y luego
`wishlist-visibility.spec.ts`, sin reseed intermedio, falla con el timeout de 30 s; con la
restauración del fixture la misma secuencia pasa, y la fila de `profiles` leída después vuelve
a ser la sembrada (`E2E Test User | 🤖 | L | 42 | 44 | Google, Apple | Gris`).

**Corrección al registro previo.** E-5 eran **3** fallos, no 4. El fallo de
`create-group.spec.ts:159` no era E-5 sino E-8: ese test navega directo a `/groups/create`, así
que el registro previo lo había atribuido a un locator que no usa.

**Auditoría del diff.** Los cuatro archivos modificados son solo specs; ninguna aserción se
borró, comentó ni aflojó, y cada cadena nueva coincide con la que la app renderiza.
`pnpm exec tsc --noEmit` sale con código 0.

### El gate en CI (tarea 8, misma fecha)

El gate es un workflow reutilizable, `.github/workflows/e2e.yml` (`on: workflow_call` y
`permissions: contents: read`, para que un llamador con más permisos no pueda ampliarlo). Lo
invocan dos llamadores: `ci.yml` en los pull requests (gate del merge) y `deploy.yml` en cada
push a `main` y en su `workflow_dispatch` (gate del publish), donde el job `deploy` lleva
`needs: [build, e2e]`. La suite corre **una vez por evento**: en un pull request solo dispara
`ci.yml`, y en un push a `main` el llamador de `ci.yml` queda omitido por su `if`.

**Sin secretos.** El runner genera su propio `.env.local` desde el stack que acaba de
levantar, con una tubería medida: `grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)='` más tres
`sed` que renombran a `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY`. Esos tres nombres son los que leen la app (`lib/supabase.ts`), el
seed (`scripts/seed-complete-database.ts` lee **solo** `SUPABASE_SERVICE_ROLE_KEY` y aborta si
falta) y los specs; `NEXT_SERVICE_ROLE_KEY` y `EXPO_SERVICE_ROLE_KEY` se dejan sin definir
para que no ensombrezcan la clave local en su cadena de respaldo. La tubería se verificó dos
veces —contra el `.env.local` local (los tres valores coinciden) y contra una entrada
adversaria con `LINKED_*`, `JWT_SECRET`, `MY_SERVICE_ROLE_KEY` y `SERVICE_ROLE_KEYX`— y sale de
las dos con exactamente tres líneas. El workflow no referencia `secrets.*` en ningún punto.

**Legibilidad del fallo.** `playwright.config.ts` pasa a
`reporter: process.env.CI ? [['list'], ['html']] : 'html'`: con solo el reporter `html`, un
fallo de CI no imprime casi nada en el log.

**Orden y reverificación.** Checkout, pnpm, node 22, `pnpm install --frozen-lockfile`,
`playwright install --with-deps chromium`, `supabase start`, generación de `.env.local`, y
recién entonces `pnpm run test:e2e:prepare` (que reseedea y ademas es el único punto que
define la secuencia de siembra) seguido del gate. Tras el cambio de reporter, la suite
completa se volvió a correr: **38 passed / 0 failed / 0 flaky, exit 0**, con las 38 líneas `✓`
del reporter `list` presentes. El YAML parsea con dos parsers independientes (`yaml` 2.9.1 y
`js-yaml` 4.3.2) y solo usa tags de acción ya presentes en este repositorio.

**Lo que no se puede probar desde aquí.** Que `ubuntu-latest` tenga Docker operativo, que
`supabase start` entre en el timeout de 30 minutos en un runner frío, y que los tags de las
acciones resuelvan. Son las únicas afirmaciones del gate que quedan a merced del primer push
a `main`.

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
| 6 | Verificar la suite completa en chromium sin fallos | hecho | `CI=1`: **38 passed / 0 failed / 0 flaky / 0 did not run, exit 0**, 1,1 min, repetido por un verificador independiente sobre el mismo árbol |
| 7 | Corregir los fallos de la suite completa (E-5 a E-9) | hecho | Cinco expectativas obsoletas y una fuga de fixture, en los cuatro specs afectados (E-5, E-6, E-7, E-8, E-9); diagnóstico con evidencia de DOM y causalidad medida para E-9 |
| 8 | Implementar el gate E2E en CI: job en push a `main`, solo chromium | hecho | Job `e2e` en `.github/workflows/ci.yml`: chromium, stack local, `.env.local` generado desde `supabase status -o env` (sin secretos) y el gate completo. YAML válido bajo dos parsers, filtro auditado contra entrada adversaria, y el gate re-verificado tras el cambio de reporter: 38/38, exit 0. El alcance de E-D se cumple; la disposición en los workflows la cambia la tarea 10, por la decisión E-I |
| 10 | Gatear el merge y el publish con el mismo workflow reutilizable (decisión E-I) | hecho | `.github/workflows/e2e.yml` nuevo, con los 8 pasos idénticos a los del job anterior (diff vacío tras el round-trip de YAML, comentarios incluidos); `ci.yml` con el llamador bajo `if: pull_request` y `deploy.yml` con el llamador sin condición y `deploy.needs: [build, e2e]`. Un evento, una corrida de la suite. YAML válido bajo dos parsers y el gate local sigue en 38/38, exit 0 |
| 9 | Documentación: cerrar V9 en `reservas.md` y el punto de CI en `endurecimiento.md` y `consolidacion.md` | pendiente | |

## Defectos encontrados

| ID | Defecto | Estado | Evidencia |
| --- | --- | --- | --- |
| E-1 | La aserción de orden por coordenada `y` es inválida en un mosaico multicolumna | corregido por la tarea 2 | Ambas tarjetas en la fila de `y = 537` |
| E-2 | La limpieza de `wishlist.spec.ts` llama a una ruta `/api/*` que ya no existe: 404 en cada `afterEach`, filas acumuladas y fallo intermitente | corregido por la tarea 2 | `request.delete(.../api/wishlist/<id>)` en `e2e/wishlist.spec.ts:27`; `app/api` no existe; 7 filas acumuladas de `e2e-test@test.com` antes del reseed |
| E-3 | La navegación por pestañas deja el clic del amigo sobre un nodo no visible | corregido por la tarea 3 | `getByText('Juan Perez').first()` resuelve a un `div` no visible tras `?tab=groups` |
| E-4 | La corrida nunca termina: sin resumen, sin código de salida y con el servidor dev huérfano en `:8081` | corregido y verificado | Causa raíz medida: Playwright lanza el `webServer` con `detached: true` y en el teardown hace `process.kill(-childPid, 'SIGKILL')`; `pnpm` pone el script en su propio grupo, así que `expo` escapaba (`ppid=pnpm`, `pgid` propio) y retenía los pipes de stdio: el evento `close` del hijo no llegaba y `waitForCleanup` esperaba para siempre. Con el CLI directo, `expo` es el hijo directo de Playwright y líder del grupo que sí se mata. |
| E-5 | Tres tests buscan un ancla `a[href*="/groups/create"]` que la app nunca renderiza | corregido | Eran **3**, no 4, y el `:159` del registro previo era E-8. La ruta `app/groups/create` existe, pero la entrada es un `PrimaryButton` con `router.push('/groups/create')` (`components/GroupsTab.tsx:329,376`), no un enlace; solo `/groups/join` es un `<Link asChild>`. Se localiza por nombre accesible: `getByRole('button', { name: 'Crear grupo' })`. Los specs siguen verificando visibilidad, clic, URL y las filas creadas en la base |
| E-6 | `profile.spec.ts:19` no ve «Mi Perfil» | corregido | No era un defecto de render ni un problema de viewport: con `{ exact: true }` Playwright compara **sensible a mayúsculas**, y la app renderiza `Mi perfil` (`components/ResponsiveLayout.tsx:111`, `components/ProfileTab.tsx:106`). La cadena `Mi Perfil` no existe en la app. Se conservan `{ exact: true }` y `.last()`, necesario porque en escritorio coinciden dos nodos. El aviso `Unexpected text node` de React Native Web es ruido de consola ajeno y **sigue ahí**, sin que ninguna aserción lo cubra |
| E-7 | `pwa.spec.ts:14` espera el añil `#4F46E5` y la app emite `#aa2c32` | corregido | `#4F46E5` no aparece en ninguna parte de la app. El color es `#aa2c32` y es consistente 4/4 en `app/_layout.tsx:17` (que lo inyecta en `meta[name="theme-color"]`), `app.json:31`, `public/manifest.json:8` y `tailwind.config.cjs:12`. Se actualizan las dos aserciones y se añade el comentario que nombra la fuente de verdad |
| E-8 | `create-group.spec.ts:86` y `:159` afirman `Toca para cambiar el icono`, que la app no renderiza | corregido | El selector de iconos no está implementado: la pantalla muestra el emoji estático y la etiqueta `Icono del grupo` (`app/groups/create/index.tsx:59`), y `git log -S` muestra que la copia se retiró en `b0d9d45` sin actualizar el spec. Se afirma la etiqueta real y el test se renombra a «Muestra la sección de icono del grupo», porque su título anterior prometía una selección que nunca verificaba; ver E-11 |
| E-9 | `profile.spec.ts` muta el fixture compartido del usuario E2E y no lo restaura | corregido | Renombraba al usuario a `Usuario E2E <timestamp>` y cambiaba avatar y tallas; con `workers: 1` corría antes que `wishlist-visibility.spec.ts:136`, donde el clic nunca resolvía `E2E Test User` (timeout de 30 s en los 3 intentos). Un `afterEach` devuelve ahora las siete columnas sembradas y falla en voz alta si la escritura falla. Hueco conocido: el `update` no comprueba filas afectadas, así que sería un no-op silencioso si la fila no existiera; hoy el seed la garantiza |
| E-10 | La suite no se autolimpia: `create-group.spec.ts:40` y `join-group.spec.ts:56` siguen llamando a `/api/groups/<id>`, ruta que no existe | abierto | Misma clase que E-2, no cubierto por la tarea 7 porque ningún test falla por él: cada corrida registra `Status 404` y deja grupos de prueba (medido: 7 grupos frente a 4 sembrados tras una corrida). El residuo desaparece en el `test:e2e:prepare` siguiente. Arreglo acotado: limpiar por `supabaseAdmin`, como ya hace `wishlist.spec.ts` |
| E-11 | `profile.spec.ts:147` afirma que el botón de guardar es visible, nunca que esté deshabilitado con un nombre inválido | abierto | El componente sí expone el contrato (`disabled={saving || !isFormValid}`, `components/ProfileTab.tsx:214`) y el propio comentario del test dice que el feedback es deshabilitar el CTA, así que la aserción es más débil que lo que el test pretende cubrir. Hallado en la auditoría del diff de la tarea 7; fuera de su alcance |

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Arreglar la aserción en vez de la aplicación: el orden real podría estar mal | El orden lo calcula `components/WishListTab.tsx:106-118`; el spec verifica el orden de render, que es la consecuencia observable de ese comparador. Si el orden fuera incorrecto, el spec debe fallar y la corrección va en el componente. Verificado: pasa |
| Un gate E2E en CI añade minutos a cada PR y puede volverse ruidoso | Alcance decidido por el usuario: solo `main`, solo chromium (E-D). La corrida completa medida tarda 5,4 min con `workers: 1` |
| El arreglo de E-4 depende de que el CLI de Expo no se reagrupe en el futuro | Si una versión futura de Expo lanzara el servidor en otro grupo, el defecto volvería. La comprobación barata está en *Mediciones*, y el gate en CI pondría un techo de tiempo que lo haría visible |
| `node node_modules/expo/bin/cli` asume el layout hoisted de pnpm | Verificado en este repo (`node_modules/expo/bin/cli` existe y `expo --version` da 54.0.27). Con un install no hoisted habría que resolver la ruta por el binario del paquete |
| La suite deja residuo y depende del reseed previo | E-10 abierto: `test:e2e:prepare` reseedea antes de cada corrida y el gate de CI siempre lo ejecuta. Un gate que lance Playwright sin `prepare` iría acumulando grupos de prueba y volvería intermitente el orden del mosaico |
| Un gate que no bloquea nada da falsa sensación de protección | Resuelto por E-I: el publish es de fallo cerrado (`deploy` no corre si el E2E falla o se cancela) y el merge se puede bloquear exigiendo el check `E2E gate / Chromium suite`. Esa exigencia **solo se configura en los ajustes de GitHub**, no en el repositorio, así que hoy el gate avisa en el PR pero nadie impide el merge por él |
| El E2E en cada PR alarga cada PR | Costo aceptado por el usuario en E-I. `concurrency` de `ci.yml` es `cancel-in-progress: true`, así que un push nuevo cancela la corrida anterior del mismo PR en vez de acumularla. La medición local de la suite es 1,1 min; el costo real lo domina el arranque del stack y la instalación de chromium en un runner frío |
| El primer push a `main` es la primera prueba real del job | Todo lo verificable sin runner está verificado (YAML, filtro de entorno, orden de pasos, suite local). Quedan a merced del runner: Docker y `supabase start`, la resolución de los tags de acción y el timeout de 30 minutos |

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
- En Playwright, `{ exact: true }` compara **sensible a mayúsculas**: `getByText('Mi Perfil',
  { exact: true })` no encuentra `Mi perfil`. Sin `exact`, la coincidencia por cadena es
  insensible a mayúsculas y por subcadena.
- El snapshot de accesibilidad que Playwright deja en
  `test-results/<test>/error-context.md` es la evidencia del DOM en el momento del fallo: en
  E-9 mostró el nodo real (`Usuario E2E 1790442082315`) en lugar de la cadena buscada, y eso
  resolvió el diagnóstico sin instrumentar nada.
- «Did not run» no es un aprobado: los dos tests de `wishlist-visibility.spec.ts` no corrieron
  en la corrida del baseline, y el fallo E-9 solo apareció cuando la suite pudo completarse.

## Fuera de alcance

- Los otros proyectos de navegador (firefox, webkit, Mobile Chrome, Mobile Safari):
  siguen existiendo para uso local; solo chromium está verificado.
- `test:e2e:prepare` y el seed, que hoy funcionan.
- El lint bloqueante y S11/S12/S13.
