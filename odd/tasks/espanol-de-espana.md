# La interfaz en español de España

**Abierta:** 2026-10-21 · **Rama:** `fix/idioma-es-espana` (desde `main`) · **Estado:** en curso
**Decisión del propietario (2026-10-21):** toda la copy de la app pasa a **español de España**, no español latinoamericano.

## Specs

- **S1 — petición del propietario, literal:**

> Importante, el idioma de la app tiene que ser Español de España, no latinoamericano que es el que
> generalmente utilizas. Esto aplica todos los textos que aparezcan en la aplicación

- **S2 — alcance: lo que ve el usuario.** Copy de la app (`app/`, `components/`, `lib/`), mensajes de
  error que la app puede mostrar, y los textos de «Novedades». **No** aplica a comentarios de código,
  fichas de `odd/`, documentación ni tests: ahí se sigue escribiendo como venga.

- **S3 — registro: tuteo** («Comparte», «carga», «elige»), sin voseo, con léxico de España
  («móvil», no «celular»; «dinero», no «plata»).

- **S4 — formatos con locale `es-ES`** (decimal con coma, símbolo detrás) y `document.documentElement.lang
  = 'es-ES'`.

- **S5 — guardián.** Un test falla si la copy vuelve al rioplatense. Sin él, esta regla se pierde: la
  copy la escriben personas y modelos que tutean en rioplatense por defecto, y ya se coló una vez.

## Tasks

| # | Tarea | Specs | Commit |
| --- | --- | --- | --- |
| T1 | Inventario de copy con marcas rioplatenses | S2 | — |
| T2 | Reescribir las viñetas de Novedades y el mensaje de error del endpoint | S3 | — |
| T3 | `lang="es-ES"` en el documento | S4 | — |
| T4 | Guardián `__tests__/idioma-es-espana.test.ts` + regla en `docs/DEVELOPMENT.md` | S5 | — |
| T5 | Verificación (suite, `tsc`, `eslint`) | S1 | — |

## Log

- **L1 (2026-10-21) — petición del propietario:** la de S1, textual.

- **L2 (2026-10-21) — inventario medido antes de tocar nada.** Barrido de `app/`, `components/`,
  `lib/` y `supabase/functions/` con una lista de marcas (voseo y léxico):

  | Dónde | Qué había |
  | --- | --- |
  | `lib/updates.ts` | **3 viñetas en voseo** («Compartí», «cargá», «Recuperá… cerrá») — las escribió esta sesión en la entrada de Novedades |
  | `supabase/functions/extract-product/index.ts:207` | `'Método no permitido: usá POST.'` |
  | `app/_layout.tsx:29` | `lang = 'es'`, sin región |
  | `lib/format-price.ts:55` | `Intl.NumberFormat('es-ES')` — **ya correcto**, los precios salen `79,99 €` |
  | Resto de la app | ya estaba en **tú** («Comparte tus sueños, organiza tus regalos»), así que el registro era es-ES y lo que se coló fue la redacción nueva |

  Conclusión: el problema no era sistemático, era **mi prosa** filtrándose a la copy.

- **L3 (2026-10-21) — el guardián encontró dos cosas que el inventario no.** (1) Un falso positivo:
  la segunda línea de un comentario de bloque, que no empieza con `*`, se leía como copy; se corrigió la
  heurística para respetar el estado de comentario en vez de meter una excepción. (2) Un fallo de
  verdad, y de los que no se ven: **los ficheros están en CRLF** y en JavaScript `.` no coincide con
  `\r`, así que `/\/\/.*$/` **no borra** un comentario al final de una línea CRLF. El guardián acusaba
  comentarios como copy en todas las líneas con `//` al final. Arreglo: normalizar CRLF antes de
  analizar y usar `[^\n]` en el patrón.

- **L4 (2026-10-21) — la revisión nativa encontró que el guardián era decorativo, y un cambio de
  significado que yo metí sin pedirlo.** Linaje `review-852aa4e90dc757bc` (tier medium, lentes
  `readability` y `reliability`). El refutador dictó `correction_required` con **dos CRITICAL, los dos
  correctos**:
  1. **`R3-001` — `\b` no existe después de una letra acentuada.** En JavaScript `\b` es ASCII:
     `/\bcompartí\b/` da **`false`** sobre «🔗 Compartí un producto desde el móvil», porque `í` y el
     espacio son los dos «no palabra» para el motor. Con eso, **casi toda la lista nunca matcheaba** y
     reintroducir el voseo histórico habría dejado el test en verde. Faltaba además `instalá`.
     Arreglo: lookarounds Unicode (`(?<!\p{L})…(?!\p{L})` con flags `iu`), formas añadidas
     (`instalá`, `avisá`, `mandá`), y un **meta‑test** que exige que el guardián detecte las frases que
     ya se colaron una vez, más otro que comprueba que **no** marca `compartía`, `instalación` ni
     `plataforma`. Demostrado con las dos expresiones sobre el mismo texto: `false` la vieja, `true` la
     nueva.
  2. **`R3-002` — cambié el tiempo verbal sin que nadie lo pidiera.** «la app te avisa» pasó a «te
     avisará», «te llega el aviso» a «recibirás el aviso». El pedido era quitar el voseo, no prometer a
     futuro: restaurado el presente.
  **La ruta de corrección del proveedor rechazó su propio binding por cuarta vez** (tercer linaje
  distinto), así que la corrección se aplicó y verificó fuera de esa ruta: **701 tests + 1 todo**,
  `tsc` y `eslint` en 0. Queda como deuda declarada, igual que en las fichas anteriores.

- **L5 (2026-10-21) — tercera revisión, tercer hallazgo correcto: el meta‑test tapaba un hueco de la lista.**
  Linaje `review-efad3b4458452da6` (mismas dos lentes). El refutador señaló `R3-001`: el meta‑test de las
  frases históricas exigía **al menos una** marca, y «Recuperá tu contraseña y cerrá sesión» pasaba gracias
  a `cerrá`. O sea que **`recuperá` faltaba en la lista y el test no lo veía**: una regresión que
  escribiera solo «Recuperá tu contraseña» habría quedado en verde.
  Arreglo, y es estructural en vez de un parche: la lista creció a las formas de voseo del dominio
  (recuperá, completá, anotá, apuntá, invitá, creá, cambiá, actualizá, eliminá, copiá, pegá, subí, bajá,
  adjuntá, marcá, enviá, reenviá, respondé, decidí, pedí, repetí, seguí) y hay **dos meta‑tests nuevos**:
  uno exige que **cada** forma de la lista se detecte dentro de una frase —no una cualquiera— y otro que
  la lista **cubra** las formas conocidas, comparándolas como conjunto. Así, añadir una forma sin patrón
  o dejar una fuera de la lista falla por sí solo.
  **Verificación:** 7 tests del guardián, **701 tests + 1 todo**, `tsc` y `eslint` en 0. La ruta de
  corrección del proveedor volvió a rechazar su propio binding (quinta vez), así que esta corrección
  también queda sin recibo formal; el linaje se abandona.
