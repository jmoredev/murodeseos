# El mínimo de la contraseña: tres sitios con dos valores

**Rama:** `fix/minimo-contrasena`
**Abierta:** 2026-09-28
**Estado:** cerrada el 2026-09-28 — el mínimo está declarado una vez, el stack local lo aplica y S11 queda cerrado como limitación del plan; revisión nativa aprobada

## Objetivo

Cerrar S11 con lo que se puede hacer en el plan gratuito, y dejar coherentes los tres
sitios donde vive el mínimo de la contraseña.

## Contexto encontrado

- **S11 no tiene arreglo tal como estaba planteado.** La comprobación de contraseñas
  filtradas contra HaveIBeenPwned es una opción del panel de Supabase que **el plan
  gratuito no ofrece**. Lo que sí se puede hacer es subir la longitud mínima: con la
  comprobación fuera, la longitud es la protección que queda. El mínimo del panel se subió
  a **8 caracteres**.
- **El cliente se quedó en 6.** `app/(auth)/signup/index.tsx` y
  `app/(auth)/reset-password/index.tsx` validaban `password.length < 6` con el mismo
  mensaje copiado. Con el panel en 8, quien escribiera 6 o 7 caracteres pasaba la
  validación y recibía un **error del servidor** en vez de un mensaje claro.
- **El stack local también estaba en 6.** `supabase/config.toml` fija
  `minimum_password_length = 6`, así que las pruebas de extremo a extremo habrían aceptado
  lo que producción rechaza: la suite habría dejado de representar al sistema real.
- Las contraseñas de los specs y del sembrado ya cumplen el nuevo mínimo (`E2ETest123!`,
  `Test123!`, `Original123!`, `NuevaClave456!`), así que no hay nada que ajustar ahí.

## Decisiones

- **D1 — Una sola declaración para el cliente.** El mínimo y su mensaje viven en
  `lib/password.ts`, que usan las dos pantallas. Estaban duplicados, y un número duplicado
  es un número que se queda atrás: exactamente lo que acaba de pasar.
- **D2 — El config local se alinea a 8, con el motivo escrito al lado.** El valor de
  producción vive en el panel y no se puede leer desde el repositorio, así que la nota va
  donde alguien lo cambiaría: los tres sitios tienen que moverse juntos.
- **D3 — S11 se cierra como limitación del plan, no como pendiente.** Queda escrito qué
  falta, por qué no se puede poner y qué lo compensa; si algún día el plan lo ofrece, la
  entrada dirá exactamente qué activar.
- **D4 — Sin reglas adicionales de composición.** `password_requirements` sigue vacío: el
  mínimo es la medida acordada, y añadir exigencias sin pedirlo cambiaría la experiencia de
  alta sin que nadie lo haya decidido.

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | `lib/password.ts` con el mínimo y el mensaje, más su prueba | **hecho** | Cuatro pruebas nuevas: acepta justo el mínimo, rechaza un carácter menos, nombra el mínimo en el mensaje y rechaza la vacía |
| 2 | Las dos pantallas usan la declaración única | **hecho** | El alta y el restablecimiento llaman a `validateNewPassword`; se respeta el orden de sus mensajes |
| 3 | `supabase/config.toml` alineado a 8, con el motivo escrito | **hecho** | Comprobado contra el servidor: con el stack reiniciado, una contraseña de 7 responde `{"error_code":"weak_password","msg":"Password should be at least 8 characters."}` |
| 4 | Acta de S11: limitación del plan y qué la compensa | **hecho** | `endurecimiento.md` y `consolidacion.md` |
| 5 | Verificación: tipos, lint, unitarios y el gate completo | **hecho** | ver abajo |

## Restricciones

- No se cambia ninguna contraseña existente ni se toca la base: el mínimo solo afecta a
  contraseñas nuevas.
- El orden de los mensajes de error de cada pantalla se respeta: el alta comprueba primero
  que coincidan y luego la longitud; el restablecimiento, al revés.
- El valor del panel es la fuente de verdad en producción; aquí solo se documenta y se
  copia al cliente y al stack local.

## Verificación

- `pnpm run lint` limpio, avisos incluidos.
- `pnpm exec tsc --noEmit` sin errores.
- **152** pruebas unitarias en verde: cuatro nuevas del mínimo.
- **El servidor exige de verdad 8**, y no se deduce del archivo: reiniciando el stack local
  —`supabase start` no recarga la configuración de un stack ya levantado—, el alta con 7
  caracteres responde `weak_password` con «Password should be at least 8 characters».
- Gate completo de chromium contra ese stack: **40/40, sin inestables**, y el sembrado no se
  queja porque sus contraseñas ya cumplían el mínimo.

## Consecuencia

Al terminar, el mínimo está declarado una vez para el cliente, el stack local representa al
sistema real y S11 deja de ser una tarea abierta para convertirse en una limitación del plan
documentada, con la compensación que sí está en vigor.
