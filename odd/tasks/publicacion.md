# Publicar de forma deliberada, con registro

**Rama:** `ci/publicar-con-etiquetas`
**Abierta:** 2026-09-28
**Estado:** en curso

## Objetivo

Bajar el número de publicaciones sin renunciar a que cada cambio esté revisado y probado, y
dejar registro en git de **qué** se publicó y **cuándo**.

## Contexto encontrado

- Hoy `deploy.yml` se dispara con `push: branches: [main]`, así que **cada merge publica**.
  Esta sesión fueron ocho PRs y, por tanto, ocho publicaciones.
- Cada publicación empuja un bundle nuevo a las PWA instaladas, y el service worker usa
  `skipWaiting` y `claim`: el bundle nuevo se activa de inmediato, así que el cambio puede
  caerle a alguien **a mitad de sesión**. Menos publicaciones es mejor por eso, no por
  comodidad.
- `deploy.yml` **ya tenía** `workflow_dispatch`, así que publicar a mano ya era posible; lo
  que sobraba era el disparo automático.
- `ci.yml` ya corre en cada `pull_request` y en cada `push` a `main`, y `e2e.yml` es
  reutilizable: el gate corre en ambas situaciones y antes de publicar. No hay nada que
  duplicar.

## Decisiones

- **D1 — No se introduce una rama `develop`.** Separa ramas, y lo que hacía falta separar
  era el merge de la publicación. Un `develop` permanente habría traído: el problema de los
  hotfixes (arreglar en `main` y olvidar volver a `develop` hace que el siguiente release
  reverte el arreglo), dos líneas que sincronizar para siempre, y un PR `develop → main`
  que deja de ser un cambio revisable: un bulto de ocho unidades donde hoy hay ocho
  revisiones. `main` no tiene nada de «rama de producción» salvo que publicaba.
- **D2 — La publicación se dispara con una etiqueta `v*`.** Es el registro que faltaba: se
  puede consultar qué estado de `main` está publicado. Se mantiene `workflow_dispatch` para
  republicar o revertir sin mover etiquetas.
- **D3 — El workflow comprueba que la etiqueta apunta a `main`.** Una etiqueta puede
  apuntar a cualquier commit, y publicar algo que no pasó por las revisiones sería el único
  agujero de este diseño. La comprobación es `git merge-base --is-ancestor`, y sin ella el
  build no arranca.
- **D4 — La etiqueta marca *cuándo* se publicó, no la versión del producto.** La versión
  del producto vive en `app.json`; repetirla en la etiqueta sería un valor duplicado más,
  que es justo lo que esta sesión ha ido retirando.
- **D5 — El gate de publicación no cambia:** `needs: [build, e2e]`. Lo que se publica sigue
  pasando por la misma suite que los pull requests.

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Disparadores por etiqueta y guardia de que la etiqueta está en `main` | **hecho** | `aaed4fd`: `deploy.yml` se dispara con `push: tags: ['v*']` y conserva `workflow_dispatch`; sin la guardia el build no arranca |
| 2 | Procedimiento de publicación en `docs/DEVELOPMENT.md` y la decisión en `consolidacion.md` | **hecho** | `ee8963e`: la sección `Cómo se publica`, con el comando de la etiqueta y la nota de que marca cuándo se publicó, no la versión |
| 3 | Verificación: YAML válido, guardia probada en local y gate completo | **hecho** | Los tres workflows se parsean; la guardia se probó en tres casos (un commit de `main` la pasa, el de la rama y el de otro PR sin mergear la fallan); lint, tipos y 148 unitarios en verde |
| 4 | Procedimiento de vuelta atrás, escrito donde se lee (hallazgos R3-ROLLBACK-DOC y R4-ROLLBACK-GAP) | **hecho** | En `docs/DEVELOPMENT.md`, dentro de `### Cómo se publica`: los dos caminos —arreglar hacia adelante o republicar un estado bueno—, la advertencia de que `main` y lo publicado divergen hasta que entre el arreglo, y lo que una vuelta atrás **no** revierte |
| 5 | Comprobar el disparo por etiqueta con la primera etiqueta real | pendiente | No se puede demostrar sin publicar: es lo único no verificado de esta unidad, y la primera etiqueta que se empuje lo demuestra |

