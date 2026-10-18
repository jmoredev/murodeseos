# Compartir un producto desde el móvil y crear el deseo solo

**Abierta:** 2026-10-18 · **Rama:** `feat/compartir-producto` (desde `main`, `3f4e40c`) · **Estado:** en curso — T1 cerrado (12 semillas, 9 fixtures), T2 en curso (precio hecho)

## Objetivo

Que al compartir una página de producto desde una web o una app de compras en el móvil, *Muro de Deseos*
aparezca en la hoja de «Compartir» del sistema y cree un deseo con la imagen, el precio, el enlace y todo lo
que se pueda leer de esa página. **La robustez del scraping es el requisito primario**: tiene que aguantar
muchas tiendas distintas y no romperse cuando una tienda cambia su HTML.

## Specs

- **S1** — La app aparece en la hoja de «Compartir» de Android al compartir desde una **web o app de compras**,
  y al elegirla arranca la creación de un deseo.

> Cuando desde el móvil en una web o app de compras se de a "Compartir" que salga disponnible esta app para
> recibir ese compartir y crear un deseo con el producto extrayendo imagen, precio, enlace, lo que se pueda de
> la pagina del producto.

- **S2** — De la página del producto se extraen **imagen, precio y enlace**, y además todo lo demás que se pueda
  leer (título, tienda, moneda, descripción). Que un campo no se pueda leer **no impide** crear el deseo.

- **S3** — El scraping tiene que funcionar en **múltiples webs** y ser **muy robusto**; cómo se hace es el
  requisito principal y se decide comparando alternativas, no por costumbre.

> El como se haga el scrapping es super importante porque va a determinar que se pueda utilizar en multiples web
> y sea muy robusto, algo que es primordial.

- **S4 — Decisión del propietario (2026-10-18), plataforma:** fase 1 **PWA en Android** (Web Share Target), sin
  build nativo; el nativo Android+iOS (`expo-share-intent`) **después**, y esa decisión **no cambia el extractor**.

- **S5 — Decisión del propietario (2026-10-18), extracción:** **solo cascada propia, sin costo externo**. No se
  contrata ninguna API de preview/scraping. Consecuencia **aceptada**: las tiendas que bloquean o que solo
  renderizan con JS quedan sin precio/imagen y el usuario completa a mano (el enlace nunca se pierde).

- **S6 — Decisión del propietario (2026-10-18), moneda:** se agrega **`currency` ISO 4217** a `wishlist_items` y
  se muestra. Motivo medido: hoy `price_numeric` es un número sin moneda (`lib/format-price.ts`), así que un
  `12,99` de Amazon.es y un `12,99` de una tienda en USD son indistinguibles en la base.

- **S7 — Decisión del propietario (2026-10-18), orden de entrega:** primero **el extractor, con fixtures de
  páginas reales y tests offline**; la UI de compartir va después. Motivo: es la parte que decide el éxito del
  feature y la que se puede probar sin tocar la PWA.

## Diagnóstico (medido, no supuesto)

Experimento del 2026-10-18 con `curl` y headers de navegador real sobre páginas de producto reales:

| Tienda | HTTP | Tamaño | JSON-LD | Precio declarado | Lectura |
| --- | --- | --- | --- | --- | --- |
| MediaMarkt `..._1542796.html` | 200 | 924 KB | 1 | `"price": 89.99`, `priceCurrency: "EUR"` | la cascada acierta |
| PcComponentes `grand-theft-auto-vi-…` | 200 | 1,0 MB | 2 | `"price":"79.99"` (**string**) | acierta; el precio llega como texto |
| Amazon.es `/dp/B09B8X9RGM` | 200 | 2,2 MB | **0** | **no** | caso duro: exige adaptador de dominio |
| El Corte Inglés `/electronica/` | **403 → 200 con headers** | 5,2 MB | 1 | — | los headers deciden si hay página o muro |
| Mercado Libre AR (home) | 200 | 542 KB | 1 | — | acierta |
| TiendAnimal (home) | 200 | 578 KB | 1 | — | acierta |
| Zara `/es/` | 200 | **2 KB** | 0 | no | cáscara SPA: sin render no hay nada que leer |
| Decathlon | **403** | 6 KB | 0 | no | challenge de Cloudflare («Just a moment...») |
| Fnac.es | **403** | 769 B | 0 | no | bloqueo |

Lo que estos números fijan (no es opinión):

1. **Los headers importan.** La misma URL pasó de **403 a 200** al mandar `Accept`, `Accept-Language`,
   `sec-ch-ua*` y `Sec-Fetch-*`. Un `fetch` con un `User-Agent` suelto pierde tiendas enteras por nada.
