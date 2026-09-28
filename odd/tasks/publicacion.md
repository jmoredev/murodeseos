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
| 1 | Disparadores por etiqueta y guardia de que la etiqueta está en `main` | pendiente | — |
| 2 | Procedimiento de publicación en `docs/DEVELOPMENT.md` y la decisión en `consolidacion.md` | pendiente | — |
| 3 | Verificación: YAML válido, guardia probada en local y gate completo | pendiente | — |

## Restricciones

- La unidad no toca código de producto: solo el workflow y su documentación.
- No se publica nada durante la verificación: **el disparo por etiqueta no se puede
  demostrar sin publicar**, y publicar de prueba sería escribir en producción. Se verifica
  lo que sí es verificable y se dice qué queda por demostrar.
- La protección de `main` no cambia: los dos checks siguen siendo obligatorios.

## Verificación

Pendiente.

## Consecuencia

Al terminar, `main` sigue siendo la línea de desarrollo y lo único que cambia es **cuándo**
se publica: cuando se decide, con una etiqueta que lo deja escrito. El día que haya que
publicar un arreglo urgente, son tres comandos y ninguno pasa por una rama intermedia.
