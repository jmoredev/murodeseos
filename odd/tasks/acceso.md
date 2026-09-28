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
| 1 | Añadir «Cerrar sesión» en `ProfileTab`, disponible en todos los anchos | pendiente |
| 2 | Enlace de recuperación en el login, con mensaje neutro y `redirectTo` del sitio | pendiente |
| 3 | Pantalla `app/(auth)/reset-password/` que atienda el enlace y fije la contraseña | pendiente |
| 4 | Revisar en el panel de Supabase la Site URL y la lista de redirecciones | pendiente — requiere acceso al panel |
| 5 | Pruebas: unitarias de los formularios y, si es viable, un E2E del recorrido | pendiente |

## Fuera de alcance

- Cambiar de proveedor de correo o de plantillas de Supabase.
- Iniciar sesión con terceros (Google, Apple).
- Cambiar la contraseña desde dentro de la sesión ya iniciada.