2. **La mayoría declara los datos.** JSON-LD `Product`/`Offer` con `price` y `priceCurrency`, más `og:image`.
   Leer lo declarado cubre más tiendas que adivinar por CSS. Corpus público (Web Data Commons): datos
   estructurados en ~51% de las páginas rastreadas, y `Product/offers` en ~94% de las páginas de producto anotadas.
3. **El precio llega como número o como string** (`"79.99"`) y en formato español (`1.234,56`). Normalizarlo es
   una unidad con tests propios, no un `toFixed`.
4. **Hay casos duros conocidos** (Amazon, Zara, Decathlon, Fnac) que necesitan adaptador de dominio o render;
   con S5, esos casos **se degradan a completar a mano**.
5. **La hoja de compartir no trae precio ni imagen**: trae texto y/o URL. Por eso el extractor es el corazón del
   feature y no el payload del share.

### Arquitectura elegida (dos ejes independientes)

- **Eje A — cómo entra el share:** `share_target` en `public/manifest.json` con `method: "POST"`,
  `enctype: "multipart/form-data"` y `params` `title`/`text`/`url` + `files: [{ accept: "image/*" }]`. El service
  worker intercepta el POST (hoy `public/sw.js` descarta todo lo que no sea GET), guarda el payload y responde un
  `303` a la ruta del formulario. Requiere la app **instalada**; Chrome Android 76+; **Firefox y Safari no lo
  soportan** (bug de WebKit abierto desde 2019) → iOS queda para la fase nativa de S4.
- **Eje B — cómo se extrae:** **cascada por tiers**, con procedencia y confianza **por campo**:
  1. JSON-LD `schema.org/Product` · 2. Open Graph / Twitter cards · 3. microdata / RDFa ·
  4. heurística sobre el HTML · 5. adaptador por dominio (declarativo, con fixtures).
  El merge es campo por campo, no «gana la primera fuente». La imagen se **descarga y se sube a Storage**
  (evita hotlinks que expiran y bloqueos por `Referer`). Todo se cachea por URL normalizada y se **mide por
  dominio**, que es lo que decide cuándo hace falta un adaptador.

### Alternativas evaluadas y descartadas

| Alternativa | Por qué no |
| --- | --- |
| Scraping en el cliente | CORS: ninguna tienda deja leer su HTML desde otro origen |
| API de terceros como camino principal | Descartada por el propietario (S5): costo por request, las URLs de los usuarios viajan a un tercero y sigue sin haber control cuando falla |
| Headless browser propio como camino principal | Infra, latencia y costo; contra Amazon no alcanza (fingerprint TLS/IP antes de que corra el código) |
| Extensión de navegador | Es de escritorio, no cubre el caso del móvil |

## Tasks

| # | Tarea | Specs | Commit |
| --- | --- | --- | --- |
| T1 | Convención de fixtures + script de captura de páginas reales + `manifest.json` de fixtures | S3, S7 | — |
| T2 | Núcleo de extracción puro (normalizadores, JSON-LD, Open Graph, microdata, heurística) con tests offline | S2, S3 | — |
| T3 | Adaptadores por dominio, declarativos, con fixtures | S3 | — |
| T4 | Capa de red: fetch con headers de navegador, topes de tamaño y tiempo, **guarda SSRF** | S3 | — |
| T5 | Edge Function: endpoint autenticado, cuota por usuario y caché por URL normalizada | S1, S3 | — |
| T6 | PWA: `share_target` + service worker que maneja el POST + ruta que prellena el formulario | S1, S2 | — |
| T7 | Persistencia: migración de `currency` (ISO 4217) y mostrarla en la UI | S6 | — |
| T8 | Fase nativa: `expo-share-intent` para Android e iOS | S4 | — |

## Log

- **L1 (2026-10-18) — petición del propietario, literal:**

> Una nueva funcionalidad muy importante. Cuando desde el móvil en una web o app de compras se de a "Compartir"
> que salga disponnible esta app para recibir ese compartir y crear un deseo con el producto extrayendo imagen,
> precio, enlace, lo que se pueda de la pagina del producto. El como se haga el scrapping es super importante
> porque va a determinar que se pueda utilizar en multiples web y sea muy robusto, algo que es primordial. Analiza
> las distintas alternativas para hacerlo y dime la que mejor encajaría en nuestra app

- **L2 (2026-10-18) — decisión del propietario, plataforma:** «PWA Android ahora, nativo después». Se le
  presentaron tres caminos (solo PWA Android; PWA ahora + nativo después; nativo Android+iOS desde el arranque) y
  eligió el segundo.

- **L3 (2026-10-18) — decisión del propietario, extracción:** «Solo cascada propia, sin costo externo». Se le
  presentaron tres caminos (cascada propia; cascada con último recurso de pago; API de terceros como camino
  principal) y eligió el primero. Consecuencia aceptada y registrada en S5.

- **L4 (2026-10-18) — decisión del propietario, moneda:** «Agregar currency (ISO 4217) y mostrarla».

