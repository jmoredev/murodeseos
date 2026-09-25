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

`public.get_wishlist_reservation_states(owner_id uuid)` devuelve
`(item_id uuid, reserved_by_me boolean)` para el dueño indicado, aplicando la
misma regla de visibilidad dentro del cuerpo —no puede delegarla en RLS porque es
`SECURITY DEFINER`— y sin devolver nunca `reserver_id`.

### Trigger de borrado

`private.notify_wish_deleted` sobre `wishlist_items` `AFTER DELETE`: busca la
reserva del deseo, elige un grupo en común entre dueño y reservador, e inserta la
notificación `wish_deleted_by_owner`. Sustituye a la llamada del cliente
(`components/WishListTab.tsx:260-270`), que hoy necesita leer `reserved_by`.

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Migración completa, en un solo archivo: tabla de reservas, copia de los datos, borrado de la columna y de su índice y clave foránea, política de visibilidad, retirada de la política de reserva por terceros, reescritura del trigger de permisos, función de estado de reserva y trigger de aviso de borrado | pendiente | |
| 2 | Verificación local: `supabase db reset` y matriz de acceso por rol contra la base local | pendiente | |
| 3 | Cliente: `lib/wish-reservation.ts` sobre la tabla nueva y lectura del estado por función | pendiente | |
| 4 | Cliente: los cuatro componentes sobre estado de reserva, y retirada del aviso de borrado | pendiente | |
| 5 | Tests unitarios de reserva y de estado de reserva | pendiente | |
| 6 | Seed y fixtures E2E sobre la tabla nueva | pendiente | |
| 7 | Documentación: `docs/DEVELOPMENT.md` y cierre de S1, S2 y D4 en `endurecimiento.md` | pendiente | |
| 8 | Ensayo en seco sobre producción y aplicación con aprobación explícita | pendiente | |

## Verificación prevista

- `supabase db reset` aplica las 20 migraciones sin error desde cero.
- Matriz de acceso en local, ejecutada como `authenticated` con `set local role`:
  el dueño no ve `reserver_id`; un tercero sin grupo no ve ni una fila; un
  miembro del grupo ve el deseo pero no la autoría; un miembro del grupo excluido
  no ve el deseo; la segunda reserva del mismo deseo falla.
- `pnpm run typecheck`, `pnpm run test:unit` y `pnpm run build` en verde.
- El error de violación de clave primaria se traduce al mensaje "este regalo ya
  no está disponible".

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
