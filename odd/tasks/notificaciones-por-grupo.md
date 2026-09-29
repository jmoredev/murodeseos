# Notificaciones configurables por grupo

**Feature:** `notificaciones-por-grupo`
**Rama por abrir:** `feat/notificaciones-por-grupo`
**Abierta:** 2026-09-29
**Estado:** en curso

## Objetivo

Que cada miembro pueda decidir, grupo a grupo, qué avisos quiere recibir:
reserva de un deseo, alta de un deseo nuevo, borrado de un deseo y sorteo de
Amigo Invisible.

## Decisiones de producto (confirmadas por el usuario)

- **D1 — Cada miembro configura lo suyo.** La preferencia es por (usuario, grupo,
  tipo). Todos los miembros acceden a la configuración del grupo; cada uno solo se
  afecta a sí mismo.
- **D2 — El sorteo entra como cuarta opción** (`draw_performed`), junto a
  `wish_reserved`, `wish_added` y `wish_deleted_by_owner`.
- **D3 — Solo afecta a los avisos futuros.** La preferencia decide si la fila de
  `notifications` llega a insertarse; no se toca ni se oculta lo ya recibido.

## Contexto encontrado

- Hoy hay cuatro tipos de aviso: `wish_added` y `draw_performed` los inserta el
  cliente (`lib/notification-utils.ts`), y `wish_reserved` y
  `wish_deleted_by_owner` los insertan triggers de la base.
- No existe ninguna tabla de preferencias. La configuración del grupo vive en
  `app/groups/[id]/index.tsx`, que ya calcula `isAdmin` y tiene el patrón de
  modales del proyecto (`ConfirmModal`, `UserProfileModal`).
- **La RLS lo decide todo:** quien reserva no puede leer las preferencias de los
  demás (`group_notification_preferences` será privada por usuario), así que el
  filtrado no puede vivir en el cliente. La preferencia se aplica en un único
  punto dentro de la base.
- `wish_deleted_by_owner` corre en un trigger `BEFORE DELETE` sobre
  `wishlist_items` y `wish_reserved` en un `AFTER INSERT` sobre
  `wishlist_reservations`, ambos `SECURITY DEFINER`.

## Decisiones técnicas

- **D4 — Un único punto de control.** Un trigger `BEFORE INSERT` sobre
  `public.notifications` descarta la fila cuando el destinatario tiene ese tipo
  desactivado para el grupo de la propia fila (`group_id`). Vale para los cuatro
  tipos y para cualquier vía de inserción, sin tocar la lógica que los crea. Si
  `group_id` es nulo, no hay preferencia por grupo y la fila pasa.
- **D5 — El grupo mostrado es el grupo de la preferencia.** El aviso ya incluye el
  nombre del grupo; la preferencia aplica a ese grupo. Donde el aviso puede caer en
  varios grupos comunes, la lógica de creación ya elige uno determinista; la
  preferencia de *ese* grupo es la que manda.
- **D6 — Tabla aditiva y privada.** `group_notification_preferences`
  (`user_id`, `group_id`, `notification_type`, `enabled`), con clave foránea
  compuesta a `group_members` para que al salir del grupo se limpien solas las
  preferencias. Sin fila = activado (el valor por defecto no necesita fila).
- **D7 — Los avisos no se generan por siembra o administración.** Se añade una
  guarda `auth.uid() is not null` a los triggers `wish_reserved` y
  `wish_deleted_by_owner`, para que el seed (service role) no cree avisos que
  nadie provocó. Es una consecuencia de D4: el envío es cosa de acciones de
  usuario reales.

## Tareas

| # | Tarea | Estado |
| --- | --- | --- |
| 1 | Migración: tabla, RLS, helper y trigger `BEFORE INSERT` | **hecho** | `supabase/migrations/20260929130000_group_notification_preferences.sql` |
| 2 | Verificación local contra la base (matriz de preferencias) | **hecho** | matriz en verde (ver abajo) |
| 3 | Capa cliente de preferencias (`lib/`) | **hecho** | `lib/group-notification-preferences.ts` |
| 4 | Modal de configuración y acceso desde la página de grupo | **hecho** | `components/GroupNotificationSettingsModal.tsx` y `app/groups/[id]/index.tsx` |
| 5 | Unitarios de la capa cliente | **hecho** | `__tests__/group-notification-preferences.test.ts`; 8 en verde |
| 6 | E2E de la configuración y del filtrado | **hecho** | `e2e/group-notification-preferences.spec.ts`; chromium 42/42 |
| 7 | typecheck, lint y unitarios | **hecho** | `tsc --noEmit` 0; `eslint --max-warnings 0` 0; 159 unitarios en verde, 1 todo |
| 8 | Atribución al grupo con el aviso activo (hallazgos R3-003/004/006) | **hecho** | `supabase/migrations/20260929140000_notify_reserved_enabled_group.sql`; matriz de 5 casos en verde |

