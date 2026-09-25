# Reservas privadas y visibilidad por grupo

**Feature:** `reservas`
**Estado:** en curso
**Inicio:** 2026-09-25
**Rama:** `feat/reservas-privacidad`
**Cierra:** S1, S2 y D4 de [`endurecimiento.md`](./endurecimiento.md)

## Objetivo

Sacar la reserva de regalos de la tabla que lee el dueño, para que la sorpresa
sea una garantía de la base de datos y no una regla de interfaz, y restringir la
lectura de una lista de deseos a quien comparte un grupo con su dueño.

## Decisiones de esta feature

| # | Decisión | Motivo |
| --- | --- | --- |
| R-A | La visibilidad se calcula sobre un grupo compartido que **no** esté en `excluded_group_ids`. | `app/wishlist/[id]/index.tsx:77-80` filtra las exclusiones solo en el cliente, así que hoy son una fuga de la misma familia que S2. Si la política solo mirase "algún grupo en común", la exclusión seguiría siendo reversible desde DevTools. |
| R-B | El aviso al reservador cuando el dueño borra el deseo pasa a un trigger de la base de datos. | El cliente del dueño ya no puede conocer la autoría, que es justo lo que se busca. El trigger corre como dueño de la tabla, así que la notificación se inserta sin revelar nada al dueño. |
| R-C | La reserva son filas en `public.wishlist_reservations`, con `item_id` como clave primaria. | La unicidad deja de depender de un filtro `.is('reserved_by', null)` del cliente y pasa a ser una restricción de la base: gana el primero, el segundo recibe un error. Cierra D4. |
| R-D | El estado de reserva se lee por una función `SECURITY DEFINER` que devuelve solo `item_id` y si es mía. | Es la vía que recomienda Supabase frente a privilegios por columna, descartados en `endurecimiento.md`. Nunca devuelve autoría. |
| R-E | El dueño no recibe ningún estado de reserva de sus propios deseos. | Es el comportamiento actual (`isOwner` oculta todo) y es el único que garantiza la sorpresa. |

## Diseño

### Tabla de reservas

```sql
create table public.wishlist_reservations (
  item_id     uuid primary key references public.wishlist_items(id) on delete cascade,
  reserver_id uuid not null references auth.users(id) on delete cascade,
  reserved_at timestamptz not null default now()
);
```

`item_id` como clave primaria es la reserva única. `reserved_at` responde a la
ausencia registrada en `docs/DEVELOPMENT.md`.

### Políticas

| Tabla | Operación | Regla |
| --- | --- | --- |
| `wishlist_items` | SELECT | Es mío, o comparto con el dueño algún grupo que no esté excluido |
| `wishlist_items` | UPDATE | Solo el propietario. Desaparece la política de reserva por terceros |
| `wishlist_reservations` | SELECT | Solo mi propia reserva |
| `wishlist_reservations` | INSERT | `reserver_id = auth.uid()` y el deseo me es visible y no es mío |
| `wishlist_reservations` | DELETE | Solo mi propia reserva |

El INSERT reutiliza la política de `wishlist_items` mediante un `EXISTS` sobre esa
tabla: la subconsulta se evalúa con los permisos del invocador, así que solo
encuentra filas que él puede ver. La visibilidad vive en un solo lugar.

### Función de lectura pública

`public.get_wishlist_reservation_states(owner_uuid uuid)` devuelve
`(item_id uuid, reserved_by_me boolean)` para el dueño indicado, aplicando la
misma regla de visibilidad dentro del cuerpo —no puede delegarla en RLS porque es
`SECURITY DEFINER`— y sin devolver nunca `reserver_id`.

### Trigger de borrado

`private.notify_wish_deleted` sobre `wishlist_items` `BEFORE DELETE`: busca la
reserva del deseo, elige un grupo en común entre dueño y reservador, e inserta la
notificación `wish_deleted_by_owner`. Sustituye a la llamada del cliente
(`components/WishListTab.tsx:260-270`), que hoy necesita leer `reserved_by`.

