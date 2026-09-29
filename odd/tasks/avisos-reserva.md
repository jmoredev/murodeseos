# El aviso de reserva que nunca se envió

**Feature:** `avisos-reserva`
**Rama:** `fix/avisos-reserva`
**Abierta:** 2026-09-29
**Estado:** en curso

## Objetivo

Restaurar el aviso `wish_reserved`: cuando alguien reserva un deseo, los demás
miembros de los grupos compartidos entre quien reserva y el dueño deben recibir
una notificación. Hoy ese aviso no se genera nunca.

## Contexto encontrado

- **El aviso es código muerto.** `notifyWishReserved` (`lib/notification-utils.ts`)
  no se invoca desde ningún punto de la app. El commit de la migración a Expo PWA
  (`7475793`) borró `app/wishlist/[userId]/page.tsx`, que era su único llamador, y
  la página actual (`app/wishlist/[id]/index.tsx`) solo llama a
  `reserveWishlistItem`. El aviso no se volvió a conectar.
- **La base tampoco lo repone.** Al mover la reserva a `wishlist_reservations`
  (`20260925120000`) se añadió un trigger para `wish_deleted_by_owner`, pero no
  para `wish_reserved`. El único `INSERT INTO notifications` de las migraciones es
  el del borrado.
- **El resto de avisos sí funciona.** `wish_added` (cliente), `draw_performed`
  (cliente) y `wish_deleted_by_owner` (trigger) están conectados. Solo
  `wish_reserved` está roto.
- **El código muerto además ignora las exclusiones.** No mira
  `wishlist_items.excluded_group_ids`, así que de haberse llamado habría avisado a
  grupos desde los que el deseo está excluido, en contra de la política de
  visibilidad.
- **Semántica prevista:** avisar a los miembros de los grupos comunes entre quien
  reserva y el dueño, excluyendo a quien reserva (ya lo sabe) y al dueño (para no
  romper la sorpresa).

## Decisiones

- **D1 — El aviso pasa a un trigger de la base.** `AFTER INSERT ON
  wishlist_reservations`, al estilo de `private.notify_wish_deleted()`. Es atómico
  con la reserva, independiente del cliente y no se pierde si el navegador cierra
  la pestaña. La vía cliente era frágil (fire-and-forget con errores silenciados) y
  no cubre reservas hechas por otra vía.
- **D2 — El trigger respeta `excluded_group_ids`.** Un grupo excluido del deseo no
  recibe el aviso, igual que no ve el deseo.
- **D3 — Se retira `notifyWishReserved` del cliente y su test unitario.** Dejar una
  función que aparenta implementar el aviso, pero que nadie llama, es una trampa
  para el próximo cambio. El aviso vive ahora solo en la base.
- **D4 — No se toca `notifyWishAdded` ni `notifySecretSantaDraw`.** Funcionan y son
  otra unidad.

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Migración con el trigger `private.notify_wish_reserved` | **hecho** | `supabase/migrations/20260929120000_notify_wish_reserved.sql` |
| 2 | Retirar `notifyWishReserved` y su test | **hecho** | `lib/notification-utils.ts` (nota que remite al trigger) y `__tests__/notifications.test.ts`; 5 tests en verde |
| 3 | Verificación local contra la base (matriz de roles) | **hecho** | aplicada en local y matriz de roles en verde (ver abajo) |
| 4 | Prueba E2E del aviso para un tercer miembro | **escrita, ejecución bloqueada** | `e2e/notification-reservation.spec.ts` (Playwright la lista); ver bloqueo abajo |
| 5 | typecheck, lint y unitarios | **hecho** | `tsc --noEmit` 0; `eslint --max-warnings 0` 0; 151 unitarios en verde, 1 todo |

## Restricciones

- La migración es aditiva e idempotente: no borra ni reescribe datos.
- No cambia la semántica de visibilidad: el aviso usa la misma regla de grupos
  comunes y exclusiones que la política SELECT.
- No se toca la RLS de `notifications`: el trigger corre como dueño de la tabla.

## Verificación

### Revisión nativa

Aprobada sin abrir corrección (tier medio, lente de fiabilidad; autoridad quemada con
`gentle-ai.review-acknowledged/v1`). Devolvió **dos hallazgos informativos**, que no
bloquean y se trabajan aparte:

| ID | Lente | Ubicación | Gravedad |
| --- | --- | --- | --- |
| R3-001 | fiabilidad | `supabase/migrations/20260929120000_notify_wish_reserved.sql:47-64` | aviso |
| R3-002 | fiabilidad | `e2e/notification-reservation.spec.ts:69-90` | aviso |

Ninguno reabre la revisión ni ofrece transición de corrección.

### Matriz de roles contra la base local

Migración aplicada en el contenedor local y comprobada en una transacción revertida
(no deja datos). Fixture: María dueña; Juan reservador; Ana en dos grupos comunes
con ambos; Carlos en uno; el usuario E2E fuera de todo grupo común.

| Caso | Esperado | Observado |
| --- | --- | --- |
| A — sin exclusiones | Ana y Carlos, una fila cada uno | Ana (`BOOK01`), Carlos (`WORK01`) |
| Deduplicación — Ana en dos grupos comunes | 1 fila | 1 fila |
| B — deseo excluido de `WORK01` | solo Ana | solo Ana |
| D — deseo excluido de `FAM001` y `BOOK01` | solo Carlos | solo Carlos |
| C — reserva del propio dueño | 0 avisos | 0 |
| Tercero sin grupo común | 0 avisos | 0 |
| Autoría | `actor_id` = reservador | siempre Juan |
| Visibilidad previa | Juan ve el deseo de María | 1 |

La reserva de A y B se hizo como rol `authenticated` con el JWT de Juan, así que
pasó por la RLS real de `wishlist_reservations`, no solo por el trigger.

### Pendiente

Ejecución real de `e2e/notification-reservation.spec.ts`. **Bloqueada por el entorno**: este shell no alcanza los puertos publicados de Docker, con toda probabilidad por Tailscale con exit node activo (el usuario lo desactivará y avisará para correrla). Kong responde `200` desde dentro de la red (`http://kong:8000/auth/v1/health`), pero ni `127.0.0.1:3001` ni la IP del contenedor (`172.18.0.11:8000`) devuelven un byte desde el host, y el navegador de Playwright corre en el host. No es un defecto del código: la prueba se lista con `playwright test --list` y typechequea. Se ejecuta con `pnpm run test:e2e` en un shell normal.

### Comprobaciones estáticas y unitarias (hechas)

- `pnpm exec tsc --noEmit` — 0 errores.
- `pnpm run lint` (`eslint --max-warnings 0`) — 0 avisos.
- `pnpm run test:unit` — 151 pruebas en verde, 1 todo.
- `playwright test --list e2e/notification-reservation.spec.ts` — la prueba aparece.

## Consecuencia

El aviso de reserva vuelve a existir, y esta vez en la base: se genera al
insertar la reserva, respeta las exclusiones y no depende del cliente. El código
muerto que aparentaba implementarlo queda retirado. Queda como deuda la ejecución
del E2E, bloqueada solo por la red de este entorno.
