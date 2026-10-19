# Compartir un producto desde el móvil y crear el deseo solo

**Abierta:** 2026-10-18 · **Rama:** `feat/compartir-producto` (desde `main`, `3f4e40c`) · **Estado:** en curso — **T1 a T6 cerrados**, con las **revisiones nativas** hechas por tramo (T1-T5 aprobadas, T2 y T5 tras corregir lo que el refutador encontró) y **T5 y T6 medidos contra el runtime real**. Lo siguiente es **T7** (`currency`) o **T8** (la fase nativa). Lo que falta de T6 y no se puede cerrar desde acá: **probarlo en un teléfono con la PWA instalada** (declarado en L20)

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

- **S8 — Decisión del propietario (2026-10-18), dependencias:** se autoriza **una** dependencia de
  runtime, `node-html-parser`, para los adaptadores por dominio. Cualquier otra dependencia —de
  runtime o de desarrollo— necesita una decisión nueva: sumar una es riesgo de entrega y obliga a
  verificación independiente.

- **S9 — Decisión del propietario (2026-10-18), alcance de los adaptadores:** T3 cubre **solo
  Amazon**. Los siguientes adaptadores los decide la telemetría por dominio de T5, con datos de uso
  reales. Motivo medido: PcComponentes, Fnac y Decathlon no se arreglan con un adaptador (bloquean
  el transporte antes del parseo), así que escribir adaptadores «por si acaso» sería trabajo tirado.

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
| T1 | Convención de fixtures + script de captura de páginas reales + `manifest.json` de fixtures | S3, S7 | `5c1fcc3`, `d89de4d` |
| T2 | Núcleo de extracción puro (normalizadores, JSON-LD, Open Graph, microdata, heurística) con tests offline | S2, S3 | `5c9fc65`, `8bfde52`, `beb0e0b`, `1e9b7c4`, `4d4df8a` |
| T3 | Adaptadores por dominio, declarativos, con fixtures | S3, S8, S9 | `c54a666` |
| T4 | Capa de red: fetch con headers de navegador, topes de tamaño y tiempo, **guarda SSRF** | S3 | `c0ae2e3` |
| T5a | Edge Function: endpoint autenticado (JWT de la plataforma) + extracción | S1, S2, S3 | `90ac8a8` |
| T5b | Cuota por usuario y caché por URL normalizada, con su migración | S1, S3, S5 | `aa90e2f`, `c6ede3b` |
| T6 | PWA: `share_target` + service worker que maneja el POST + ruta que prellena el formulario | S1, S2 | `aa776ae`, `4fd6be4` |
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

- **L12 (2026-10-18) — la capa heurística de imagen se elimina, y es una decisión con evidencia.**
  Verificando el corte del worker encontré que el test de `amazon-es` fijaba como foto del producto
  una **miniatura de reseña de 154×154**. Eso es peor que no traer imagen: el usuario no lo nota
  hasta que el regalo llega distinto. Al exigir un tamaño mínimo declarado, la cascada pasó a
  devolver el **sprite de navegación**; al exigirle evidencia de que el recurso fuera contenido,
  pasó a devolver `https://www.amazon.es/dp/%22+t.image+%22`, una URL **armada con texto de un
  `<script>`**. Tres intentos, tres respuestas equivocadas de la **misma** página. La conclusión no
  era afinar más la heurística, sino que sin declaración la imagen más grande del HTML es cromo:
  sin JSON-LD, Open Graph ni microdata no hay imagen, y la foto de esas tiendas es trabajo del
  adaptador de dominio (T3). Los tres casos medidos quedan pinchados en un test para que nadie
  reintroduzca la capa sin evidencia nueva.