Es `BEFORE` y no `AFTER` a propósito: la cascada de `on delete cascade` la aplica
un trigger interno cuyo nombre empieza por `RI_`, y PostgreSQL ejecuta los
triggers `AFTER ROW` de una tabla en orden alfabético. `RI_` ordena antes que
`tr_`, así que en un `AFTER` la reserva ya estaría borrada y el aviso no se
emitiría nunca.

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Migración completa, en un solo archivo: tabla de reservas, copia de los datos, borrado de la columna y de su índice y clave foránea, política de visibilidad, retirada de la política de reserva por terceros, reescritura del trigger de permisos, función de estado de reserva y trigger de aviso de borrado | hecho | `2e6c11b`, `supabase/migrations/20260925120000_wishlist_reservations_privacy.sql` |
| 2 | Verificación local: `supabase db reset` y matriz de acceso por rol contra la base local | hecho | 20 migraciones aplicadas; matriz de acceso por rol (dueño, miembro, miembro del grupo excluido, tercero), reserva única, cascada, aviso, privilegios y reejecución, todo verificado en local |
| 3 | Cliente: `lib/wish-reservation.ts` sobre la tabla nueva y lectura del estado por función | hecho | `ac4a97b`: `reserveWishlistItem` inserta en `wishlist_reservations`, `cancelWishlistReservation` borra la fila propia y `getWishlistReservationStates` lee el RPC |
| 4 | Cliente: los cuatro componentes sobre estado de reserva, y retirada del aviso de borrado | hecho | `ac4a97b`: vocabulario `available`/`reserved_by_me`/`reserved_by_other`, `isOwner` correcto en la vista de amigo y `notifyWishDeletedByOwner` eliminado |
| 5 | Tests unitarios de reserva y de estado de reserva | hecho | `ac4a97b`: 12 archivos, 118 tests en verde, 1 pendiente |
| 6 | Seed y fixtures E2E sobre la tabla nueva | hecho | `caa2e3b`: el seed inserta las reservas en `wishlist_reservations` de a una por deseo para conocer el id devuelto; comprobado en la base local: 3 reservas con sus reservadores |
| 7 | Documentación: `docs/DEVELOPMENT.md` y cierre de S1, S2 y D4 en `endurecimiento.md` | hecho | `docs/DEVELOPMENT.md` y las fichas de S1 y S2 en `endurecimiento.md` y `consolidacion.md` |
| 8 | Ensayo en seco sobre producción y aplicación con aprobación explícita | pendiente | |

## Defectos encontrados

| ID | Defecto | Estado | Evidencia |
| --- | --- | --- | --- |
| V1 | La migración no era idempotente: la política `"Veo mis deseos y los de mis grupos"` se creaba sin `drop policy if exists` previo, así que una segunda ejecución fallaba con "policy already exists" | corregido | hallado por la verificación local al reejecutar el archivo; tras el arreglo, dos ejecuciones seguidas salen con código 0 |
| V2 | El orden natural del archivo era inválido: `drop column reserved_by` antes de retirar la política de reserva por terceros falla con "cannot drop column because other objects depend on it" | corregido | la política se retira antes (bloque 3 del archivo) |
| V3 | El filtro de exclusiones duplicado en el cliente ocultaba al dueño sus propios deseos excluidos en su propia lista, y era más estricto que la política de la base en el caso de un grupo excluido no compartido | corregido | `app/wishlist/[id]/index.tsx`: se retira el filtro y `viewerGroupIds`; la regla queda solo en la política |
| V4 | El prop `currentUserId` quedó muerto en `WishlistCard` y `WishDetailModal`, junto con sus llamadas: la autoría ya no tiene por dónde entrar a la interfaz | corregido | hallado por la verificación; retirado de los dos interfaces, de los dos puntos de llamada y de los tres renders de test |
| V5 | `playwright.config.ts` arrancaba el servidor con `bun run web`, y bun no está instalado desde la migración a pnpm: la suite E2E no podía ni empezar | corregido | `7d97e56`: pasa a `pnpm run web` |
| V6 | La suite E2E parecía rota de forma general y no arrancaba | corregido | Eran tres causas distintas y ninguna era de las reservas: las filas crudas en `auth.users` con tokens en NULL que hacían devolver 500 a `auth.admin.listUsers()`, el canal realtime duplicado (V7) y el `testID` mal colocado (V8). Tras las tres, el spec de reserva de la vista de amigo pasa |
| V7 | `NotificationMenu` reutilizaba el tema del canal realtime y lanzaba `cannot add postgres_changes callbacks ... after subscribe()`; el overlay de errores de Expo tapaba la pantalla y se comía todos los clics | corregido | `dfd6fa3`: el sufijo del tema sale de un contador de módulo; cero apariciones del error en 7 ejecuciones de test y 3 contextos. El primer intento con `useRef` no servía: un ref se reinicia en cada instancia, así que al navegar entre dos páginas que montan el menú volvía a colisionar |
| V8 | `testID="wishlist-card-<id>"` estaba en el `Pressable` interno, pero los botones de acción son hermanos suyos dentro del mosaico, así que `card.getByTestId('wish-reserve-button')` no podía resolverse nunca | corregido | El hook pasa al `View` exterior del mosaico, que es lo que los dos specs de vista de amigo entienden por tarjeta |
| V9 | Dos fallos del E2E siguen siendo ajenos a las reservas: `already-have-it.spec.ts:64` usa `getByText('Juan Perez').first()`, que resuelve a un nodo no visible, y `wishlist.spec.ts:109` compara dos posiciones de ordenación que resuelven iguales | abierto | Tarea pendiente: reparar la suite E2E y llevarla al CI |

## Verificación de la migración (hecha, en local)

- `pnpm exec supabase db reset` aplica **20 migraciones** desde cero y termina con código 0.
- Matriz de acceso ejecutada como `authenticated` con `set local role` y `request.jwt.claims`:
  el dueño ve sus deseos y los del grupo compartido (3); el miembro del grupo ve
  los tres; el miembro del grupo excluido ve 0; el tercero sin grupo ve 0.
