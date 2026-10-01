# Documentos de feature (ODD)

`odd/tasks/<feature>.md` es la ficha viva de cada feature: objetivo, decisiones
confirmadas con el usuario, unidades de trabajo, verificación, hallazgos y commits.
La ficha se actualiza durante el trabajo, no al final: es la fuente de verdad para
retomar una feature interrumpida.

## Estructura de una ficha

1. **Cabecera**: fecha de apertura, rama (y desde qué rama sale), estado real.
2. **Objetivo**: qué se quiere conseguir, en términos de producto.
3. **Decisiones**: las que se confirmaron con el usuario, con su motivo y la
   evidencia técnica que las sustenta (por ejemplo, la limitación de
   `react-native-web` que forzó usar el input de fecha nativo).
4. **Unidades de trabajo**: tabla por unidad y subunidad, con estado y una nota
   corta de lo que realmente se implementó (rutas, símbolos, decisiones locales).
5. **Verificación**: qué se verificó, por quién (writer, verificador
   independiente, CI, revisión nativa), con linajes y evidencias.
6. **Hallazgos informativos**: los no bloqueantes de cada revisión, con
   `fichero:línea` y severidad. Son trabajo posterior, nunca motivo para reabrir
   una revisión cerrada.
7. **Commits**: la lista de work-units, con hash y mensaje.

## Orden de cierre de una rama (regla)

**Registrar el commit `docs(odd)` de cierre de la feature ANTES de la revisión
nativa final de la rama.**

Motivo verificado: el controlador de revisión nativa proyecta siempre
`main..HEAD` y congela la identidad del target sobre el árbol revisado. Cualquier
commit posterior —aunque sea puramente documental— cambia el árbol del candidato
y deja un **target unreviewed nuevo**, que obliga a una segunda pasada de
revisión: una corrida de lente completa sobre el mismo diff más el cambio
documental.

Evidencia (feature `cumpleanos-onomastico`, 2026-10-01): la revisión final se
hizo sobre el árbol de `bd6b17d` (linaje `review-139eb5be6114e444`, aprobada y
quemada); el registro `docs(odd)` `ccf056b` se commiteó después y dejó el target
`sha256:0a5c365d…` sin revisar, que exigió una segunda revisión completa
(linaje `review-d2982a4e89dfa121`, 19 ficheros / 1694 líneas) cuando el único
delta real era un fichero de documentación.

Procedimiento acordado:

1. Implementar y verificar las unidades.
2. Actualizar la ficha `odd/tasks/<feature>.md` (estados, verificación, commits).
3. Commit `docs(odd)` con ese registro, y push.
4. Revisión nativa final de la rama (ver más abajo).
5. Merge (decisión humana).

Si aparece un cambio de código **después** de la revisión final, la rama necesita
una revisión nueva de ese candidato: no se reutiliza autoridad quemada. Si el
delta posterior es **solo** documentación pasiva, la exención documental permite
no revisarlo, pero es una disposición que se decide y se deja registrada, no algo
que se asuma.

## Revisión nativa (RDD)

- La revisión nativa es un requisito de proceso cuando el interruptor de RDD está
  activo. Su resultado es informativo: **no autoriza entrega**. Commit, push, PR y
  merge siguen siendo decisiones humanas.
- El controlador solo ofrece la proyección `main..HEAD`, así que **no se puede
  revisar una unidad aislada**: conviene una sola revisión por rama, al final.
- Los hallazgos *advisory* **no son deterministas**. Sobre ficheros idénticos, dos
  corridas de la misma lente dieron conjuntos distintos (6 hallazgos en
  `review-139eb5be6114e444` frente a 5 en `review-d2982a4e89dfa121`, con un
  WARNING que desaparece y dos severidades que bajan a SUGGESTION). El único
  hallazgo estable en las tres revisiones de `cumpleanos-onomastico` fue el
  dedupe por anti-join de `supabase/migrations/20260930160000_*.sql:268-275`.
  Consecuencia: una sola corrida no basta para declarar un fichero limpio.
- Si un `start` se interrumpe (suspensión, cierre del proceso), no queda linaje ni
  autoridad: basta un `inspect` fresco para reconducir. No hace falta `reset` ni
  `recover`, ni tocar `.git/gentle-ai`.
