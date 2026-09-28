# Acceso: cierre de sesión y recuperación de contraseña

**Feature:** `acceso`
**Estado:** abierta — dos huecos verificados; el arreglo del redirect del alta vive en
`endurecimiento` (S8 y S9, ya resueltos)
**Inicio:** 2026-09-28
**Rama:** `feat/reservas-privacidad`

## Objetivo

Que una persona pueda entrar, salir y recuperar su cuenta sin ayuda técnica. Hoy no hay forma
de cerrar sesión desde el móvil ni de restablecer una contraseña olvidada.

## Hallazgos verificados

### A-1 — No hay cierre de sesión en móvil

`components/ResponsiveLayout.tsx` renderiza el botón «Salir» **solo** cuando `isDesktop` (el
bloque de la cabecera de escritorio; la barra inferior móvil va bajo `!isDesktop` y no lo
incluye). `components/ProfileTab.tsx` tampoco ofrece salir. En un PWA que se usa sobre todo
desde el móvil, eso deja a la persona sin manera de cambiar de cuenta —que es justo lo que hace
falta para probar otra cuenta.

**Arreglo propuesto**: botón «Cerrar sesión» en `ProfileTab`, disponible en todos los anchos,
manteniendo el «Salir» de la cabecera de escritorio. `ProfileTab` ya recibe `userId`, así que
el sitio natural de la llamada es el mismo `supabase.auth.signOut()` que ya usan las pantallas.

### A-2 — No existe flujo de recuperación de contraseña

`resetPasswordForEmail` **no aparece en ninguna parte del repositorio**; no hay enlace de
«¿olvidaste tu contraseña?» en `app/(auth)/login/index.tsx` ni pantalla para fijar una nueva, y
las únicas rutas de auth son `login` y `signup`. El correo con enlace a `localhost` que se
observó viene del lado de Supabase (panel), no de la aplicación: **no hay nada en el cliente que
lo solicite**, y sin pantalla de destino el enlace no puede completarse aunque llegue bien.

**Diseño propuesto**:

- Enlace en el login que pida el correo y llame a
  `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${getSiteBaseUrl()}/reset-password` })`,
  con mensaje neutro («si este correo tiene cuenta, te enviamos un enlace») para no revelar qué
  cuentas existen.
- Ruta nueva `app/(auth)/reset-password/` que atienda el enlace —Supabase deja el token en el
  fragmento de la URL, así que hay que confirmar que el cliente lo detecta
  (`detectSessionInUrl` y el tipo de flujo en `lib/supabase.ts`, que hoy no está configurado)—,
  muestre el formulario de nueva contraseña, llame a `supabase.auth.updateUser({ password })` y
  deje la sesión lista para entrar.
- El enlace por correo depende de la configuración de Supabase, no del código: la **Site URL**
  debe ser `https://jmoredev.github.io/murodeseos` y la lista de redirecciones debe incluir
  `https://jmoredev.github.io/murodeseos/**` y `http://localhost:8081/**`. Eso es un ajuste del
  panel que no se puede leer ni verificar desde el repositorio.

## Tareas

| # | Tarea | Estado |
| --- | --- | --- |
| 1 | Añadir «Cerrar sesión» en `ProfileTab`, disponible en todos los anchos | **hecho** | botón `sign-out-button` al final del perfil, con `supabase.auth.signOut()`; el E2E de perfil comprueba que se renderiza |
| 2 | Enlace de recuperación en el login, con mensaje neutro y `redirectTo` del sitio | **hecho** | `forgot-password-link` despliega el panel; al enviar llama a `resetPasswordForEmail` con `${getSiteBaseUrl()}/reset-password` y muestra un mensaje que no revela si la cuenta existe |
| 3 | Pantalla `app/(auth)/reset-password/` que atienda el enlace y fije la contraseña | **hecho** | espera la sesión del enlace, pide la contraseña nueva, llama a `updateUser` y entra; si el enlace no vale, lo dice y explica que hay que abrirlo en el mismo dispositivo |
| 4 | Revisar en el panel de Supabase la Site URL y la lista de redirecciones | **pendiente** — requiere acceso al panel | la Site URL de producción debe ser `https://jmoredev.github.io/murodeseos` y la lista debe incluir esa URL y `http://localhost:8081/**` |
| 5 | Pruebas: unitarias de los formularios y, si es viable, un E2E del recorrido | **hecho** | 7 unitarias nuevas (login y pantalla de reset) y `e2e/reset-password.spec.ts`, que **lee el correo real** de Mailpit y verifica que el enlace trae `redirect_to=…/reset-password` |

## Decisiones y hallazgos de la implementación

