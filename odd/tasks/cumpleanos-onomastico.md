# Cumpleaños y onomástico: perfil, recordatorios y notificaciones por grupo (feat/cumpleanos-onomastico)

**Abierta:** 2026-09-30 · **Rama:** `feat/cumpleanos-onomastico` (desde `main`) · **Estado:** abierta — Unidad A cerrada (commit `9567f2b`, revisión nativa aprobada y autoridad quemada); Unidades B y C pendientes

## Objetivo

- El perfil de cada usuario guarda su **fecha de cumpleaños** y su **día de santo / onomástico** (opcional).
- Al registrarse o entrar por primera vez se completa obligatoriamente el perfil, siendo **el nombre lo único obligatorio**; cumpleaños y onomástico son opcionales.
- En los ajustes de notificación de cada grupo se puede activar/desactivar el aviso del cumpleaños y del onomástico de los miembros, con **antelación configurable por grupo (defecto 15 días)**.
- Esos recordatorios entran en el gestor de notificaciones existente.

## Decisiones (confirmadas con el usuario)

1. **Generación sin infra programada:** no hay `pg_cron`/Edge Functions hoy. Un RPC
   `private.generate_birthday_reminders()` (SECURITY DEFINER, idempotente) escanea las
   fechas próximas y crea los avisos; el cliente lo invoca al cargar las notificaciones.
   El aviso aparece en la próxima visita (entrega in-app, sin push/email).
2. **Antelación configurable por grupo, defecto 15 días.** Nueva tabla
   `group_reminder_settings(user_id, group_id, lead_days int not null default 15)`.
3. **Onomástico manual:** campo de fecha opcional que el usuario rellena; no se deriva
   del nombre.
4. **Perfil:** `profiles.birth_date date` y `profiles.name_day date` (nullable). Para el
   onomástico el año es irrelevante (solo mes+día). El nombre obligatorio es
   `display_name` (el gate de login ya lo exige; se extiende a sesión persistente).
5. **Tipos nuevos:** `birthday` y `name_day` en `notifications.type`, en
   `group_notification_preferences.notification_type` y en los tipos del cliente.
6. **Destinatario:** cada miembro recibe el aviso del cumpleaños/onomástico de **otros**
   miembros del grupo (no el propio homenajeado). Dedupe: una notificación por
   (destinatario, homenajeado, grupo, tipo) y año natural.
7. **Fecha de referencia:** `now()` del servidor (UTC); el límite de un día por zona
   horaria se acepta como limitación conocida. Feb 29 se repite el 28 en años no bisiestos.

## Unidades de trabajo

### Unidad A — Migración DB + RPC generador

| # | Tarea | Estado |
| --- | --- | --- |
| A1 | Migración: `profiles.birth_date date` + `profiles.name_day date` (nullable) | hecha |
| A2 | Migración: ampliar CHECK de `notifications.type` y de `group_notification_preferences.notification_type` con `birthday`,`name_day` (leer nombres exactos de constraint en las migraciones actuales) | hecha |
| A3 | Migración: tabla `group_reminder_settings` (PK user_id+group_id, `lead_days int check 1..365 default 15`, FK a `profiles` y a `group_members(group_id,user_id)`, RLS owner) | hecha (`group_id text`, no uuid: `groups.id`/`group_members.group_id` son `text`) |
| A4 | Migración: `private.generate_birthday_reminders()` SECURITY DEFINER — por miembro, por cada otro miembro del grupo con fecha próxima (próxima ocurrencia mes+día dentro de `today..today+lead_days`, con vuelta de año y Feb 29→28), si el tipo está habilitado, inserta `birthday`/`name_day` sin duplicar por año | hecha (+ wrapper `public.generate_birthday_reminders()` SECURITY INVOKER: el esquema `private` no se expone a PostgREST) |
| A5 | Verificación A: `supabase db reset` aplica las migraciones y el RPC es invocable por `authenticated` | hecha (estática: writer + verificador independiente PASS; **pendiente** `db reset` en vivo — sin CLI Supabase/Docker en el entorno) |