- **L13 (2026-10-18) — verificación del corte delegado: no me quedé con el reporte del worker.**
  Comprobé yo: los tres comandos (51 tests del directorio, 336 de la suite, `tsc` y `eslint`
  limpios), el diff real de `tsconfig.json` (una sola bandera), las superficies tocadas, y leí
  entero el precio de la cascada (`extract/index.ts`, `extract/heuristics.ts`). El reporte del
  worker fue honesto en lo que no cerraba —PcComponentes sigue 403, AliExpress tiene menos datos de
  los que suponía el enunciado, Amazon no declara nada— y declaró su propio límite de TDD: el RED
  observado fue de resolución de import, no de aserción contra un stub. **Riesgo de revisión
  declarado:** el corte son 1346 líneas en un commit; no se puede partir sin dejar un commit con
  tests en rojo, porque el test de cascada cubre las cinco capas a la vez.

- **L14 (2026-10-18) — T3: una sola dependencia, autorizada por el propietario, y el specifier de
  Deno aislado en un fichero.** Amazon declara **cero** datos estructurados (2,2 MB, 0 JSON-LD, 0
  `og:image`), así que el adaptador lee lo que Amazon sí publica: `#productTitle`, el texto
  accesible `.a-offscreen` del bloque de precio (`89,99€` → `89.99 EUR` por el lector compartido) y
  la imagen desde `data-a-dynamic-image` por **mayor área declarada** (879×549 = 482.571 gana a seis
  variantes; el `src` es la de 300×300 y usarlo habría degradado la foto). Precedencia
  `domain-adapter > json-ld > open-graph > microdata > heuristic`, campo por campo, documentada en
  `extract/index.ts`. `node-html-parser` se importa **solo** en `extract/html.ts`: la Edge Function
  corre en Deno, donde puede hacer falta `npm:node-html-parser`, y así es un cambio de una línea en
  T5 en vez de un refactor.

- **L15 (2026-10-18) — el verificador independiente encontró lo que yo no había pedido.** No repitió
  mis comandos: hizo una **prueba de mutación** (desactivó el adaptador → 4 tests fallan), un
  diferencial sobre los 9 fixtures, y comprobó el `sha256` de cada uno contra el manifiesto. De sus
  tres hallazgos no bloqueantes corregí el que tiene consecuencias: `amazon.es.evil.com` quedaba
  reclamado por nuestra regla. Los otros dos quedan anotados abajo.

- **L16 (2026-10-18) — la guarda SSRF se rompió y se arregló con evidencia, y el verificador
  corrigió su propia observación.** El verificador adversario encontró el bypass clásico: las
  direcciones IPv6 de **transición** (NAT64, 6to4, Teredo, `::ffff:0:…`) no se clasificaban, así
  que `http://[64:ff9b::a9fe:a9fe]/latest/meta-data/` alcanzaba la dirección de metadatos. El fix
  clasifica la **IPv4 embebida** —no las formas—, que es lo que permite que una tienda servida
  por NAT64 con una IPv4 pública siga funcionando. La re-auditoría dio PASS, con prueba de
  mutación (13 tests fallan sin la clasificación). Y en el camino corregimos **la observación del
  propio verificador**: había afirmado que `Location: /../..///127.0.0.1/` estaba bloqueada, y es
  una ruta relativa que resuelve contra el mismo host público (`https://shop.example///127.0.0.1/`):
  no es un bypass, y bloquearla hubiera roto redirecciones legítimas. Reconocido por él mismo.

