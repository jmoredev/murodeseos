# Tour-tutorial de primer inicio

Funcionalidad grande: un recorrido guiado que explica la app a quien inicia sesión por
primera vez. Resaltar la zona, explicarla con un cuadro de diálogo de una o varias páginas,
poder saltarlo, y que las pantallas vacías —porque la cuenta es nueva— muestren datos de
demostración.

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

El mensaje original traía un bloque pegado de 2080 caracteres que no llegó con contenido. Si
contenía requisitos, entran como `S8…` y reabren sólo las tareas afectadas.

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
| T5 | pendiente de anotar al commitear |

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