## Restricciones

- La migración es aditiva: no cambia datos existentes ni oculta avisos pasados.
- No se toca la RLS de `notifications` ni la forma en que cada aviso se crea.
- Las preferencias son privadas: un miembro no ve las de otro.

## Verificación

### Matriz de preferencias contra la base local

Aplicada con `supabase migration up --local` y comprobada en una transacción
revertida. Fixture: FAM001 con María (dueña), Juan, Ana y Carlos; Ana desactiva
reserva, alta y sorteo; Juan desactiva el borrado; Carlos queda por defecto.

| Caso | Esperado | Observado |
| --- | --- | --- |
| Reserva — Ana desactivada | 0 | 0 |
| Reserva — Carlos por defecto | 1 | 1 |
| Alta — Ana desactivada | 0 | 0 |
| Alta — Carlos por defecto | 1 | 1 |
| Sorteo — Ana desactivado | 0 | 0 |
| Sorteo — Carlos por defecto | 1 | 1 |
| Borrado — Juan desactivado | 0 | 0 |
| Borrado — Carlos por defecto | 1 | 1 |
| Grupo nulo con tipo desactivado | pasa | 1 |
| Siembra (service role, sin usuario) | 0 | 0 |
| RLS: Ana no ve las preferencias de Juan | 0 | 0 |

Las inserciones de reserva, alta y sorteo se hicieron como rol `authenticated`
con el JWT del actor correspondiente, así que pasaron por la RLS real.

### Unitarios

`__tests__/group-notification-preferences.test.ts`: 8 pruebas en verde (valores por
defecto, fila desactivada, tipo desconocido, error de carga, payload exacto del
`upsert` con `updated_at` y `onConflict`, error de guardado).

### E2E

`e2e/group-notification-preferences.spec.ts`: abre la configuración del grupo desde
la interfaz, desactiva «Se reserva un deseo», comprueba que la preferencia se
guarda, que la base deja de insertar el aviso, que persiste tras cerrar y reabrir,
y que al reactivarlo vuelve a llegar. `npx playwright test --project=chromium`:
**42/42**, sin regresiones.

### Estáticas

- `pnpm exec tsc --noEmit` — 0 errores.
- `pnpm run lint` (`eslint --max-warnings 0`) — 0 avisos.

### Atribución al grupo activo (seguimiento de los informativos)

La primera versión elegía el grupo **menor** y dejaba el descarte al `BEFORE INSERT`.
Si el destinatario había desactivado el aviso en ese grupo pero lo tenía activo en
otro grupo común, perdía el aviso. La migración `20260929140000` reescribe
`notify_wish_reserved` y `notify_wish_deleted` para elegir el menor grupo con el
aviso **activado**.

| Caso | Esperado | Observado |
| --- | --- | --- |
| Reserva, desactivado en el grupo menor y activo en otro | 1 en el grupo activo | 1 (`WORK01`) |
| Reserva, desactivado en todos los grupos comunes | 0 | 0 |
| Borrado, desactivado en el grupo menor y activo en otro | 1 en el grupo activo | 1 (`WORK01`) |
| Borrado, desactivado en todos los grupos comunes | 0 | 0 |
| Borrado tras abandonar el grupo común | 1 con grupo nulo | 1 con grupo nulo |

Validado además con `supabase db reset` (todas las migraciones desde cero) y la
suite completa de chromium en verde (42/42).

## Consecuencia

Cada miembro puede decidir, grupo a grupo, qué avisos recibe, y la decisión se
aplica en la base en un único punto. El aviso se atribuye al menor grupo donde el
destinatario lo tiene activado, así que no se pierde por culpa del grupo elegido.

Limitación conocida y aceptada: `wish_added` se sigue creando en el cliente, que no
puede leer las preferencias de otros, así que su atribución de grupo no consulta la
preferencia. Corregirlo exige moverlo a un trigger de la base; queda como trabajo
aparte.