- **L17 (2026-10-18) — las cinco revisiones nativas, y los tres CRITICAL que encontró el paso
  adversarial.** El propietario decidió revisar los tres tramos que faltaban (T1, T2, T3). El
  candidato de rama entera **no es revisable** (43 ficheros y 885 KB de fixtures exceden el
  presupuesto de contexto del proveedor: `lens_context_budget_exceeded`), así que se revisó por
  tramos con `baseRef` + `committedOnly` y **parando el árbol en el tip de cada uno**
  (`git switch --detach`); los commits ya estaban por unidad de trabajo y no hubo que reescribir
  nada. Resultado: T4, T3 y T1 **aprobados**; T2 quedó **escalated** porque el validador rechazó la
  primera corrección, y se cerró con un **linaje nuevo sobre el corte ya corregido**. Los tres
  CRITICAL los levantó el **refutador**, no las lentes (las cinco corridas de lentes salieron «a
  favor»):
  1. `R4-FABRICATED-PRICE` (T2): la heurística tomaba el **nodo de texto entero** y `parsePriceText`
     reconstruía la cantidad con los tramos de dígitos → `Pack 2 unidades · 39,99 €` = **239,99**,
     `2 pen drives` = **2 PEN**. La misma familia del `10125,11 EUR` medido en El Corte Inglés.
  2. `R3-only-empty-filter` (T1): un `--only=` vacío (variable de shell sin definir) se leía como
     «opción ausente» → **18 peticiones a todas las tiendas y salida 0**.
  3. `R4-001` (T2, **en mi propio arreglo**): el código ISO se interpolaba **sin límites de palabra**
     → `PEN` casaba dentro de `PENDRIVE` (2 PEN) y `AUD` dentro de `AUDIO`.
  Arreglos: `d89de4d`, `beb0e0b`, `1e9b7c4`, `4d4df8a`. Y una lección de método que costó dos
  rechazos: **un límite documentado no es un límite aceptado** — el validador llamó regresión a la
  pérdida de `29.95 USD` («*even though it is documented as a trade-off*») y el refutador convirtió
  en CRITICAL el prefijo que yo había escrito como «residuo» en el mensaje de commit.

- **L18 (2026-10-18) — T5: medir antes de escribir, y las dos premisas que la medición corrigió.**
  Las dos incógnitas que esta ficha tenía como bloqueantes se midieron contra el runtime real con
  una sonda temporal: (a) el mapa de imports de `supabase/functions/deno.json` **resuelve**
  `node-html-parser` y deja intacto el import del módulo compartido (vitest sigue corriendo el mismo
  código); (b) `Deno.resolveDns` existe y el runtime **alcanza más que undici**: Amazon `/dp/…` →
  200 (2,28 MB, el adaptador leyó título, `89,99 EUR` e imagen) y **PcComponentes → 200**, donde
  undici comía 403. La premisa «el fingerprint TLS decide» era de Node, no del runtime. La misma
  medición encontró el precio falso de El Corte Inglés (L17).
  T5 se cerró en dos unidades: **T5a** (`90ac8a8`) el endpoint autenticado por `verify_jwt`, medido
  en el runtime (401 sin token, 200 con el anon key leyendo Amazon, 405/400 en el resto), y **T5b**
  (`aa90e2f` la migración, `c6ede3b` el endpoint) con cuota por usuario y caché por URL. La cuota se
  consume en **una sola sentencia SQL** y la verificación independiente reprodujo la carrera con su
  propio método; esa verificación además **falsificó una premisa mía**: con `--no-verify-jwt` un
  token inventado que copiaba el `sub` de otra persona fue aceptado y **gastó su cuota**. La
  identidad es verificada solo mientras `supabase/config.toml` diga `verify_jwt = true`, así que eso
  ahora lo vigila un test.
