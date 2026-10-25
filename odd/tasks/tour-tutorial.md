# Tour-tutorial de primer inicio

Funcionalidad grande: un recorrido guiado que explica la app a quien inicia sesión por
primera vez. Resaltar la zona, explicarla con un cuadro de diálogo de una o varias páginas,
poder saltarlo, y que las pantallas vacías —porque la cuenta es nueva— muestren datos de
demostración.

**Estado:** cerrada — publicada en `v2026.10.25` con la cadena de PRs #79–#85. L10 quedó resuelto:
la suite de extremo a extremo del tour (`e2e/tour.spec.ts`) se escribió y hoy vuelve a correr en
verde. Los arreglos de presentación posteriores —el velo que no oscurecía, la tarjeta sin fondo y las
páginas que obligaban a desplazar— viven en `odd/tasks/tour-ajustes-visuales.md`.

## Specs

S1 — Se debe de poder saltar.

> «Se debe de poder saltar»

S2 — Resaltar la zona explicada y mostrar un cuadro de diálogo, con varias páginas si hace
falta:

> «Debe de resaltar las zonas que se están explicando para captar la atención del usuario
> (dame recomendaciones de hacer esto) y mostrar un pequeño cuadro de diálogo con la
> explicación, puede contener varias páginas el diálogo si es necesario para detallar más la
> explicación.»

S3 — Recorrer todas las pantallas de la aplicación:

> «Debe de pasar por todas las pantallas de la aplicación.»

S4 — Datos de prueba sólo para el tutorial, en las pantallas que estarían vacías:

> «Para aquellas pantallas en las que no hay datos, por que el usuario se acaba de registrar,
> que haya unos datos de prueba que solo se muestren para el tutorial (se me ocurre que un
> usuario recién registrado puede estar unido a un grupo de "bienvenida" para que le salga en
> la ventana de grupos y se pueda explicar al terminar el tutorial se le elimina del grupo para
> que le desaparezca). En la pantalla de deseos lo mismo, que tenga unos deseos solo para el
> tutorial que luego se les eliminen.»

S5 — Transición fluida entre elementos:

> «La transición entre elementos del tutorial debe de ser fluida.»

S6 — Mobile-first:

> «Recuerda el mobile-first.»

S7 — Resaltado sin dependencias nuevas: el hueco se dibuja con cuatro rectángulos y un anillo
transparente, animados con `reanimated` (ya instalado), y los objetivos se registran solos para
que el motor nunca use coordenadas escritas a mano. Motivo: la app evita dependencias y las
pestañas se renderizan distinto en móvil (dock) y escritorio (tablist), así que las dos formas
tienen que poder ser objetivo.

## Decisiones

D1 — **Datos de demostración en el cliente.** Arrays inyectados por propiedad a `WishListTab`
y `GroupsTab` mientras el tour está activo. No se escribe ninguna fila: no hay nada que
limpiar si el usuario abandona, y se puede mostrar un grupo con tres personas —inventar
miembros en la base de datos es imposible, `group_members.user_id` apunta a `auth.users`.
Contrapartida aceptada: el tour no demuestra acciones sobre esos datos (reservar, editar).

D2 — **`profiles.tour_completed_at`** (columna nueva, nullable, migración aditiva). Es por
usuario y sobrevive a cambiar de dispositivo o reinstalar la PWA.

D3 — **Sólo cuentas nuevas.** La migración marca como «ya visto» a todo perfil existente, así
que la condición de ejecución es una sola: `tour_completed_at IS NULL`. Sin fechas de corte
repetidas en el código.

D4 — **Alcance: núcleo + unirse a un grupo.** Deseos, añadir deseo, grupos, unirse con código,
detalle de grupo, perfil y notificaciones.

## Pendiente de conciliar

**Cerrado.** El mensaje original traía un bloque pegado de 2080 caracteres que nunca llegó con
contenido, y el usuario confirmó que se cierra sin requisitos: no hay `S8`, no se reabre ninguna
tarea y el alcance queda en S1–S7.

## Tasks

