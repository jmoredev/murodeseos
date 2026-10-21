# Respaldo con Firecrawl cuando el camino propio no alcanza

**Abierta:** 2026-10-21 · **Rama:** `feat/respaldo-firecrawl` (desde `main`) · **Estado:** en curso
**Decisión del propietario (2026-10-21):** D1(b) salta también cuando el borrador no sirve · D2 freno de **20 por usuario al mes** · D3 acepta que la URL viaje a un tercero y el tier free lo mantiene gratuito.

## Specs

- **S1 — petición del propietario, literal:**

> Vale, vamos a añadir una API de scraper como Firecrawl que tiene un tier free que nos puede valer para las peticione que vamos a hacer. All final ahora mismo es un proyecto para mi familia y amigos.
> Solo debe de saltar cuando no se pueda obtener los datos de un web con el procedimiento que tenemos ahora.

- **S2 — D1(b), literal:** «D1- aplicamos b». El respaldo salta cuando el transporte **falla** o cuando el
  borrador **no sirve**: sin precio **y** sin imagen. No salta por un campo suelto faltante (una
  descripción ausente no justifica gastar un crédito).

- **S3 — D2, literal:** «D2 aplicamos un freno de 20 usuario/mes». El tope es **por usuario y por mes**,
  y se consume **antes** de llamar a Firecrawl. No hay tope global: con una familia, 20 × usuarios es
  la cota. Si el número de usuarios crece, se revisa.

- **S4 — D3, literal:** «si acepto que viaje la URL a un tercero. Y al ser el tier free sigue siendo
  gratuito». Esto **revierte en parte S5 de `compartir-producto.md`** («sin costo externo», y la
  objeción de que las URLs viajaran a un tercero). La reversión es deliberada y acotada: solo cuando
  el camino propio falla.

- **S5 — transporte: HTTP a `api.firecrawl.dev` desde la Edge Function**, con la key como *secret* de
  Supabase. **MCP y CLI no son transportes de runtime** —la PWA no tiene MCP ni shell— y la *skill*
  es documentación. La key nunca entra al bundle.

- **S6 — 1 crédito por rescate:** se pide `rawHtml` (DOM **ya renderizado**) y se corre **nuestro**
  extractor sobre él. Medido: el modo JSON cuesta **+4 créditos** por página, o sea 5 por rescate y
  200/mes en vez de 1.000. No se usa.

- **S7 — la guarda SSRF decide primero.** Si `guardUrl` rechaza la URL, **no** hay respaldo: la URL
  del usuario no se le manda a un tercero cuando ya sabemos que no es una página pública.

- **S8 — el respaldo nunca empeora el resultado.** Cualquier fallo suyo (sin créditos, timeout, 5xx,
  respuesta rara) devuelve el borrador parcial que ya teníamos, con una nota. Nunca tira.

## Tasks

| # | Tarea | Specs | Commit |
| --- | --- | --- | --- |
| T1 | Medir la premisa: Firecrawl contra PcComponentes y nuestro extractor sobre su `rawHtml` | S6, S7 | — |
| T2 | `fallback/decision.ts` puro: cuándo salta, payload de la petición, lectura de la respuesta y ventana mensual | S2, S6, S8 | — |
| T3 | Presupuesto: migración de tabla + RPC atómico de 20/usuario/mes y su cliente PostgREST con timeout | S3 | — |
| T4 | `config/env.ts`: `PRODUCT_FALLBACK_LIMIT` (20 por defecto, 0 lo apaga) | S3 | — |
| T5 | Cableado en `extract-product/index.ts`: guarda SSRF → cascada → si no sirve, presupuesto → Firecrawl → cascada sobre el HTML renderizado | S2, S5, S7, S8 | — |
| T6 | Tests: predicado, payload, lectura de respuesta (éxito, sin créditos, 401, 5xx, cuerpo raro), presupuesto y entorno | S2, S3, S6, S8 | — |
| T7 | `env.example` y la ficha; verificación (suite, `tsc`, `eslint`) y e2e si hay stack | S1 | — |

## Log

- **L1 (2026-10-21) — petición del propietario:** la de S1, textual, más la pregunta de cómo conectarse
  y el dato de la key con 1.000 créditos mensuales.

- **L2 (2026-10-21) — decisiones:** D1(b), D2 (20/usuario/mes) y D3 (acepta el tercero; el tier free
  sigue siendo gratuito), literales en S2, S3 y S4.