- **L19 (2026-10-18) — la revisión de T5, y el cuarto caso del mismo patrón.** RDD marcó el árbol
  como candidato sin revisar; no había ninguna disposición del propietario dejándolo así, y el
  candidato de rama entera no es revisable (ya medido en L17), así que se revisó **el delta de T5**
  con `baseRef` (`4591448..HEAD`). El proveedor lo clasificó **`tier: high`** por el path
  `auth/jwt.ts`, no por su tamaño. El **refutador** levantó `R3-QUOTA-ZERO-LIMIT` (CRITICAL,
  determinista): `envEntero` exigía `> 0`, así que un `PRODUCT_EXTRACTION_QUOTA_LIMIT=0`
  explícito se convertía en el 30 por defecto —mientras la función SQL rechaza `p_limit <= 0` sin
  tocar la tabla y `decideQuota` con 0 nunca permite—. Un operador que apagaba la extracción recibía
  30 extracciones por usuario **y respuestas 200 con borrador**. Es el cuarto caso del mismo patrón
  de la sesión: **una defensa escrita que pisa en silencio un valor explícito**, y la cuarta vez que
  lo encuentra el paso adversarial.
  Arreglo (`ead975f`): la lectura del entorno sale de `index.ts` —que está fuera del `tsc` y del
  runner, y por eso nadie la podía probar— a `_shared/product-extraction/config/env.ts`, con
  **una regla por perilla** (el límite honra el 0 y lee negativos como 0; la ventana no acepta 0
  porque el SQL la rechaza; el TTL honra el 0 como caché apagada). Rojo observado antes: 30, 30 y
  3600.
  **Lo que hay que saber para la próxima:** el arreglo **agregó ficheros** (`config/env.ts` y su
  test) que no estaban en los caminos congelados del plan de corrección, así que el proveedor ya no
  ofreció la validación dirigida: ofreció **`recover` con `disposition: scope_changed`**. La
  recuperación quedó registrada con la autorización de mantenedor
  (`gentle-ai.review-recovery-authorization/v1`) y creó el linaje sucesor
  `review-df900a6f11e9c1f7`, que revisó el alcance corregido (1313 líneas) y salió **aprobado**
  con las tres lentes y **sin refutador**, autoridad quemada. Corolario práctico: **una corrección
  que se quede dentro de los caminos congelados se ahorra la vuelta de recuperación**.
  Los 10 hallazgos informativos del sucesor coinciden punto por punto con los de la verificación
  independiente (CORS por sufijo `github.io`, `verify_jwt` como única garantía de identidad,
  `fetch` sin timeout, cuota gastada antes de la red, `Retry-After` ausente, caché compartida
  entre usuarios autenticados): dos procesos independientes diciendo lo mismo.

