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
| V9 | Dos fallos del E2E siguen siendo ajenos a las reservas: `already-have-it.spec.ts:64` usa `getByText('Juan Perez').first()`, que resuelve a un nodo no visible, y `wishlist.spec.ts:109` compara dos posiciones de ordenación que resuelven iguales | cerrado | Corregidos en la feature [`e2e-ci`](./e2e-ci.md) (tareas 2 y 3), que además reparó cinco defectos más de la suite (E-5 a E-9). La suite completa en chromium pasa 38/38 con `CI=1` y el gate corre en CI como workflow reutilizable (`.github/workflows/e2e.yml`), invocado en cada pull request y antes de publicar en Pages. Lo único que queda fuera del repositorio es exigir el check en la protección de rama |
| V10 | El dueño puede reservar su propio deseo por la vía antigua (`reserved_by`): su política de edición es anterior a esta fase y `check_wishlist_update_permissions` no controla al dueño, así que el espejo crea la reserva. La vía nueva sí lo bloquea | abierto, heredado (no lo introduce la fase 1) | Hallado por la verificación independiente con la matriz de acceso: como dueño, `update wishlist_items set reserved_by = auth.uid()` pasa. No es fuga de privacidad (el dueño solo ve su propio id) ni explotable por terceros (la política exige ser el dueño), y el cliente antiguo no ofrece esa acción. Cerrarlo exige además controlar al dueño en el trigger de permisos |

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

## Revisión nativa (RDD) del candidato: sin cierre

Linaje `review-7095c32a765aa85f`, tier `high`, 30 rutas, 1554 líneas, presupuesto de
corrección 200 (en líneas de diff). Candidato congelado: rango comiteado
`7471383..2a00d8c`. Corrieron las cuatro lentes (`review-risk`, `review-resilience`,
`review-readability`, `review-reliability`) y el veredicto fue `correction_required`:

- **R4-001** (CRITICAL, determinista, introducido): la migración borra
  `wishlist_items.reserved_by` en la misma release que mueve las reservas, así que un cliente
  ya desplegado falla con `42703` y revertir el frontend no restaura la función.
- **R4-002** (CRITICAL, determinista, introducido): `loadWishlist` esperaba el estado de
  reserva antes de renderizar, y ese helper lanzaba en cualquier error del RPC, así que un
  fallo transitorio dejaba la lista del amigo **sin ningún deseo**.

**Decisión del usuario (revisada después, ver la subsección siguiente)**: corte inmediato con
recuperación en el cliente. Se descartó el puente de compatibilidad porque, para que un
cliente viejo renderice el estado de reserva, necesita *leer* la columna, y PostgreSQL no
oculta columnas por fila: el dueño seguiría viendo la autoría, es decir, el hallazgo S1
seguiría abierto durante la ventana. Esa lectura de la disyuntiva sigue siendo correcta.

**Corrección aplicada** (`ee0d824`, 151 líneas de diff, límite 200): clasificador de los
errores «cliente más viejo que el esquema» (`42703`, `42P01`, `42883`, `PGRST202`,
`PGRST204`) con mensaje accionable de recarga en la reserva, loader de estado que devuelve
`degraded` en vez de lanzar, estado `unknown` honesto sin acción de reservar y con aviso
visible en la lista del amigo, y nota del corte unidireccional en `docs/DEVELOPMENT.md`. El
service worker ya hacía `skipWaiting`/`clients.claim` y servía JS/CSS con red primero, así
que una recarga sí toma el bundle nuevo: por eso no se tocó.

**Verificación local de la corrección**: 123 tests unitarios en verde, `tsc` sin errores y la
suite completa de chromium en 38/38, exit 0.

**Resultado nativo**: el plan de corrección se aceptó (151 líneas declaradas, y las rutas
verificadas por el proveedor coinciden 1:1 con los seis archivos cambiados). La validación
dirigida posterior quedó **terminal**: estado `escalated`, `action: stop`,
`native_stop_required`, causa `targeted_validator_rejected` para R4-001 y R4-002. La primera
corrida del validador se abortó por una interrupción del usuario y la segunda falló de forma
nativa; en ambos casos sin mutación y sin veredicto, pero la autoridad registró el rechazo y
cerró la transición.

**Consecuencia**: la revisión **no cerró** y no hay autoridad aprobada, así que la entrega
queda bajo política ordinaria, que decide el mantenedor. Lo único bloqueante de verdad sigue
siendo la tarea 8: la migración no está aplicada en producción.

### Segunda revisión: la ventana de compatibilidad (fase 1 de 2)