### Unidad B — Perfil + capa de datos del cliente

| # | Tarea | Estado |
| --- | --- | --- |
| B1 | `app/profile/setup/index.tsx`: recoger `birth_date`/`name_day` (opcionales) junto al nombre obligatorio; upsert | pendiente |
| B2 | `components/ProfileTab.tsx`: editar `birth_date`/`name_day` | pendiente |
| B3 | `lib/group-notification-preferences.ts`: añadir `birthday`/`name_day` al union y a `GROUP_NOTIFICATION_OPTIONS` (labels/descripciones) | pendiente |
| B4 | `lib/notification-utils.ts`: añadir `birthday`/`name_day` al `NotificationType` y campos de `Notification` si hacen falta | pendiente |
| B5 | `lib/reminder-utils.ts` (nuevo): `ensureBirthdayReminders()` → `supabase.rpc('generate_birthday_reminders')` best-effort | pendiente |
| B6 | Tests unitarios de B3/B5 (preferencias por defecto, tipos) | pendiente |

### Unidad C — UI de notificaciones/ajustes + gate + docs

| # | Tarea | Estado |
| --- | --- | --- |
| C1 | `components/GroupNotificationSettingsModal.tsx`: campo `lead_days` por grupo (defecto 15) leyendo/escribiendo `group_reminder_settings`; los dos toggles nuevos se renderizan desde `GROUP_NOTIFICATION_OPTIONS` | pendiente |
| C2 | `components/NotificationItem.tsx`: casos `birthday` (🎂) y `name_day` (🕯️) con copy | pendiente |
| C3 | Gate a nivel de sesión: `app/index.tsx` redirige a `/profile/setup` si `display_name` vacío (además del gate de login) | pendiente |
| C4 | Cablear `ensureBirthdayReminders()` en el punto único de carga de notificaciones | pendiente |
| C5 | Tests unitarios (NotificationItem, modal de ajustes) | pendiente |
| C6 | E2E: recordatorio generado + toggle por grupo + antelación | pendiente |
| C7 | `docs/DEVELOPMENT.md` (cumpleaños/onomástico, generación al abrir, antelación por grupo) | pendiente |

## Verificación

- Unidad A: writer self-verification (pass) + independent verifier (**PASS**, 0 bloqueantes, 5 informativos: I1 LF/CRLF cosmético, I2 `updated_at` sin trigger, I3/I4 fuera de ámbito, I5 dedupe anti-join sin índice único — carrera solo con invocaciones concurrentes) + native RDD review (**aprobada**, linaje `review-8876fa94915e4e84`, tier medio, lente `review-reliability`, candidato `sha256:701421ec…`, sin corrección; autoridad quemada `gentle-ai.review-acknowledged/v1` el 2026-09-30).
- Unidades B/C: (pendiente) writer self-verification + independent verifier + native RDD review.

### Hallazgos informativos de la revisión de la Unidad A (trabajo posterior, no bloqueantes)

- **R3-001** (WARNING, `supabase/migrations/20260930160000_*.sql:268-275`): dedupe por anti-join sin índice único — dos invocaciones **concurrentes** del RPC podrían insertar el duplicado; secuenciales no.
- **R3-002** (SUGGESTION, `:74`): `group_reminder_settings.updated_at` sin trigger de actualización (consistente con `group_notification_preferences`).
- **R3-003** (SUGGESTION, `:268-275`): variante de la anterior sobre la forma de la consulta de dedupe.
- **R3-004** (SUGGESTION, `:70`): forma de la definición de la tabla de ajustes.

## Commits

- Unidad A: `9567f2b` `feat(db): add birthday/name-day profile fields and group reminder RPC` (1 fichero: `supabase/migrations/20260930160000_birthday_name_day_reminders.sql`, 302 líneas).
- (pendiente) un commit por unidad B/C en `feat/cumpleanos-onomastico`.
