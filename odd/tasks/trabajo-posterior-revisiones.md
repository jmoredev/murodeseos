# Trabajo posterior de las tres revisiones

**Abierta:** 2026-10-13 · **Rama:** `chore/trabajo-posterior` (desde `main`, `41563fe`) · **Estado:** en curso

**Qué es esto.** Las tres revisiones nativas del día (el precio, el corte de interfaz y el de alturas) dejaron **quince hallazgos informativos** que el proveedor declaró explícitamente «trabajo posterior, nunca motivo para re-revisar ese candidato». Aquí se abordan, más la **deuda de prueba** que señaló la revisión del corte de app (editar un deseo y el cero en el modal, que solo tenían unitarios).

**Aviso de honestidad sobre las especificaciones.** El proveedor **solo me da id, lente, severidad y ubicación**; **no** el texto literal del hallazgo. Así que las `S#` de abajo **no son citas suyas**: son mi **lectura crítica de la ubicación citada**, y lo digo para que nadie las tome por el hallazgo original. En **dos** ubicaciones (el sembrado de `e2e/card-heights.spec.ts:54` y el `input` de fichero de `components/WishListTab.tsx:665`) **no he identificado ninguna mejora defendible**, y se quedan como están en vez de cambiar algo por parecer diligente.

## Specs

- **S1** — `wishLinkHost` (y `truncateWishLink`) dejan de normalizar a mano con `url.startsWith('http')` y **reutilizan `normalizeWishLink`**, que ya existe en el mismo módulo y usa `/^https?:\/\//i`. Motivo: `startsWith` es sensible a mayúsculas, así que `HTTP://x` se convertía en `https://HTTP://x`. *(Hallazgo `R3-WISHLINKHOST-PARSE`.)*
- **S2** — El **dominio visible nunca depende del recorte del navegador**: si el dominio es más largo que un máximo, se recorta **en el helper, con puntos suspensivos explícitos**, y el nombre accesible conserva el dominio completo. Motivo: hoy el chip lleva `numberOfLines={1}` con `shrink`, así que la elipsis la decide el CSS y no se puede probar. *(Hallazgo `R3-LINK-CHIP-SHRINK`.)*
- **S3** — El E2E de alturas **limpia sus ids** tras la limpieza y **separa los dos anchos en dos pruebas**, para que un fallo diga en qué ancho falla y para que ninguno dependa del otro. *(Hallazgos `R3-001` y `R3-003`.)*
- **S4 — REFUTADA POR MEDICIÓN, así que NO se hace.** El hallazgo `R1-decimal-precision` sostenía que el precio va a la base como número de JS y que eso redondeaba mal (un `1,005` tecleado acabaría en `1.00`). **Medido contra el stack local con las dos formas**, mandando el mismo `1.005` por la API REST:

```
prueba-cadena | 1.01     <- con la cadena "1.005"
prueba-numero | 1.01     <- con el número 1.005 (lo que hay hoy)
```

Las dos guardan `1.01`. PostgREST envía el número en su **representación decimal más corta**, que es exactamente la que se tecleó, así que el redondeo de Postgres ya es correcto: cambiar el tipo del envío **no arreglaría nada** y sí cambiaría el contrato del payload. Se deja como está. *(Hallazgo `R1-decimal-precision`, refutado por medición.)*
- **S5** — La pasada de legibilidad: **nombres** (`digitoEntero`/`digitoDecimal` → `parteEntera`/`parteDecimal`, que es como se llaman ya en la rama del punto), el **comentario engañoso** sobre la coma final, la **ventana de escaneo** de `__tests__/WishlistCard.test.tsx` (hoy `slice(0, 200)`, que es frágil: se ancla en el bloque del elemento), y los comentarios largos de `WishlistCard` y del helper. *(Hallazgos `R2-nombres-digito`, `R2-comentario-coma`, `R3-SOURCE-WINDOW-ASSERT`, `R2-001` y `R2-002`.)*
- **S6** — La **ficha del corte de alturas** deja de decir «código sin escribir»: ese estado está obsoleto y una ficha que miente es peor que una incompleta. *(Hallazgo `R2-003` sobre `odd/tasks/ui-altura-tarjetas.md:3`.)*
- **S7** — **Deuda de prueba**: el E2E cubre **editar un deseo** (cambiar su precio y comprobar lo que se envía y lo que queda) y el **cero en el modal** (un deseo de `0` se pinta `0,00 €` y **no** «Sin precio», que es el defecto que se cerró en el corte del precio). Hoy solo lo cubren unitarios.

