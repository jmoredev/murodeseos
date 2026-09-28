# Higiene del repositorio: la trampa de `database/` y la ruta base escrita a mano

**Rama:** `chore/higiene-repo`
**Abierta:** 2026-09-28
**Estado:** cerrada el 2026-09-28 — S13 y S14 cerrados, V10 cerrado por construcción y los estados documentales al día

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
| 1 | S13 — retirar `database/` (siete archivos) y dejar `supabase/migrations/` como única fuente de verdad | **hecho** | `008e646`: siete archivos retirados; ninguna referencia fuera de la carpeta y de los documentos de tareas |
| 2 | S14 — leer la ruta base desde `app.json` en `lib/site-url.ts`, con la prueba que impide que vuelvan a separarse | **hecho** | `08d4128`: la ruta se lee de `expo.experiments.baseUrl`; prueba nueva que compara contra la declaración (143 en total) |
| 3 | Cerrar V10 con la evidencia de la fase 2 y verificar que nada escribe `reserved_by` | **hecho** | `20260928120000_drop_reserved_by_window.sql`: `drop column if exists reserved_by` y el trigger de permisos devuelto a su forma estricta; ninguna escritura de la columna en el repositorio |
| 4 | Poner al día `endurecimiento.md` y `consolidacion.md`: S8 resuelto, S13 y S14 cerrados | **hecho** | `endurecimiento.md` (estado general y S13 resuelto), `consolidacion.md` (S13, S14), `reservas.md` (V10) |

## Restricciones

- Ninguna migración ya aplicada se toca: cada fase nueva es un archivo nuevo, y
  aquí no hay fase nueva porque no se cambia el esquema.
- No se consulta la base de producción: todo lo que se afirma se verifica en el
  repositorio.
- El gate local es `CI=1 pnpm exec playwright test --project=chromium`, precedido
  de `pnpm run test:e2e:prepare`, porque el cambio de la ruta base entra en el
  recorrido de alta y de compartición.

## Verificación

- `pnpm run lint` limpio, avisos incluidos.
- `pnpm exec tsc --noEmit` sin errores.
- **143** pruebas unitarias en verde: una más que antes, la que ata la ruta base a
  lo que declara `app.json`.
- Suite completa de chromium: **40/40, sin inestables**, con `CI=1` y el reseed
  previo. Es la red que importa aquí: la ruta base entra en el recorrido de alta y
  en el enlace de invitación.

Lo que la verificación **no** cubre: que la carpeta `database/` desaparezca no lo
demuestra ninguna prueba, porque nada la usaba; se sostiene en la búsqueda de
referencias, que solo la encontró en sí misma y en los documentos de tareas.

## Hallazgos informativos de la revisión

La revisión nativa de la unidad (tier medio, lente de fiabilidad) **aprobó** el candidato sin
abrir corrección. Devolvió un hallazgo informativo, que no bloquea y se trabaja aparte:

| ID | Lente | Ubicación | Gravedad |
| --- | --- | --- | --- |
| R3-001 | fiabilidad | `lib/site-url.ts:37` | aviso |

_Repasados el 2026-09-28: el veredicto y por qué no se toca está en [`informativos.md`](./informativos.md)._

## Consecuencia

Al terminar, el repositorio no contendrá ningún camino que revierta el
endurecimiento, y la ruta del sitio tendrá una sola declaración.