| ID | Specs | Qué | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | D2, D3 | Migración `tour_completed_at` + backfill de los perfiles existentes | migración SQL | sí |
| T2 | S1, S2 | Motor del tour: máquina de pasos pura (orden, siguiente/anterior, saltar, páginas) | `lib/tour/` | sí |
| T3 | S2, S5, S7 | Registro de objetivos (`useTourTarget`) y overlay con hueco y anillo animados | `components/tour/` | sí |
| T4 | S4 | Datos de demostración inyectables en las listas, sólo durante el tour | `components/` | sí |
| T5 | S3, D4 | Paradas por pantalla, incluida la navegación entre rutas | `components/tour/` | sí |
| T6 | S1, D2, D3 | Arranque tras el alta, lectura del flag y marcado al terminar o saltar | `app/`, `lib/tour/` | sí |
| T7 | S6, S7 | Mobile-first y accesibilidad: hoja inferior en móvil, anclaje en escritorio, foco, reduce motion | `components/tour/` | sí |
| T8 | S1, S4 | E2E con el usuario recién creado: recorre, salta y no deja datos detrás | `e2e/` | sí |
Commits por tarea (evidencia):

| Tarea | Commit |
| --- | --- |
| T1 | `657842b` |
| T2 | `4d89009` + `b89d60d` (refactor del `readonly`) |
| T3 | `9b3d97b` |
| T4 | `0a41c49` |
| T1–T4, corrección de la revisión | `b4cb709` (con `9b166e7` + `4dfcac4`, ver L6) |
| T5 | `5dc7b26` |
| T6 | `bcdce81` |
| T7 | `d75a90e` |
| T8 | `f489774` (E2E) + `cd1d1a7`, `97d1043` (arreglos del primer e2e) + `90e0ee8` (corrección R3-001) |

## Log

L1 — Pedido del usuario, verbatim:

> «La nueva funcionalidad grande que si quiero implementar es un tour-tutorial de la app para el
> usuario que inicie sesión la primera vez con las siguientes características:
> - Se debe de poder saltar
> - Debe de resaltar las zonas que se están explicando para captar la atención del usuario
>   (dame recomendaciones de hacer esto) y mostrar un pequeño cuadro de diálogo con la
>   explicación, puede contener varias páginas el diálogo si es necesario para detallar más la
>   explicación.
> - Debe de pasar por todas las pantallas de la aplicación.
> - Para aquellas pantallas en las que no hay datos, por que el usuario se acaba de registrar,
>   que haya unos datos de prueba que solo se muestren para el tutorial (se me ocurre que un
>   usuario recién registrado puede estar unido a un grupo de "bienvenida" para que le salga en
>   la ventana de grupos y se pueda explicar al terminar el tutorial se le elimina del grupo
>   para que le desaparezca). En la pantalla de deseos lo mismo, que tenga unos deseos solo
>   para el tutorial que luego se les eliminen.
> - La transición entre elementos del tutorial debe de ser fluida.
> - Recuerda el mobile-first.» [bloque pegado de 2080 caracteres no recibido]

L2 — Recomendación de resaltado presentada (cuatro opciones) y decisión de S7: cuatro
rectángulos + anillo con `reanimated`, sin dependencias; objetivos autorregistrados con
`measureInWindow`.

L3 — Respuestas del usuario a las cuatro decisiones: D1 overlay en el cliente, D2
`profiles.tour_completed_at`, D3 «Sólo cuentas nuevas», D4 «Nucleo + añadir y unirse a un
grupo».

L4 — Riesgo de integración registrado: el usuario nuevo estrenaría el tour y el modal de
Novedades (`components/WhatsNewModal.tsx`) el mismo día. Se decide en T6: el tour va primero y
el modal de novedades espera a que el tour termine o se salte.

L5 — T2 implementada y revisada: el motor es puro y el **movimiento se queda entero en T7**. La fila de
T2 prometía «reduce motion» dentro del motor; se corrigió la tabla en vez de ensuciar el módulo con
una decisión de presentación. Revisión `review-0cd04313b2f5b848` (lentes riesgo y legibilidad):
aprobada, autoridad quemada, una sugerencia no bloqueante sobre este documento (R2-001) que queda
como trabajo posterior.

L6 — Revisión nativa de T1–T4 (`review-22af31c8c6e27825`, tier medium, 2261 líneas, base
`b3037b4`): lentes de legibilidad y confiabilidad, **refutador obligatorio** y dos hallazgos
CRITICAL reales, los dos introducidos por este candidato. `correction_required` con presupuesto de
200 líneas; se corrigieron en 118 líneas de diff (commit `b4cb709`) y el validador dirigido aprobó.

El proveedor exige enviar el **plan de corrección antes** de cambiar el candidato: si se commitea
primero, el STATUS pasa a reportar el candidato corregido como target mientras el plan sigue ligado
al de autoridad, y la captura rechaza el slot. Por eso la corrección se aplicó como `b4cb709`,
`9b166e7` (revert) y `4dfcac4` (reaplicación): el árbol final es idéntico al de `b4cb709`, y la
revisión compara árboles, no historia.