**Fuera de alcance, y por qué:** extraer un `SecondaryButton` (la forma está en tres sitios) es un refactor estructural que merece su propio corte, y la **notificación del sistema** que vio el propietario es una comprobación suya en el dispositivo, no trabajo de este repositorio.

## Tasks

| # | Tarea | Specs | Commit |
| --- | --- | --- | --- |
| T1 | `wishLinkHost` y `truncateWishLink` reutilizan `normalizeWishLink`, y el dominio largo se recorta **en el helper** con puntos suspensivos explícitos | S1, S2 | 1 |
| T2 | El E2E de alturas: ids limpios y un test por ancho | S3 | 1 |
| T3 | ~~El precio viaja como cadena decimal a la base~~ **descartada**: la medición del `L6` demuestra que el número ya se redondea bien, así que el cambio no arreglaría nada | S4 (refutada) | — |
| T4 | Pasada de legibilidad: nombres, comentario engañoso, ventana de escaneo del test y comentarios largos | S5 | 1 |
| T5 | La ficha de alturas deja de decir que el código no está escrito | S6 | 1 |
| T6 | E2E de **editar un deseo** y del **cero en el modal** | S7 | 2 |
| T7 | Verificación completa (typecheck, lint, unitarios, suite E2E) y PR | S1-S7 | — |
| T8 | Revisión nativa del corte (decisión del propietario) | — | — |

## Log

- **L1 (2026-10-13) — petición del propietario, literal:**

> Vale, mientras continuamois con el trabajo posterior

- **L2 (2026-10-13) — decisión del propietario:** **todo el trabajo posterior en un solo corte** (fiabilidad + legibilidad + la deuda de prueba), entre las tres opciones que se le presentaron, y **no** solo el bloque de fiabilidad ni solo la deuda de prueba.

- **L3 (2026-10-13) — de dónde sale cada hallazgo:** `R1-decimal-precision`, `R2-comentario-coma` y `R2-nombres-digito` del linaje `review-cf1add91836999c2`… no: del **precio** (`review-93a5c7f00f1ef4f9`); `R2-001`, `R2-002`, `R2-003`, `R3-LINK-CHIP-SHRINK`, `R3-SOURCE-WINDOW-ASSERT` y `R3-WISHLINKHOST-PARSE` del **corte de interfaz** (`review-cf1add91836999c2`); y `R2-001`, `R2-002`, `R2-003`, `R3-001`, `R3-002` y `R3-003` del **corte de alturas** (`review-b58e43a714f2c1c6`).

- **L4 (2026-10-13) — lo que NO se toca, con el motivo delante:** en el sembrado de `e2e/card-heights.spec.ts:54` y en el `input` de fichero de `components/WishListTab.tsx:665` **no he identificado ninguna mejora defendible** leyendo el código, así que se quedan como están. Cambiarlos para parecer diligente sería ruido en la revisión, y eso también es un coste.

- **L5 (2026-10-13) — y el trade-off de la rejilla, que sí conviene dejar escrito (`R3-002`):** `auto-rows-fr` hace que **todas** las filas midan lo que la tarjeta más alta de la lista, así que en una lista larga con una tarjeta muy alta el resto paga ese alto. Es el precio inevitable de la uniformidad que se pidió, y va escrito en el código para que nadie lo descubra con sorpresa.

- **L6 (2026-10-13) — una tarea se cae por medición antes de escribirla:** el hallazgo `R1-decimal-precision` afirmaba que mandar el precio como número de JS redondeaba mal. Se comprobó con las dos formas contra el stack local (`'1.005'` como cadena y `1.005` como número) y **las dos guardan `1.01`**: PostgREST manda el número en su representación decimal más corta, que es la que se tecleó. Así que el cambio propuesto **no arreglaba nada** y sí tocaba el camino del dinero y el contrato del payload. **Descartado**, con la medición aquí. Es la tercera vez hoy que medir mata una premisa que parecía razonable.