Linaje `review-d60bead2af9c2fc5` (tier `high`, 30 rutas, 1739 líneas): el veredicto fue
`correction_required` con **R3-001** (fiabilidad, determinista) y **R4-001** (resiliencia,
inferencial), ambos CRITICAL y ambos sobre el mismo punto: borrar `reserved_by` rompe a un
cliente ya cargado, y `isWishSchemaMismatchError` vive **solo en el bundle nuevo**, así que no
puede darle al cliente viejo la recuperación que la documentación prometía; un rollback solo
del frontend tampoco restaura la columna.

Los dos son correctos e **invalidan la corrección anterior**: no se puede proteger a un cliente
obsoleto enviando código nuevo. Decisión del usuario: **ventana de compatibilidad** en dos
fases: se conserva `reserved_by` con un puente de disparadores que la sincroniza, y la fase 2
posterior borra la columna, que es lo que completa la privacidad. El diseño y la consecuencia
aceptada están en la cabecera de la migración y en `docs/DEVELOPMENT.md`.

### Fase 2: se cierra la ventana de compatibilidad

`supabase/migrations/20260928120000_drop_reserved_by_window.sql` retira lo que la fase 1
conservó, en este orden: la política de compatibilidad, los dos disparadores del puente, las
dos funciones `private.mirror_*`, el índice, la columna con su clave foránea, y la vuelta del
trigger de permisos a su forma estricta (sin la excepción del espejo ni la tolerancia a
`reserved_by`). Es idempotente, y el orden importa: la política y las funciones referencian la
columna, así que caen antes del `drop column` — el error que la fase 1 pagó como V2.

**Aquí se cierra el hallazgo S1**: con la columna fuera, la identidad de quien reserva ya no
está en `wishlist_items`. Consecuencia aceptada: un bundle anterior falla al reservar o
cancelar con `42703` hasta que recargue.

Verificación local: `db reset` con **21 migraciones** y dos reaplicaciones limpias; prueba
estructural con columna, índice, FK, disparadores, funciones del puente y política de
compatibilidad **todos ausentes**, y el trigger de permisos sin mencionar `reserved_by` ni
`muro.internal_mirror`. Matriz de acceso por rol: el miembro reserva y cancela por la tabla
nueva (INSERT 0 1 / DELETE 1); el dueño no puede reservar su propio deseo (42501); un
no-dueño que intenta editar otra columna no actualiza ninguna fila — al retirar la política de
compatibilidad ya no hay política de UPDATE que le alcance, así que la defensa queda en RLS
antes del trigger; un tercero sin grupo ve 0 filas; y la vía antigua falla con `42703`. Además:
123 tests unitarios, `tsc` sin errores y la suite completa de chromium **38/38** con la columna
ya eliminada.

**V10 queda cerrado por construcción**: nadie puede escribir `reserved_by` porque la columna no
existe.

**Pendiente**: aplicar la fase 2 a producción es una decisión aparte y depende de que la
ventana haya cumplido su función (el frontend nuevo se desplegó el 2026-09-28).

### Cierre: revisión aprobada y autoridad consumida

La validación dirigida del linaje `review-d60bead2af9c2fc5` cerró en **`approved`** y su
autoridad quedó consumida (`review.acknowledge-approved` → `authority: burned`,
`burn_evidence: gentle-ai.review-acknowledged/v1`, `mutation_outcome: committed`). El candidato
aprobado es el árbol `5e39babd` (commit `e10070a`).

Los **12 hallazgos informativos** que acompañan a la aprobación no bloquean, no abren
corrección y **no** son motivo para repetir la revisión sobre este candidato: son trabajo
posterior.

| ID | Lente | Ubicación | Severidad |
| --- | --- | --- | --- |
| R1-cutover-deploy-order | riesgo | `docs/DEVELOPMENT.md:80` | aviso |
| R1-reload-message-ambiguous | riesgo | `lib/wish-reservation.ts:28` | sugerencia |
| R2-1 | legibilidad | migración `:5` | aviso |
| R2-2 | legibilidad | `lib/wish-reservation.ts:35-39` | aviso |
| R2-3 | legibilidad | `odd/tasks/e2e-ci.md:25` | sugerencia |
| R3-002 | fiabilidad | migración `:226-234` | aviso |
| R3-003 | fiabilidad | `__tests__/WishListTab.test.tsx:181-183` | aviso |
| R3-004 | fiabilidad | `lib/wish-reservation.ts:68-71` | aviso |
| R3-005 | fiabilidad | `components/WishlistCard.tsx:52` | sugerencia |
| R3-006 | fiabilidad | `e2e/profile.spec.ts:45-49` | aviso |
| R4-002 | resiliencia | migración `:242-245` | aviso |
| R4-003 | resiliencia | `lib/wish-reservation.ts:35-39` | sugerencia |

La entrega —commit, push, PR, release— es política ordinaria del repositorio y **no** la
autoriza el resultado de la revisión.