- **L3 (2026-10-21) — medición de la premisa (T1), antes de escribir código.** Con la key ya cargada en
  `.env.local`, `POST https://api.firecrawl.dev/v2/scrape` sobre la ficha de PcComponentes que el
  camino propio no puede leer:

  | Medición | Resultado |
  | --- | --- |
  | HTTP / bytes / tiempo | **200** · 2.095.947 B · 4,6 s |
  | Estructura devuelta | `success:true`, `data.rawHtml` + `data.metadata` |
  | Señales en el HTML | **3** bloques `application/ld+json`, **1** `og:image`, `statusCode: 200` |
  | **Nuestro extractor** sobre ese HTML | título «GRANT THEFT AUTO VI» (`json-ld`), **79.99 EUR** (`json-ld`), imagen (`json-ld`), `siteName` PcComponentes, **cero notas** |

  Conclusión: el respaldo **sí** pasa el challenge de Cloudflare y **no necesita parser nuevo** — el
  DOM renderizado alimenta la cascada que ya existe. Límite conocido: la imagen que declara
  PcComponentes en JSON-LD es una miniatura de 150×150, así que llega imagen pero chica.

- **L4 (2026-10-21) — decisión de transporte, con la razón medida.** De la documentación de Firecrawl:
  `rawHtml` cuesta **1 crédito**; el formato `json` con schema cuesta **+4**, o sea **5 por página**.
  Con 1.000 créditos: **1.000 rescates** con `rawHtml` frente a 200 con JSON. Por eso el respaldo pide
  HTML y extrae con lo nuestro (S6).

- **L5 (2026-10-21) — verificado de punta a punta en el runtime local, gastando 1 crédito.** Con el
  stack levantado y la migración aplicada (`supabase migration up`), `supabase functions serve
  extract-product --env-file .env.local` y una petición real con el token del usuario E2E:

  | Medición | Resultado |
  | --- | --- |
  | Primera petición a la ficha de PcComponentes | **200** en **4,8 s** · `ok:true` · **`via: "firecrawl"`** |
  | Borrador devuelto | título «GRAND THEFT AUTO VI» · **79.99 EUR** · imagen · **cero notas** |
  | Fila del presupuesto | `count: 1`, `window_start: 2026-10-04` (ventana de 30 días) |
  | Segunda petición, misma URL | **`cached: true`** en **0,02 s** y **`count` sigue en 1** |

  Las dos últimas filas son las que importan para el bolsillo: el mismo enlace **no cuesta dos
  créditos**, porque el borrador del respaldo se cachea con la misma clave que el directo.

  **Lo que este run NO prueba:** que la guarda SSRF y el respaldo convivan en el runtime desplegado
  (acá corrió local), ni el caso de presupuesto agotado ni el de proveedor sin créditos, que están
  cubiertos por tests con dobles pero no por una llamada real. El stack local quedó levantado.

- **L6 (2026-10-21) — la revisión nativa encontró un BLOCKER real, y era mío.** Linaje
  `review-9546ed1ed63e9f92` (tier **medium**, lentes `review-risk`, `review-resilience`,
  `review-reliability`). Las tres lentes corrieron y el proveedor pidió **refutador**; el refutador dictó
  `correction_required` con cinco hallazgos, de los cuales **tres son defectos de verdad**:
  1. **`R3-FALLBACK-DRAFT-LOSS` / `R4-FALLBACK-DRAFT-LOSS` (BLOCKER, inferencial)** — el camino de
     respaldo **reemplazaba** el borrador directo en vez de fusionarlo. Una página que el camino propio
     leyó a medias (título, descripción, tienda, sin precio ni imagen) podía salir **peor** después del
     respaldo, y esa pérdida quedaba **cacheada**. Es exactamente lo que S8 prohíbe. Arreglo:
     `mergeFallbackDraft` en `fallback/decision.ts`, campo por campo, el directo gana donde tiene algo y
     el respaldo solo rellena; las notas de un campo que dejó de faltar se descartan.
  2. **`R3-DIRECT-VIA-SHAPE` / `R4-RESPONSE-SHAPE` (CRITICAL, determinista)** — agregué `via: 'direct'`
     a **todas** las respuestas exitosas existentes, y `fallback` a **todos** los fallos. Cambiar la
     forma de una respuesta que nadie pidió tocar es una regresión de contrato. Arreglo: `via` queda
     **solo** en el camino nuevo (`firecrawl`), y `fallback` solo aparece cuando hay algo que contar.
  3. **`R3-ERROR-FALLBACK-SHAPE` (CRITICAL)** — el mismo problema que el anterior, visto por la otra
     lente. Se arregla con el mismo cambio.
  **Rojo observado antes del arreglo:** 3 de 5 tests de `fallback-merge.test.ts`. Después: **671 tests
  + 1 todo**, `tsc` y `eslint` en 0.
  **El proveedor no me dejó cerrar la corrección por su ruta:** `capture-correction-plan` rechazó **dos
  veces** el binding que el propio STATUS acababa de emitir (`collectBinding is missing or stale`, con
  `expected-revision` y `request-hash` idénticos). No se iteró más: es el mismo defecto que la ficha
  `compartir-producto.md` documentó en L31 y que costó seis rechazos allí.
