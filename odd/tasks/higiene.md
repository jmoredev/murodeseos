# Higiene del repositorio: la trampa de `database/` y la ruta base escrita a mano

**Rama:** `chore/higiene-repo`
**Abierta:** 2026-09-28
**Estado:** en curso

## Objetivo

Cerrar S13 y S14, las dos entradas de la fase de endurecimiento que se pueden
resolver enteramente desde el repositorio, y poner al día los estados
documentales que quedaron desfasados al cerrar S8.

## Contexto encontrado

- **S13.** `database/` guarda seis scripts SQL anteriores a las migraciones más un
  `README.md`. El más peligroso, `database/supabase_wishlist_schema.sql`, empieza
  con `DROP TABLE IF EXISTS wishlist_items CASCADE;` y vuelve a crear las
  políticas permisivas (`USING (true)`, `WITH CHECK (true)`) y el `SELECT` público
  del bucket: seguir sus instrucciones **destruiría datos reales** y revertiría todo
  el endurecimiento. El `README.md` describe además tablas `wishes` y
  `reservations` que no existen y manda ejecutar `database/supabase_seed.sql`, que
  tampoco existe. Nada del repositorio lo usa: la búsqueda no encuentra referencias
  fuera de la propia carpeta y de los documentos de tareas.
- **S14.** `lib/site-url.ts` resuelve la URL base del sitio en tres pasos y, como
  último recurso de la ruta de GitHub Pages, escribe el nombre del repositorio a
  mano (`const fallbackRepo = 'murodeseos'`). `app.json` ya declara esa ruta en
  `expo.experiments.baseUrl`, así que el dato está duplicado en dos sitios y
  puede separarse.
- **V10.** El dueño podía reservar su propio deseo por la vía antigua
  (`reserved_by`) porque `check_wishlist_update_permissions` no controla al dueño.
  La fase 2 de la migración de reservas retiró la columna, así que la vía ya no
  tiene por dónde entrar: queda cerrarlo con la evidencia y verificarlo en el
  repositorio.

## Decisiones

- **D1 — La carpeta `database/` desaparece; `supabase/migrations/` es la única
  fuente de verdad del esquema.** No se conserva como referencia ni se marca como
  obsoleta: un archivo que destruiría datos no debe seguir en el repositorio por
  mucho que un cartel avise. La historia de git lo conserva si alguna vez hace
  falta mirarlo.
- **D2 — La ruta base se lee de `app.json`, no de `expo-constants`.** El JSON se
  importa directamente (`resolveJsonModule` está activo y Metro lo empaqueta), así
  que la unidad se prueba como cualquier otro módulo y no arrastra un módulo
  nativo al entorno de pruebas.
- **D3 — V10 se cierra por construcción, no reabriendo la base.** La evidencia es
  la fase 2 aplicada y verificada (columna, índice, clave ajena, disparadores,
  funciones `private.mirror_*` y política de compatibilidad a cero, con las nueve
  reservas intactas) más la comprobación de que nada en el repositorio escribe esa
  columna. No se consulta producción otra vez.

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | S13 — retirar `database/` (siete archivos) y dejar `supabase/migrations/` como única fuente de verdad | pendiente | — |
| 2 | S14 — leer la ruta base desde `app.json` en `lib/site-url.ts`, con la prueba que impide que vuelvan a separarse | pendiente | — |
| 3 | Cerrar V10 con la evidencia de la fase 2 y verificar que nada escribe `reserved_by` | pendiente | — |
| 4 | Poner al día `endurecimiento.md` y `consolidacion.md`: S8 resuelto, S13 y S14 cerrados | pendiente | — |

## Restricciones

- Ninguna migración ya aplicada se toca: cada fase nueva es un archivo nuevo, y
  aquí no hay fase nueva porque no se cambia el esquema.
- No se consulta la base de producción: todo lo que se afirma se verifica en el
  repositorio.
- El gate local es `CI=1 pnpm exec playwright test --project=chromium`, precedido
  de `pnpm run test:e2e:prepare`, porque el cambio de la ruta base entra en el
  recorrido de alta y de compartición.

## Verificación

Pendiente.

## Consecuencia

Al terminar, el repositorio no contendrá ningún camino que revierta el
endurecimiento, y la ruta del sitio tendrá una sola declaración.
