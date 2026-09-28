# La suite E2E que no se autolimpia y una aserción más débil que su intención

**Rama:** `test/e2e-limpieza`
**Abierta:** 2026-09-28
**Estado:** cerrada el 2026-09-28 — E-10 y E-11 cerrados y verificados con el gate completo; revisión nativa aprobada

## Objetivo

Cerrar E-10 y E-11, las dos entradas de la fase `e2e-ci` que quedaron abiertas.
Ninguna de las dos hace fallar la suite hoy; las dos son deuda que se paga sola
cada corrida.

## Contexto encontrado

- **E-10.** `create-group.spec.ts` y `join-group.spec.ts` limpian sus grupos de
  prueba llamando a `/api/groups/<id>`, una ruta que **no existe**: cada corrida
  registra `Status 404`, imprime la respuesta del servidor en un bloque de
  depuración y deja los grupos en la base. Medido en su día: 7 grupos frente a 4
  sembrados tras una corrida. Hoy no rompe nada porque `test:e2e:prepare` reseedea
  antes de cada corrida y el gate siempre lo ejecuta; un gate que lanzara
  Playwright sin `prepare` iría acumulando grupos y volvería intermitente el orden
  del mosaico.
- **E-11.** `profile.spec.ts` rellena un nombre inválido (`X`) y afirma que el
  botón de guardar **es visible**. El componente expone el contrato de verdad
  (`components/ProfileTab.tsx`: `disabled={saving || !isFormValid}`, con
  `isFormValid = displayName.trim().length >= 3`) y el propio comentario del test
  dice que el feedback es deshabilitar el CTA, así que la aserción es más débil
  que lo que el test pretende cubrir: pasaría igual con el botón activo.

## Decisiones

- **D1 — La limpieza de grupos pasa por `supabaseAdmin`**, como ya hace
  `wishlist.spec.ts`. Un borrado por la clave de servicio no depende de una ruta
  que no existe, y el bloque de depuración que imprimía la respuesta del 404
  desaparece: su motivo era diagnosticar ese fallo.
- **D2 — La aserción de E-11 se ancla al botón por rol y nombre accesible**, no al
  texto interno. El texto vive *dentro* del botón, así que `getByText(...)` no
  apunta al elemento que puede estar deshabilitado; `getByRole('button', { name })`
  sí. El nombre accesible lo declara el componente
  (`Guardar cambios del perfil`), así que la prueba no depende de la copia visible.
- **D3 — No se cambia la semántica de la suite.** Los specs siguen sin depender del
  reseed previo; solo dejan de ensuciar.

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | E-10 — `create-group.spec.ts` limpia por `supabaseAdmin` y pierde el bloque de depuración | **hecho** | `1a03a14`: la identidad del test se lee con `test.info()`, porque el patrón vacío de Playwright dispara `no-empty-pattern` |
| 2 | E-10 — `join-group.spec.ts` limpia por `supabaseAdmin` | **hecho** | `2367c28`: `BASE_URL` quedó sin uso y se retiró del import |
| 3 | E-11 — `profile.spec.ts` afirma que el botón está deshabilitado, no que se vea | **hecho** | `b90d589`: el botón se busca por rol y nombre accesible, y `toBeDisabled()` pasa contra el elemento real |
| 4 | Verificación: los tres specs y el gate completo de chromium | **hecho** | ver abajo |
| 5 | R3-002 — afirmar que el botón está habilitado antes del nombre inválido | **hecho** | `a49d430`: primero habilitado, después deshabilitado; la prueba pasa, lo que además confirma que el botón ya estaba habilitado antes |

## Restricciones

- La unidad no toca código de producto: solo pruebas. Si un arreglo exigiera
  cambiar el componente, se registraría como hallazgo y se pararía.
- El gate local es la red que importa: `CI=1 pnpm exec playwright test
  --project=chromium` precedido de `pnpm run test:e2e:prepare`.
- `supabaseAdmin` es una instancia compartida por worker: sirve para borrar datos,
  nunca para iniciar sesión.

## Verificación

- `pnpm run lint` limpio, avisos incluidos. El primer intento dejó un aviso
  `no-empty-pattern` —el patrón vacío que Playwright necesita en el gancho— que se
  resolvió leyendo la identidad del test con `test.info()`.
- `pnpm exec tsc --noEmit` sin errores.
- Los tres specs afectados, en solitario: **11/11**.
- Gate completo de chromium: **40/40, sin inestables**.
- **La limpieza se ve en el registro**: cinco grupos borrados vía Supabase y
  **cero** líneas de `Status 404` o `ERROR AL BORRAR` en la corrida completa, donde
  antes cada corrida los dejaba.
- La aserción de E-11 se comprobó contra el elemento real: `getByRole('button', {
  name })` con `toBeDisabled()` pasa, así que React Native Web expone el estado
  deshabilitado a Playwright.
- El tramo de R3-002 se verificó aparte: `e2e/profile.spec.ts` en solitario pasa
  **4/4** y el gate completo sigue en **40/40, sin inestables**. La aserción nueva
  de «habilitado antes» **pasa**, lo que confirma que el botón ya estaba
  habilitado: lo que cambia es que la prueba ya no puede pasar por otro motivo.

## Hallazgos informativos de la revisión

La revisión nativa (tier medio, lente de fiabilidad) **aprobó** el candidato sin abrir
corrección. Devolvió tres hallazgos informativos, que no bloquean y se trabajan aparte:

| ID | Lente | Ubicación | Gravedad | Nota (lectura propia) |
| --- | --- | --- | --- | --- |
| R3-001 | fiabilidad | `e2e/create-group.spec.ts:30-34` | aviso | El borrado registra el error pero no lo convierte en fallo del spec; con el residuo ya visible en el registro es defendible, y conviene decidirlo en una unidad propia. |
| R3-002 | fiabilidad | `e2e/profile.spec.ts:139-141` | sugerencia | La aserción no comprueba que el botón **estuviera habilitado antes**: si el nombre llegara vacío del servidor, pasaría por el motivo equivocado. **Hecho** en la tarea 5 de esta unidad. |
| R3-001 (2.ª revisión) | fiabilidad | `e2e/profile.spec.ts:139` | aviso | Sobre el tramo de la tarea 5. No bloquea. |
| R3-003 | fiabilidad | `odd/tasks/e2e-limpieza.md:48-51` | sugerencia | Sobre la redacción de las decisiones de este documento. |

## Consecuencia

Al terminar, la suite no deja residuo propio y la prueba del perfil comprueba lo
que dice comprobar. Nada de esto se nota en el producto: es deuda de la red que
protege al producto.
