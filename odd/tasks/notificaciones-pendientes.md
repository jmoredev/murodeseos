# Notificaciones: lo que hay, lo que falta y lo que no es de este código

**Abierta:** 2026-10-09 · **Rama:** — (registro; no hay trabajo de código en curso) · **Estado:** registrado por decisión del propietario («de momento solo apuntarlo»)

## Objetivo

Dejar **escrito y con evidencia** el estado de los avisos, porque de los tres síntomas que reportó el propietario **uno es una decisión de diseño, otro es un defecto real y el tercero no lo puede producir este repositorio**. Se registran los tres para que el día que se ataquen no haya que volver a investigarlo.

## 1. No hay push, y es una decisión escrita

**Lo que se ve**: al reservar o añadir un deseo, **no llega ningún aviso hasta que el propietario abre la app**; al entrar, el aviso aparece.

**Por qué**: la app **no tiene ningún mecanismo de push**. Medido:

| Comprobación | Resultado |
| --- | --- |
| `public/sw.js` | tres escuchadores: `install`, `activate`, `fetch`. **No hay `push` ni `notificationclick`** |
| `public/manifest.json` | `display: standalone` y **sin `gcm_sender_id`** |
| Código actual **y toda la historia y todas las ramas** | **cero** apariciones de `PushManager`, `applicationServerKey`, `showNotification`, `new Notification`, `Notification.requestPermission`, `setAppBadge` |
| El **artefacto desplegado** (no solo el repo) | el `sw.js` y el bundle servidos también dan **0** en todas esas APIs |

**Y está decidido**: `odd/tasks/consolidacion.md:49`, decisión **D6** — «Notificaciones: in-app hoy, push web para la PWA instalada después», con el motivo «Solo in-app no alcanza a quien tiene la aplicación cerrada». Lo repite `docs/DEVELOPMENT.md`: «Los avisos se generan al abrir las notificaciones, no en segundo plano: no hay cron, ni push, ni correo».

**Consecuencia**: no hay nada que configurar en el navegador. Conceder permisos de notificación no cambiaría nada, porque nada los pide ni nada envía. El síntoma **no es un fallo**: es una funcionalidad sin hacer, y hacerla pide **claves VAPID, guardar las suscripciones, un emisor desde servidor y el escuchador `push` en el worker** — una pieza de backend que hoy no existe (todo es Supabase + web estática).

## 2. La misma notificación se repite en cada apertura (defecto real)

**Lo que se ve**: aunque ya se haya recibido, **cada vez que se entra vuelve a anunciarse lo mismo**.

**Por qué**: la columna `is_read` **existe** (`supabase/migrations/20260116165718_create_notifications_table.sql:9`, `DEFAULT FALSE`) pero **sólo se escribe con una acción explícita del usuario**: tocar la fila o «Leer todas» (`components/NotificationMenu.tsx:138-148`). **Abrir la app no marca nada**, así que el contador se recalcula desde `!is_read` (`:45`) en cada montaje.

**Amplificador secundario**: en cada INSERT del canal *realtime* se relanza la lectura completa de las últimas 20 filas (`:86-89`, `lib/notification-utils.ts:107-126`), sin deduplicación de entrega. No existe ninguna noción de «ya entregada»; sólo de «leída por el usuario».

**Arreglo acotado cuando se decida**: marcar como leído al abrir (o introducir el concepto de «vista»), de modo que lo ya anunciado deje de repetirse. Es el más barato de los tres y el que más se nota.

## 3. Una notificación del sistema que este código no puede producir

**Lo que se ve**: el propietario describe **una notificación del sistema Android**, con el nombre y el icono de «Muro de deseos», que aparece **al entrar** en la app.

**Lo que dice el código**: **ninguna línea de este repositorio, en ninguna versión, puede crearla.** Lo verifiqué en el árbol, en toda la historia (`git log -S` acotado a `app/ components/ lib/ public/ scripts/` → 0 en las cinco APIs) y **en el artefacto desplegado**. Ante una observación que contradice al código, la conclusión correcta **no es «imposible»**: es que **falta un factor fuera del repositorio**.

**Dato que lo resolvería, y está en el móvil**: **mantener pulsada la notificación** cuando llegue — Android muestra **qué aplicación la envió** y permite desactivar sus avisos. Si el emisor no es una app propia de «Muro de deseos», ya sabremos de dónde sale. Alternativa: Ajustes → Notificaciones, para ver el canal y el origen.

## Lo que este registro NO dice

No hay ninguna unidad de trabajo abierta ni rama asociada: es un **registro de estado**, con la evidencia medida y las tres conclusiones separadas. Cuando el propietario decida atacarlas, el orden natural es 2 (defecto acotado y visible), 3 (identificar el origen en el dispositivo) y 1 (funcionalidad nueva con backend).

**Where**: `public/sw.js` · `public/manifest.json` · `components/NotificationMenu.tsx` · `lib/notification-utils.ts` · `odd/tasks/consolidacion.md` · `docs/DEVELOPMENT.md`.