## Restricciones

- La unidad no toca código de producto: solo el workflow y su documentación.
- No se publica nada durante la verificación: **el disparo por etiqueta no se puede
  demostrar sin publicar**, y publicar de prueba sería escribir en producción. Se verifica
  lo que sí es verificable y se dice qué queda por demostrar.
- La protección de `main` no cambia: los dos checks siguen siendo obligatorios.

## Verificación

- Los tres workflows se parsean y el grafo queda como se pretendía: `verify-release → build`
  y `deploy needs [build, e2e]`.
- **La guardia se probó en los tres casos**: un commit de `main` la pasa; el commit de esta
  rama y el de otro PR sin mergear la fallan. Sin esa prueba, la guardia sería una promesa.
- `pnpm run lint` limpio, `pnpm exec tsc --noEmit` sin errores y **148** pruebas unitarias en
  verde (el recuento de entonces; después entró la unidad del mínimo de contraseña).
- El gate completo **no se ejecutó a propósito**: esta unidad no toca código de producto, así
  que la suite no añade información. Se dice en lugar de fingir que se corrió.
- **Los comandos del procedimiento de vuelta atrás se comprobaron ejecutándolos**: `git tag
  --sort=-creatordate` lista las etiquetas por fecha y `git log --oneline --
  supabase/migrations/` localiza las migraciones del rango. No se creó ninguna etiqueta
  durante la verificación, porque crear una publica.

## Hallazgos informativos de la revisión

La revisión nativa (tier alto, cuatro lentes) **aprobó** el candidato sin abrir corrección y
devolvió **seis** hallazgos informativos. Leídos juntos son **tres temas**, dos de ellos vistos
por más de una lente, que es lo que pasa cuando el mismo hueco se mira desde el riesgo y desde
la fiabilidad:

| ID | Lente | Ubicación | Gravedad | Nota (lectura propia) |
| --- | --- | --- | --- | --- |
| R3-ROLLBACK-DOC | fiabilidad | `docs/DEVELOPMENT.md:46` | aviso | Dice que se puede republicar o revertir a mano, pero **no dice cómo**. Es el arreglo más útil de los seis: sin procedimiento escrito, una vuelta atrás se improvisa |
| R4-ROLLBACK-GAP | resiliencia | `docs/DEVELOPMENT.md:46` | aviso | El mismo hueco visto desde la resiliencia |
| R3-VERIFY-PENDING | fiabilidad | `odd/tasks/publicacion.md` | aviso | El disparo por etiqueta no se puede demostrar sin publicar, y está declarado como restricción; conviene además dejar la tarea de comprobarlo con la primera etiqueta real |
| R4-UNVERIFIED-TRIGGER | resiliencia | `odd/tasks/publicacion.md` | aviso | Lo mismo desde la resiliencia: es una restricción escrita, no un olvido |
| R4-RECORD-DRIFT | resiliencia | `odd/tasks/publicacion.md` | aviso | Sobre la redacción de las decisiones. Al registrarlo revisé las menciones a la publicación en `README`, `docs/` y los documentos de tareas: ninguna afirmaba el comportamiento anterior |
| R2-001 | legibilidad | `odd/tasks/publicacion.md` | aviso | Sobre la tabla de tareas |

**Lo que merece trabajo, y se deja para una unidad propia:** el procedimiento de vuelta atrás
y la comprobación con la primera etiqueta real. Los otros cuatro son redacción.

## Consecuencia

Al terminar, `main` sigue siendo la línea de desarrollo y lo único que cambia es **cuándo**
se publica: cuando se decide, con una etiqueta que lo deja escrito. El día que haya que
publicar un arreglo urgente, son tres comandos y ninguno pasa por una rama intermedia.