- **L20 (2026-10-19) — T6: la hoja de compartir, construida con el Eje A que la ficha ya tenía
  fijado, y dos decisiones que la medición del navegador obligó a tomar.**
  El recorrido quedó así: la hoja de «Compartir» de Android postea `multipart/form-data` al
  `action` del manifest → el **service worker** lo recibe (ninguna página estática puede
  contestar un POST), guarda `{url, title, text, createdAt}` en Cache Storage, y responde **`303`**
  a `/compartir?share=<id>` → esa ruta lo lee, lo deja pendiente y vuelve a la app → el
  formulario de deseos lo toma al montar, **abre el deseo ya mismo** con el enlace y el título, y
  rellena el resto cuando la extracción de T5 contesta.
  **Decisión 1, `files` fuera del manifest.** La ficha preveía `files: [{accept: "image/*"}]`.
  Se dejó fuera porque aceptar ficheros hace que Android ofrezca la app al compartir una foto
  suelta: el payload traería un fichero que nadie usa y el usuario vería un formulario vacío sin
  saber por qué. La imagen del producto la trae la extracción de la página (S1 habla de webs y
  apps de compras, no de la galería). Un test prohíbe reintroducir la clave sin pensarlo.
  **Decisión 2, dos almacenamientos distintos y cada uno por una razón.** El SW **no** tiene
  acceso al `sessionStorage` de la página, así que el primer salto va en Cache Storage; pero ese
  payload tiene que sobrevivir al login —quien comparte sin sesión iniciada perdería el producto—,
  así que el segundo salto (de la ruta al formulario) va en `sessionStorage`, que muere con la
  pestaña. Toqué el **flujo de login cero**: el pendiente espera a que el usuario entre y recién
  entonces el formulario lo consume y pide la extracción.
  **La caché del compartir va aparte y sin versión a propósito.** `murodeseos-share` no es un
  activo: no se refresca con un despliegue y vive minutos. Como el barrido de `activate` borra
  todo lo que empieza con `murodeseos-`, hubo que excluirla explícitamente o un despliegue en
  medio se comería un compartir a medio abrir.
  **Rojo observado, no declarado.** Los tres tramos (manifest, service worker, ruta+prellenado)
  empezaron con sus tests en rojo: 3 fallos en el manifest, 6 en el service worker (incluidos dos
  tests viejos que fijaban la versión `v5` en el nombre de la caché — ahora la versión se **lee**
  del `sw.js` en vez de repetirse, que era el motivo por el que una subida de versión rompía
  tests ajenos al cambio), 6 de 7 en el prellenado. Las dos reglas que más importan se probaron
  por mutación: con `cache.delete` comentado y con la validación de payload aflojada, **3 tests se
  cayeron**.
  **Un fallo mío, y de los baratos: el lint.** `__tests__/compartir-route.test.tsx` quedó con los
  `import` debajo de los `vi.mock` (3 `import/first`), y como el repo corre `eslint` con
  `--max-warnings 0`, eso es una corrida en rojo. Se corrigió subiendo los imports al tope: el
  `vi.mock` se eleva por encima igual y las variables se leen de forma diferida.
  **Un estado nuevo que el cambio hizo alcanzable, y su límite.** El formulario abierto durante la
  carga de la lista es algo que antes no existía: el «Cargando deseos…» tapaba todo. Al dejar ver
  el modal, la lista de atrás decía «Tu lista está vacía» **sin saberlo** (y con el modal
  transparente del escritorio se leía). Se pinchó con un test en rojo antes de arreglarlo: ahora,
  mientras carga, muestra el indicador y no afirma nada. Queda declarado un efecto cosmético
  menor: en escritorio, esos pocos cientos de milisegundos se ve el fondo del modal en vez de la
  lista.
  **Lo que NO está verificado y no se puede desde acá:** el `share_target` solo lo ofrece Android
  a una **PWA instalada** (Chrome 76+; Firefox y Safari no lo soportan, y por eso iOS queda para
  T8). La verificación real de punta a punta —compartir desde una app de compras en un teléfono y
  ver el deseo creado— **necesita el teléfono del propietario**. Lo que sí se verificó: la suite
  completa (**517 pasan | 1 todo**), `tsc` y `eslint` en 0, y el **build real de la PWA**
  (`expo export` + `postbuild`) con `/compartir` exportada como ruta estática (`EXPORT_EXIT=0`,
  `POSTBUILD_EXIT=0`).
  **Un detalle de tamaño, para que el revisor lo sepa antes de abrir el diff:** el tramo de T6
  son dos commits y ~1.240 líneas autoradas, de las cuales ~820 son tests. Es comparable a lo que
  midió el linaje de T5 (1.313 líneas), así que se deja entero; si el revisor prefiere partirlo,
  el corte natural es `aa776ae` (manifest + service worker) por un lado y `4fd6be4` (ruta +
  prellenado) por el otro.
  **Where**: `public/manifest.json` · `public/sw.js` · `app/compartir/index.tsx` ·
  `lib/share-target.ts` · `lib/share-draft.ts` · `lib/extract-product-client.ts` ·
  `components/WishListTab.tsx` · `__tests__/{manifest,sw,share-target,share-draft,extract-product-client,compartir-route,wish-share-prefill}.test.*`.
  Commits `aa776ae` y `4fd6be4`.
  **Disposición del RDD sobre este corte**: `assess` con `baseRef 7da81af` (committedOnly) devolvió
  **riesgo medium / `reviewDue: false`** (`under_budget`) y **ningún** ítem de riesgo alto
  escalado, así que **no se arrancó ninguna revisión nativa**: el plan es la verificación del
  propio escritor, y la revisión nativa es una mirada externa que no reemplaza la verificación.
  Lo que sí corresponde y **quedó sin hacer por falta de entorno**: el e2e de Playwright (Docker
  apagado) y la prueba en un teléfono con la PWA instalada, que necesita al propietario.

## Verificación

- **T1**: `__tests__/product-extraction/fixture-capture.test.ts` en verde (9 tests):
  decodificación por `charset` (windows-1252 y caída a UTF-8), resolución de la URL descubierta
  (relativa, absoluta, sin coincidencia y rechazo de esquemas que no sean http(s)), headers de
  navegador e integridad de la lista de semillas.