- `select reserved_by` sobre `wishlist_items` falla con `42703`: la columna ya no existe.
- `get_wishlist_reservation_states`: 1 fila con `reserved_by_me = true` para quien
  reservó, 0 filas para el tercero, 0 para el grupo excluido, 0 para el dueño
  sobre sus propios deseos, y 0 para quien pregunta por sí mismo. La firma
  devuelve exactamente `(item_id, reserved_by_me)`; `reserver_id` no es accesible.
- Reserva: repetir la reserva falla con `23505`; el tercero, el grupo excluido y
  el dueño sobre su propio deseo fallan con `42501`; quien puede ver el deseo
  reserva con éxito.
- Aviso: al borrar el dueño un deseo reservado se inserta exactamente **una**
  notificación `wish_deleted_by_owner` para el reservador, con `actor_id` del
  dueño y el grupo común; borrar un deseo sin reserva no inserta ninguna. El
  trigger es `BEFORE DELETE`.
- Privilegios: `anon` no tiene `select`, `insert` ni `delete` sobre la tabla nueva
  ni `execute` sobre la función; `authenticated` tiene `select`, `insert`,
  `delete` y `execute`, y no tiene `update`.
- Reejecución: el archivo ejecutado dos veces seguidas termina con código 0 y deja
  el estado final idéntico.

## Verificación del cliente (hecha, en local)

- `pnpm run typecheck` termina con código 0.
- `pnpm run test:unit`: 12 archivos, 118 tests en verde y 1 pendiente.
- `pnpm run lint`: 16 errores y 21 avisos, **delta cero**; ninguno está en los
  archivos tocados. Es la misma deuda previa a esta feature.
- `pnpm run build` genera `dist` con 12 rutas estáticas. Sin las variables de
  entorno de Supabase falla en `lib/supabase.ts`, que es la puerta conocida del
  proyecto y no un defecto de este cambio.
- Los tests cubren los seis comportamientos nuevos: inserción con `item_id` y
  `reserver_id`, `23505` y `42501` traducidos al mensaje de no disponible,
  cancelación por `item_id` y `reserver_id`, cancelación sin fila devuelta,
  construcción del mapa desde el RPC con el parámetro `owner_uuid`, y propagación
  del error del RPC en lugar de un mapa vacío que pintaría todo como disponible.
- La prueba de residuo es estricta: `grep -rnE "reserved_by([^_]|$)"` y
  `grep -rn "reservedBy" | grep -vE "reservedBy(Me|Other)"` no devuelven nada en
  `app/`, `components/`, `lib/` ni `__tests__/`. Lo que queda es el vocabulario de
  estado `reserved_by_me`/`reserved_by_other`, que es el campo que devuelve la
  función de la base y no la autoría.

## Verificación del flujo de reserva en navegador (hecha)

- `pnpm exec playwright test e2e/responsive-wishlist.spec.ts --project=chromium`:
  **5 de 5 en verde**, incluido «debe permitir reservar un artículo en la vista
  de amigo», que pulsa Reservar y luego exige ver `Reservado por ti` y el botón de
  cancelar.
- La fila no se puede observar después de la ejecución porque el `afterEach` del
  spec cancela la reserva y borra el deseo, y la clave foránea se lleva la
  reserva por cascada. Que la escritura ocurrió lo sostienen dos cosas:
  `pg_stat_user_tables` da 16 inserciones y 15 borrados en
  `wishlist_reservations` con 1 fila viva, y la reserva del cliente no es
  optimista —`lib/wish-reservation.ts` espera el insert y lanza si falla—, así
  que la aserción de interfaz no podría pasar sin una inserción correcta.
- El error de realtime aparece **cero veces** en el log del servidor y en los
  artefactos de test.
- `pnpm run typecheck` en 0 y `pnpm run test:unit` con 12 archivos y 118 tests en
  verde, 1 pendiente.

## Verificación pendiente

- El resto de la suite E2E: ver el defecto V9 y la tarea de repararla.
- El ensayo en seco sobre producción y su aplicación (tarea 8).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Una política de lectura demasiado estrecha deja a usuarios reales sin acceso | La matriz de acceso se ejecuta en local antes de tocar producción, y el `db push` va precedido de un `--dry-run` |
| La copia de datos pierde reservas existentes | El `INSERT ... SELECT` se ejecuta y se cuenta contra `reserved_by IS NOT NULL` antes de borrar la columna, en la misma transacción |
| El trigger de borrado inserta notificaciones con un grupo que no corresponde | Mismo criterio de grupo en común que `lib/notification-utils.ts`, y `group_id` admite nulo |

## Fuera de alcance

- S11, S12 y S13, el lint bloqueante y los E2E en CI: siguen en
  `endurecimiento.md` y `consolidacion.md`.
- Notificaciones push web (D6).
- Cambios de producto en la interfaz de reserva: la reserva se sigue pidiendo y
  cancelando desde los mismos componentes.