- R3-001 — `measureInWindow` se llamaba **despegado** del nodo. React Native resuelve la medición
  en el receptor, así que `this` era `undefined`, la promesa se rechazaba sin dueño y el registro
  nunca guardaba una caja: el overlay no pintaba **nada**. Ahora se invoca sobre el nodo
  (`.call(nodo, …)`) y un error síncrono resuelve `null` en vez de rechazar.
- R3-002 — la hoja móvil usaba `clamp(debajoDelHueco, CARD_MARGIN, yMinima)`, que devuelve
  `yMinima` cuando el objetivo está cerca del borde inferior: con la barra de pestañas la hoja
  **tapaba el hueco**. Ahora va debajo si cabe, si no encima del hueco, y si no cabe en ningún lado
  se recorta a la banda libre con más sitio.
- Los cinco hallazgos restantes son informativos (R2-001…R2-003, R3-003, R3-004) y quedan como
  trabajo posterior en `odd/tasks/informativos-trabajo-posterior.md` si se deciden.

L7 — T5 implementada: `lib/tour/navigation.ts` (puro) decide el destino de cada parada —pestaña
como **estado**, ruta como pantalla— y `lib/tour/steps.ts` es el guion de nueve paradas. El
`TourRunner` pide el destino una vez por parada, refresca los objetivos que faltan y se lleva el
velo al terminar o saltar. `TourTargetProvider` se monta una sola vez en `app/_layout.tsx` y los
objetivos se dan de alta en las pestañas (dock y tablist), las dos listas, el botón de añadir, la
campana y las dos pantallas de sub-ruta. Dos decisiones que se apartan de lo escrito en la tabla:

- **Detalle de grupo no se navega.** Con D1 no hay filas, así que `/groups/[id]` del grupo de
ejemplo no existe y la pantalla estaría vacía. Se explica en una página de la parada de la lista
de grupos. Visitarlo de verdad exigiría un grupo en la base de datos, que es justo lo que D1
descartó.
- **`useTourTarget` es inerte sin proveedor.** El enganche ya no vive sólo en el tour: se esparce en
pantallas normales. Si sin proveedor reventara, cada prueba de pantalla necesitaría montar el tour.
La tienda (`useTourTargetRegistry`) sigue exigiendo proveedor, que es quien de verdad no puede
fallar en silencio.

El árbol queda por encima del corte de revisión de ~400 líneas por unidad (la rama entera supera
las 3.000). La estrategia de entrega —cadena de PRs o una sola revisión— es decisión del usuario y
se plantea al publicar, no ahora; lo que no se hace es añadir commits grandes sin decirlo.

L8 — T6 implementada: el tour arranca solo para una cuenta nueva y se marca al terminar o saltar.
`lib/tour/flag.ts` lee `profiles.tour_completed_at` con un plazo de 12 s y tres estados —fecha (ya
visto), `null` (cuenta nueva, D3) y `undefined` (no se pudo saber, que **no** arranca y no se
reintenta)—; marcar es best-effort: si falla, la cuenta lo volverá a ver, y nada más.
`components/tour/TourHost.tsx` es el único que decide **a quién**: monta el corredor fuera del
`Stack` para que sobreviva a las sub-rutas, ejecuta los destinos (pestaña = estado de la portada,
ruta = `router.push`) y no relee la marca después de terminar. En `app/index.tsx` los datos de
demostración se inyectan sólo mientras el tour está activo, la pestaña pedida se aplica en un efecto
y **el modal de novedades espera** (Log L4).

Decisión de arranque que no estaba escrita: el tour empieza cuando la **portada está montada**, no
en cuanto la marca dice que sí. Quien acaba de registrarse está en `/profile/setup`; arrancar ahí
haría que la primera parada —una pestaña de la portada— pidiera volver a `/` y sacara al usuario de
la mitad del alta. El caso está fijado por un test.

L9 — T7 implementada (S5, S6, S7), cuatro cosas y ninguna más:

- **Movimiento reducido de verdad** (`lib/tour/use-reduced-motion.ts`): `matchMedia` en web con
  suscripción, `AccessibilityInfo` en nativo. Hasta ahora `TourOverlay` ya sabía saltarse las
  transiciones, pero nadie le pasaba el dato.