- **T2 (núcleo)**: `__tests__/product-extraction/` en verde (51 tests) y la suite completa en 336,
  con `pnpm typecheck` y `pnpm lint` limpios. Cubre los 9 fixtures reales con verificación de
  `sha256`, los cinco testigos negativos y los casos sintéticos que los fixtures no traen.
- **Defecto encontrado en la verificación del núcleo y corregido**: la capa heurística de imagen
  devolvía una miniatura de reseña de 154×154 como foto del producto; está eliminada y el motivo
  medido queda pinchado en un test (ver L12).
- **T3**: 61 tests del directorio, 346 en la suite, `pnpm typecheck` y `pnpm lint` limpios.
  **Verificación independiente** (agente aparte, sin acceso de escritura), 6 de 6 PASS, con
  **prueba de mutación**: al desactivar el adaptador fallan 4 tests, así que no pasan por el
  fallback de la cascada. Diferencial base-vs-cambio sobre los 9 fixtures: solo cambia `amazon-es`
  (título, precio, imagen). Los `sha256` de los 9 fixtures coinciden con el manifiesto. Lockfile:
  77 líneas añadidas, **cero** eliminadas.
- **Riesgo declarado de T3: item 5 (dependencia nueva).** Verificación independiente hecha, según
  la regla. Lo que la verificación **no** pudo probar: si el runtime de Deno resuelve el specifier
  sin `npm:` — ver el riesgo abierto abajo.
- **Corregido en la verificación de T3:** la regla de host reclamaba `amazon.es.evil.com`. Apretada
  a `amazon.<2-3 letras>` con a lo sumo un sufijo más, con RED observado en ese caso exacto antes
  de tocarla.
- **T4**: 129 tests del directorio, 414 en la suite, typecheck y lint limpios. **Verificación
  independiente adversaria**: encontró un bypass SSRF real (direcciones IPv6 de transición
  —NAT64 `64:ff9b::/96`, 6to4 `2002::/16`, Teredo `2001:0::/32`, IPv4 traducida y compatible—
  que llegaban a `169.254.169.254`); se arregló clasificando la **IPv4 embebida**; una
  re-auditoría del fix dio PASS (los `reason` de los 10 casos previos no cambiaron y las formas
  de transición con IPv4 pública siguen pasando).
- **Riesgo declarado de T4: item 2 (seguridad).** Verificación independiente **adversaria** dos
  veces (la que encontró el bypass y la del fix), con prueba de mutación en las dos.
- **Revisiones nativas por tramo (L17).** T4 `review-cade8da5617863c2`, T3
  `review-ea4ddb650dd3ab9f` y T1 `review-e753e0e4cff75cc8`: **aprobados**, autoridad quemada. T2
  `review-c92b4c397ebaf358` quedó **escalated** (`native_stop_required`) porque el validador rechazó
  la primera corrección por una regresión, y se cerró con un linaje nuevo sobre el corte ya
  corregido: `review-8c7a8fb9eef5bcd3`, **aprobado** tras corregir `R4-001`. Tres CRITICAL, los tres
  encontrados por el refutador; el refutador también **refutó** un CRITICAL de la lente de riesgo.
- **T5a** (`90ac8a8`): medido en el runtime real — 401 sin cabecera `Authorization` (lo corta la
  plataforma antes del handler), 200 con el `ANON_KEY` del stack local leyendo Amazon (`89,99 EUR`),
  `{ok:false}` con `dns-failed` y con `blocked-ip-loopback`, 405 y 400 en el resto. 5 tests del
  resolvedor puro (fallo cerrado) y la suite en verde.
