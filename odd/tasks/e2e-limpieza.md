# La suite E2E que no se autolimpia y una aserción más débil que su intención

**Rama:** `test/e2e-limpieza`
**Abierta:** 2026-09-28
**Estado:** en curso

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
| 1 | E-10 — `create-group.spec.ts` limpia por `supabaseAdmin` y pierde el bloque de depuración | pendiente | — |
| 2 | E-10 — `join-group.spec.ts` limpia por `supabaseAdmin` | pendiente | — |
| 3 | E-11 — `profile.spec.ts` afirma que el botón está deshabilitado, no que se vea | pendiente | — |
| 4 | Verificación: los tres specs y el gate completo de chromium | pendiente | — |

## Restricciones

- La unidad no toca código de producto: solo pruebas. Si un arreglo exigiera
  cambiar el componente, se registraría como hallazgo y se pararía.
- El gate local es la red que importa: `CI=1 pnpm exec playwright test
  --project=chromium` precedido de `pnpm run test:e2e:prepare`.
- `supabaseAdmin` es una instancia compartida por worker: sirve para borrar datos,
  nunca para iniciar sesión.

## Verificación

Pendiente.

## Consecuencia

Al terminar, la suite no deja residuo propio y la prueba del perfil comprueba lo
que dice comprobar. Nada de esto se nota en el producto: es deuda de la red que
protege al producto.
