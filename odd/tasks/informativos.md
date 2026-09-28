# Cierre del repaso de los hallazgos informativos

**Rama:** `chore/informativos-cerrados`
**Abierta:** 2026-09-28
**Estado:** en curso

## Objetivo

Juzgar, uno por uno, los hallazgos informativos que dejaron las siete revisiones nativas
de esta sesión, actuar sobre los dos que merecen trabajo y **dejar el veredicto escrito**
para que nadie tenga que releer el código otra vez.

## Contexto encontrado

El repaso se hizo en lectura, archivo por archivo, y el resultado es que **ninguno es un
defecto grave**: nueve ya estaban corregidos y el resto es criterio ya tomado y no escrito.

| Hallazgo | Dónde | Veredicto |
| --- | --- | --- |
| Guardia del cliente administrativo | `e2e/supabase-admin.ts` | **Real, y ya ocurrió**: una sesión dejada en la instancia compartida rompió dos specs. Hoy lo impide la disciplina y un comentario, no el código |
| Limpieza silenciosa de grupos | `e2e/create-group.spec.ts` | Real pero leve: un borrado que falla se registra y el spec sigue verde. Hacerlo fallar puede volver la suite frágil a un fallo de red |
| Orden operativo de la migración | `docs/DEVELOPMENT.md` | Hueco de documentación: explica la consecuencia del bundle viejo, pero no en qué orden se publica y se migra |
| Mensaje y heurística de esquema | `lib/wish-reservation.ts` | Cosmético: el respaldo que busca el código dentro del mensaje es heurístico y está documentado. Tocarlo arriesga el camino que hoy funciona para el bundle viejo |
| Estado de reserva por defecto | `components/WishlistCard.tsx` | Defendible: si el mapa de estados no llega, la interfaz ofrece reservar y **la base lo rechaza** con «Este regalo ya no está disponible». La protección no está en el cliente, y está bien |
| Escucha de consola en el E2E | `e2e/profile.spec.ts` | Defendible: registra errores que son ruido benigno (Expo avisa de nodos de texto como error). Si la prueba fallara por ellos, la suite se rompería sola |
| Aserción negativa | `__tests__/WishListTab.test.tsx` | Calidad de prueba menor: comprueba que *no* se llama a una tabla |
| Comentarios de migraciones ya aplicadas | `20260925…`, `20260928…` | Sin acción: la migración está aplicada; retocar sus comentarios no aporta |
| Documentación de la tarea de E2E | `odd/tasks/e2e-ci.md` | Sin acción: redacción de un documento histórico |

## Decisiones

- **D1 — La guardia es de tipo, no de disciplina.** `supabaseAdmin` pasa a exportarse con
  una vista que ofrece `auth.admin` (crear, listar y borrar usuarios, que los specs
  necesitan) y **no** ofrece el inicio de sesión. No se toca ni un punto de llamada: los
  cinco usos de administración siguen compilando y `signInWithPassword` deja de existir en
  el tipo. Una línea con `@ts-expect-error` comprueba la guardia: si alguien ensancha el
  tipo, `tsc` falla ahí y avisa.
- **D2 — La limpieza no falla la prueba, pero se ve.** Un fallo de borrado pasa a anotarse
  con `test.info().annotations`, que aparece en el informe de Playwright, además del
  registro. Fallar el spec por un fallo de red volvería frágil la suite, y llamarlo
  «silencioso» era justo el hallazgo: la diferencia es que ahora queda constancia en el
  resultado, no solo en el log.
- **D3 — El orden operativo se escribe una vez.** El código que tolera las dos formas del
  esquema se publica **antes** que la migración que lo cambia, y la retirada va después;
  migrar primero deja a los bundles en vuelo sin nada que los entienda.

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Guardia de tipo en `supabaseAdmin` con su comprobación `@ts-expect-error` | **hecho** | `tsc` pasa con los cinco usos de `auth.admin`; sin la línea de comprobación falla con `Property 'signInWithPassword' does not exist on type '{ admin: GoTrueAdminApi; }'` |
| 2 | Limpieza de E2E con anotación en el informe | **hecho** | Comprobado con un borrado roto a propósito: la anotación `limpieza-fallida` aparece en el informe JSON con el mensaje exacto y la corrida sigue en verde |
| 3 | Nota de orden operativo en `docs/DEVELOPMENT.md` | **hecho** | El código que tolera las dos formas se publica antes que la migración, y la retirada va después |
| 4 | Acta del veredicto (este documento) y cierre de las listas de origen | **hecho** | Los cinco documentos con informativos apuntan aquí desde su tabla |
| 5 | Verificación: tipos, lint, unitarios y el gate completo | **hecho** | ver abajo |

## Restricciones

- La unidad no cambia comportamiento de producto: el cambio de tipo no altera el cliente
  en tiempo de ejecución y las anotaciones solo añaden información al informe.
- El gate de tipos es la verificación principal de la tarea 1: si algún spec usara el
  inicio de sesión compartido, `tsc` lo diría.
- Cada lista de origen (`endurecimiento.md`, `consolidacion.md`, `reservas.md`, `e2e-ci.md`,
  `avisos-lint.md`, `e2e-limpieza.md`) recibe el puntero a este acta en su fila, para que
  quien la lea sepa que ya fue juzgada.

## Verificación

- `pnpm exec tsc --noEmit` sin errores: los cinco usos de `auth.admin` siguen compilando
  con la vista estrecha.
- **La guardia se vio fallar**: quitando la línea `@ts-expect-error`, `tsc` responde
  `Property 'signInWithPassword' does not exist on type '{ admin: GoTrueAdminApi; }'`.
  Con la línea puesta, pasa. Eso es lo que hace que la guardia sea real y no decorativa.
- **La anotación se vio aparecer**: apuntando el borrado a una tabla inexistente, el
  informe JSON trae dos anotaciones `limpieza-fallida` con el mensaje exacto del error, y
  **la corrida sigue en verde**: el compromiso de D2 es no fallar por un fallo de red.
- `pnpm run lint` limpio, avisos incluidos.
- **148** pruebas unitarias en verde.
- Gate completo de chromium: **40/40, sin inestables**, con cinco limpiezas registradas.

## Consecuencia

Al terminar, la lista de informativos deja de ser una promesa y pasa a ser un registro:
cada entrada tiene veredicto, y las tres que exigían trabajo tienen su prueba o su
documentación.