- **L5 (2026-10-18) — decisión del propietario, orden de entrega:** «El extractor primero, con fixtures».

- **L6 (2026-10-18) — evidencia medida antes de escribir código** (tabla del diagnóstico). Tres hallazgos que
  cambiaron el diseño: (a) sin headers de navegador, El Corte Inglés responde 403 y con ellos 200; (b) el precio
  puede venir como string en JSON-LD; (c) Amazon no declara **ningún** dato estructurado, así que un adaptador
  por dominio es obligatorio para esa tienda y no un extra.

- **L7 (2026-10-18) — decisión de tooling, para que el mismo módulo corra en vitest y en Deno:** el código puro de
  extracción vive en `supabase/functions/_shared/product-extraction/` con **imports con extensión `.ts`**
  (Deno los exige; vite/vitest los resuelven), y para eso el `tsconfig.json` raíz necesita
  `allowImportingTsExtensions` (hoy no está, ni en `expo/tsconfig.base`). El `index.ts` de la Edge Function
  usará APIs de Deno y **no** puede entrar en el `tsc` de la app: eso se resuelve en T5, no ahora.

- **L8 (2026-10-18) — la rama sale de `main`, no de la rama en la que estaba el árbol.** El árbol estaba en
  `chore/informativos-trabajo-posterior`, con 3 commits sin fusionar. La revisión nativa proyecta `main..HEAD`,
  así que una rama encima de esos commits habría metido tres arreglos de UI ajenos en el diff revisado.

- **L9 (2026-10-18) — resultado de la captura, y un hallazgo que cambia T4.** 9 de 12 semillas
  congelaron fixture (`test/fixtures/product-pages/`, 893 KB comprimidos). Datos estructurados
  encontrados: **El Corte Inglés 2 JSON-LD + 2 `og:image`, IKEA 2 + 1, MediaMarkt 1 + 1,
  AliExpress 1 + 1**; **cero** en Amazon, Zara (cáscara SPA de 2 KB), Decathlon y Fnac (403 de
  Cloudflare). Tres semillas no dieron fixture por descubrimiento sin coincidencia
  (`mercadolibre-ar`, `tiendanimal-es`) o 403 en el listado (`nutritienda-es`). Y el hallazgo
  fuerte: **PcComponentes respondió 403 a Node/undici con los mismos headers con los que `curl`
  lo abría**; o sea que además de los headers decide el **fingerprint TLS**. Consecuencia para
  T4/T5: la capa de red no puede asumir que un `fetch` con headers de navegador alcanza, y el
  desenlace hay que medirlo, no suponerlo.

- **L10 (2026-10-18) — la lectura de precio reusa la convención del propietario en vez de
  inventar una segunda.** `parsePriceText` (`supabase/functions/_shared/product-extraction/normalize/price.ts`)
  acepta número o string, formato español y anglosajón, decide por el separador de la derecha
  cuando están los dos, marca `ambiguous` cuando un solo separador con tres dígitos detrás deja
  la duda abierta, y devuelve `null` en rango, negativo, cero, texto sin dígitos o valor fuera
  de `numeric(12,2)`. Como el módulo vive fuera de `lib/` (Deno), la coincidencia con
  `parsePriceInput` **no** se sostiene por import: se sostiene con un test que corre los dos
  sobre la misma tabla de textos españoles, más otro que fija el tope compartido.

- **L11 (2026-10-18) — un `| tail` me escondió un fallo.** El primer intento de captura salió
  «código 0» pero había muerto al arrancar (top-level await con `tsx` en CJS). El código que se
  lee en un pipe es el del último comando, no el del que importa. Desde acá los comandos de
  verificación van con `set -o pipefail` y con `EXIT=${PIPESTATUS[0]}` explícito.

## Verificación

- **T1**: `__tests__/product-extraction/fixture-capture.test.ts` en verde (9 tests):
  decodificación por `charset` (windows-1252 y caída a UTF-8), resolución de la URL descubierta
  (relativa, absoluta, sin coincidencia y rechazo de esquemas que no sean http(s)), headers de
  navegador e integridad de la lista de semillas.
- **T2 (precio)**: `__tests__/product-extraction/price.test.ts` en verde (16 tests), incluida la
  costura con `lib/format-price.ts`.
- Pendiente: el resto de T2 (extractores y cascada).

## Hallazgos informativos

- **`pccomponentes-es` no se pudo congelar** (403 a undici con los mismos headers con los que
  `curl` lo abría). Queda como semilla para reintentar cuando exista la capa de red (T4).
- **`mercadolibre-ar` y `tiendanimal-es` fallan en el descubrimiento** (patrón sin coincidencia)
  y **`nutritienda-es` da 403 en el listado**: semillas a ajustar cuando T3 evalúe adaptadores.

## Commits

- (vacío por ahora)