- **El enlace hay que abrirlo en el mismo navegador.** El cliente es `createBrowserClient` de `@supabase/ssr`, así que el flujo es **PKCE**: el correo trae `?code=…` (confirmado en local: el token empieza por `pkce_`) y el verificador vive en el navegador que pidió el enlace. Por eso la pantalla avisa de ello y, si el canje falla, dice que se pida uno nuevo desde ese dispositivo en vez de dejar al usuario con un error opaco.
- **`supabase/config.toml` también arrastraba el puerto 3000 de Next.js**: `site_url` era `http://127.0.0.1:3000` y la lista de redirecciones `https://127.0.0.1:3000` (https y puerto equivocados). Corregido a `http://127.0.0.1:8081` y a `localhost`/`127.0.0.1` en 8081: es la misma clase de defecto que S8 y es lo que hace que el enlace local caiga en la aplicación.
- **El capturador de correo local es Mailpit**, aunque el contenedor se llame `inbucket`. Su API es `GET /api/v1/messages` y `GET /api/v1/message/{ID}`; el spec lee de ahí el cuerpo del correo.
- **El mensaje neutro se reserva para la respuesta correcta**, y los errores devueltos sí se cuentan: Supabase responde correctamente aunque la cuenta no exista, así que mostrar un error no revela nada sobre la existencia de la cuenta, mientras que callarlo dejaría al usuario esperando un correo que nunca salió.
- La pantalla de reset cierra un defecto que encontró su propia prueba: con la sesión ya presente seguía mostrando «Comprobando el enlace…» hasta que expiraba el temporizador de 3 s.

## Hallazgos de la revisión nativa (informativos)

Linaje `review-cc3d5630511adef5`: **aprobada** con catorce hallazgos **no bloqueantes**. Ninguno
abre corrección y ninguno es motivo para repetir la revisión: se listan aquí como trabajo
posterior, con lo que cada uno señala.

### Merecen arreglo en el código (los cuatro primeros, corregidos)

Los cuatro primeros hallazgos de esta tabla están **corregidos** después de la revisión: las dos
llamadas (`resetPasswordForEmail` y `updateUser`) van ahora dentro de `try/catch/finally`, así que
un fallo **lanzado** libera el botón en vez de dejarlo bloqueado, y hay pruebas para el error
devuelto al guardar, el fallo lanzado al guardar y los dos al pedir el enlace (incluido el límite
de envíos). Queda pendiente **R3-e2e-link-not-followed** (A-2d).

| Hallazgo | Ubicación | Qué señala |
| --- | --- | --- |
| R4-1 | `app/(auth)/login/index.tsx:47-52` | La petición del enlace no está envuelta en `try/catch`: si `resetPasswordForEmail` **lanza** en vez de devolver error, `sendingRecovery` se queda en `true` y el botón no vuelve |
| R4-2 | `app/(auth)/reset-password/index.tsx:64-69` | Lo mismo con `updateUser`: un fallo lanzado deja `saving` activo y el formulario bloqueado |
| R3-recovery-rate-limit-untested | `app/(auth)/login/index.tsx:47-50` | La rama del límite de envíos (429) no tiene prueba |
| R3-reset-update-error-untested | `app/(auth)/reset-password/index.tsx:71-74` | La rama de error al guardar la contraseña no tiene prueba |
| R3-e2e-link-not-followed | `e2e/reset-password.spec.ts:34-45` | El E2E comprueba que el enlace **sale bien** en el correo, pero no lo sigue: abrirlo y cambiar la contraseña queda sin cubrir |

### Dependen del panel o son deuda ya registrada

| Hallazgo | Ubicación | Qué señala |
| --- | --- | --- |
| R1-panel-allowlist, R3-redirect-allowlist, R2-006 | `app/(auth)/login/index.tsx:39-41`, `supabase/config.toml:152` | La lista de redirecciones del repositorio cubre el desarrollo local; la de producción vive en el panel (tarea 4) |
| R1-fallback-repo-hardcode, R2-005 | `lib/site-url.ts:26-27` | El nombre del repositorio escrito a mano: ya registrado como **S14** |
| R2-004 | `lib/site-url.ts:3` | Redacción del comentario de cabecera |
| R2-003 | `env.example:14` | El valor de ejemplo podría confundirse con el de producción |
| R2-001, R2-002 | `odd/tasks/consolidacion.md:4`, `odd/tasks/endurecimiento.md:4` | El `Estado` de ambas fichas ya no describe del todo su contenido |

### Segunda revisión de esta feature (`review-8211d875c843855d`)

La corrección de A-2c salió **aprobada** con dos hallazgos informativos más, que se atienden
junto con A-2d en la siguiente unidad de trabajo:

| Hallazgo | Ubicación | Qué señala |
| --- | --- | --- |
| R3-reset-catch-scope | `app/(auth)/reset-password/index.tsx:76-80` | El `catch` envuelve también `router.replace('/')`, así que un fallo al navegar diría «no pudimos guardar la contraseña» aunque la contraseña **sí** se hubiera guardado. El `try` debe cubrir solo la llamada |
| R3-login-generic-error-coverage | `app/(auth)/login/index.tsx:47-54` | Falta prueba de la rama de error **devuelto** que no es el límite de envíos (hay prueba del 429 y del fallo lanzado, no de un error cualquiera) |

## Fuera de alcance

- Cambiar de proveedor de correo o de plantillas de Supabase.
- Iniciar sesión con terceros (Google, Apple).
- Cambiar la contraseña desde dentro de la sesión ya iniciada.