- **T5b** (`aa90e2f`, `c6ede3b`): migración aplicada **solo en local** con `supabase migration up`;
  RLS comprobado por `psql` (`relrowsecurity=t`, cero políticas, `relacl` solo para `postgres` y
  `service_role`) y la función `security definer` con `search_path` fijado. **Verificación
  independiente: 6 de 6 PASS, 0 blockers**, con métodos propios — 12 llamadas paralelas contra
  `limit=2` dieron exactamente 2 permitidas; RLS probado con el rol `anon` y con un JWT de usuario
  real; la clave de caché probada sobre el módulo real. **Riesgo declarado: items 1 (migración) y 2
  (permisos).**

## Hallazgos informativos

- **`pccomponentes-es` no se pudo congelar** (403 a undici con los mismos headers con los que
  `curl` lo abría). El fingerprint TLS es independiente de los headers y la capa de red de T4 no
  lo cambia: sigue pendiente de medir qué alcanza la Edge Function real (T5).
- **`mercadolibre-ar` y `tiendanimal-es` fallan en el descubrimiento** (patrón sin coincidencia)
  y **`nutritienda-es` da 403 en el listado**: semillas a ajustar cuando T3 evalúe adaptadores.
- **`description` sale de Open Graph y la heurística queda de respaldo**: Open Graph corre antes y
  lee `name="description"`, así que la capa heurística casi nunca la usa. No es un defecto (mismo
  valor, mejor procedencia), pero conviene saberlo al leer los `source` de los fixtures.
- **AliExpress declara menos de lo que suponíamos**: su único JSON-LD es un `WebSite` con
  `SearchAction`, sin `Product` ni precio; lo legible sale de Open Graph. Candidato a adaptador si el
  volumen lo justifica.
- **`extract/html.ts` promete «`parseHtml` nunca tira» y esa garantía la da el `intentar` de
  `extract/index.ts`, no el módulo.** Es cierto en el uso real, pero la promesa está escrita un
  nivel más arriba. Hallazgo del verificador independiente, no bloqueante.
- **`selectAll` se exporta y hoy no lo usa nadie** (utilidad para los próximos adaptadores).
- **La regla de host del adaptador no concede confianza hoy**, pero si alguien la reusa para decidir
  permisos o claves de caché, ya está apretada (ver L15).
- **Hallazgos de la re-auditoría del fix SSRF, sin explotabilidad demostrada**: ISATAP bajo un
  prefijo enrutable (`2001:db8::5efe:127.0.0.1`) y prefijos NAT64 no estándar no se clasifican;
  el rebinding entre la comprobación del resolvedor y la conexión real (`fetch` vuelve a resolver)
  sigue sin cubrir; `safeFetch` decodifica el cuerpo solo como UTF-8 (una página en latin-1 sale
  con acentos rotos — el capturador sí honra el `charset`, el runtime lo verá en T5); y un
  `fetchImpl` inyectado que ignora la `AbortSignal` hace que el timeout no corte (los `fetch`
  reales de undici/Deno sí la honran).

## Riesgos abiertos

- **Las dos incógnitas de T5 quedaron resueltas por medición (L18)**, no por suposición: el mapa de
  imports de Deno resuelve `node-html-parser` sin tocar el import compartido, y el runtime alcanza
  Amazon y PcComponentes con 200. **No medido**: si ese mapa es *necesario* o el bundler resolvería
  igual contra `node_modules` (queda declarado, sin afirmarlo).
- **`verify_jwt` es lo único que hace que la identidad esté verificada.** `_shared/product-extraction/auth/jwt.ts`
  decodifica el `sub` de un token que **no** verifica: con `--no-verify-jwt` un token inventado fue
  aceptado y gastó la cuota de otra persona. La configuración commiteada es correcta y hay un test
  que la vigila; el riesgo es operativo (un despliegue al que se le pierda la configuración).
- **Advisories de T5 declarados, sin arreglar aquí**: el `429` no lleva cabecera `Retry-After`
  (sí `retryAfterSeconds` en el JSON); los `fetch` a PostgREST no llevan timeout, así que un
  PostgREST colgado cuelga la petición; y la caché está indexada **solo por URL**, así que cualquier
  usuario autenticado recibe el borrador cacheado de otro sin gastar cuota (deliberado, declarado en
  la migración).