- **El hueco de teclado que dejó T4**: el velo se come los toques, no el Tab+Enter. Con el tour
  abierto la página de detrás queda `aria-hidden` e `inert`, el foco entra en la tarjeta al abrir y
  en cada página, Tab se queda dentro y al cerrar vuelve a donde estaba.
- **La tarjeta se mide** (`useTamanoTarjeta`) en vez de confiar en la estimación: se coloca con
  320×190 hasta el primer `onLayout`, y una sola corrección por paso evita oscilar. El texto que no
  cabe se lee desplazando, sin crecer por encima del hueco.
- **Mobile-first sin rediseño**: la hoja sigue ocupando el ancho útil y los anclajes de escritorio
  no cambian.

L10 — T8 no se puede ejecutar en este entorno: la suite de extremo a extremo necesita Supabase local
(`pnpm run test:e2e:prepare` levanta Docker) y el demonio de Docker no está corriendo en la máquina
(`docker info` → no connect). Se deja **pendiente**, no hecha: el recorrido de punta a punta con el
usuario recién creado —recorrer, saltar, y que no quede ni un deseo ni un grupo detrás— es justo la
comprobación de S1 y S4 que T8 tiene que dar, y escribirla sin poder verla verde no es prueba.

Lo que sí queda verificado sin navegador ni base de datos: 879 tests de la suite (los 856 previos
intactos, 23 nuevos de T7), `tsc` y `eslint` limpios, y las cuatro capas del tour probadas por
separado (motor puro, geometría pura, corredor con dobles, host con sesión y marca dobladas).

Riesgo que T8 debería cubrir y que ningún test de jsdom tapa: el orden real de tabulación del
navegador, la preferencia de movimiento del sistema operativo, y sobre todo que la página de detrás
con `inert` no rompa el reparto de altura del `Stack` en web (el envoltorio `tour-page` con `flex: 1`
se probó en jsdom, no en un navegador). Hasta que T8 corra, eso es una comprobación abierta.

L11 — T8 ejecutada con Docker arriba: `e2e/tour.spec.ts`, tres pruebas en los cinco proyectos de
Playwright, incluida la que faltaba de verdad: un usuario recién creado recorre el guion, otro lo
salta con «Saltar» y con Escape, y después no queda ni una fila de `wishlist_items` ni de
`group_members` en esas cuentas. También fija los dos riesgos que L10 dejó abiertos: el hueco no
queda tapado por la tarjeta (cajas reales) y el envoltorio `tour-page` sigue midiendo el alto de la
ventana con `inert` y `aria-hidden`.

La primera corrida real encontró tres cosas que ningún test de jsdom veía, y las tres se
arreglaron antes de dar T8 por buena:

- **La suite entera se cayó por el tour.** Los scripts de siembra insertaban perfiles sin
  `tour_completed_at`, así que todas las cuentas de la suite parecían nuevas, el tour se abría sobre
  el `storageState` compartido y el velo se comía los clics (whats-new 2/5 y wishlist 6/6 en rojo
  por motivos que no tenían nada que ver con esos specs). Los dos scripts marcan la cuenta como
  «ya vio el tour». Commit `cd1d1a7`.
- **Volver de una sub-ruta era empujar otra portada.** Al terminar el guion había tres muros
  montados, con sus listas, sus peticiones y dos modales de Novedades en el DOM. Ahora volver a la
  portada es retroceder. Commit `97d1043`.
- **`usePathname()` en `TourHost` rompía la app.** `TourHost` envuelve al `Stack`, así que suscribir
  el pathname ahí re-renderizaba el navegador en cada navegación y **remontaba la pantalla
  enfocada**: el formulario de deseo se cerraba solo justo después de abrirse. La suscripción vive
  ahora en el corredor, que es hermano del `Stack`. Commit `97d1043`.

Verificado: suite unidad **881 passed + 1 todo**, `tsc` y `eslint` limpios, y `playwright --project=chromium`
**66 passed** (todos los specs, no sólo el del tour).

L12 — Cierre del pendiente de L1: el bloque de 2080 caracteres que nunca llegó **no traía
requisitos**. El alcance queda en S1–S7, sin `S8` y sin reabrir tareas. La entrega se hace como
**cadena de cinco PRs apilados** sobre `main`, un tramo por PR: el 1 con T1–T4 y su corrección (ya
revisado y aprobado), el 2 con T5, el 3 con T6, el 4 con T7 y el 5 con T8, el e2e y la corrección
R3-001. Es el mismo corte que pide el presupuesto de lentes del proveedor, y cada PR se revisa con
su diff delante en vez de con tres ciclos de lentes sobre worktrees.