- **Informativos de la revisión sin abordar**: 8 de T1 (escritura no atómica del fixture, lectura del
  descubrimiento sin tope, degradación del manifiesto) y 5 de T2 (entre ellos que `detectCurrency`
  acepta cualquier valor declarado de tres letras como moneda, sin validar ISO 4217).
- **Arrastrados de T4**: el rebinding entre la comprobación del DNS y la conexión real sigue sin
  cubrirse; `safeFetch` decodifica solo UTF-8, así que una página latin-1 queda con mojibake — y
  desde T5b eso se cachea durante el TTL.
- **De la migración de T5b**: está aplicada **solo en local**; el proyecto remoto no la tiene hasta
  que el propietario decida el `db push`.
- **T6 no está probado en un teléfono.** El `share_target` solo lo ofrece Android a una PWA
  **instalada** (Chrome 76+; Firefox y Safari no lo soportan: iOS queda para T8). Lo verificado acá
  es el contrato (manifest, service worker y ruta), la suite y el build; el recorrido real
  —compartir desde una app de compras y ver el deseo creado— lo tiene que hacer el propietario en
  su móvil. Mientras eso no pase, **T6 está cerrado en código, no en producción**.
- **El `sw.js` sirve activos de toda la app**, así que un error en él no rompe el compartir: rompe
  la app entera (es la historia de la pantalla negra). El tramo de T6 solo **agrega** una rama para
  `POST` y excluye una caché del barrido: el camino `GET` no cambió una línea, y eso lo vigilan los
  tests que ya existían.
- **Cosmético, declarado en L20**: en escritorio, mientras la lista carga y el formulario de un
  compartir está abierto, se ve el fondo del modal en lugar de la lista.
- **Privacidad, menor y aceptada**: el compartir vive en `sessionStorage` hasta que el formulario
  lo consume, y el `sessionStorage` no distingue usuarios. Si en el mismo dispositivo y la misma
  pestaña una persona comparte sin iniciar sesión y **después** entra otra, la segunda vería el
  formulario con el enlace de la primera. La caché del service worker **sí** se vacía al cerrar
  sesión (`signOut` borra todo `murodeseos-*`), así que el camino que queda es el de la pestaña
  abierta sin sesión. Lo que se filtra es una URL que se compartió en ese mismo dispositivo, no
  datos de la cuenta.

## Commits

- `5c1fcc3` — test(fixtures): capture real product pages for offline extraction tests (T1).
- `d89de4d` — fix(fixtures): refuse an empty --only instead of capturing every shop (T1, `R3-only-empty-filter`).
- `5c9fc65` — feat(extraction): read product prices from a product page (T2).
- `8bfde52` — feat(extraction): extract product data in a tiered cascade (T2).
- `beb0e0b` — fix(extraction): stop fabricating a price from a whole text node (T2, `R4-FABRICATED-PRICE`).
- `1e9b7c4` — fix(extraction): keep reading the spaced ISO currency code (T2, regresión que rechazó el validador).
- `4d4df8a` — fix(extraction): require a complete ISO code next to the price (T2, `R4-001`).
- `c54a666` — feat(extraction): adapt Amazon product pages with a host adapter (T3).
- `c0ae2e3` — feat(extraction): fetch product pages safely behind an SSRF guard (T4).
- `b83d313` / `1bf2934` / `4591448` — docs(odd): cierres y evidencia medida de T1-T4.
- `9d0a4ef` — test(extraction): align the cascade test with the token-based heuristic raw.
- `90ac8a8` — feat(functions): serve product extraction from an authenticated edge function (T5a).
- `aa90e2f` — feat(db): store product extraction quota and cache (T5b).
- `aa776ae` — feat(pwa): receive the Android share target in the service worker (T6).
- `4fd6be4` — feat(pwa): open the wish form from a shared product (T6).
