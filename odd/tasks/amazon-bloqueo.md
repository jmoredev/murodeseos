# Amazon dejó de extraer el precio (interstitial con status 200)

**Abierta:** 2026-10-24 · **Rama:** trabajo local, sin commit · **Estado:** implementado y verificado
**Decisión del propietario (2026-10-24):** el síntoma «Amazon ya no saca precios» se arregla
reconociendo el interstitial como muro y pidiendo la ficha móvil **antes** de gastar un crédito.
Los enlaces que fallan son de «amazon.eu», que **no es una tienda**.

## Specs

- **S1 — reconocer el interstitial de Amazon como bloqueo, no como página.** Llega con `200`, así que
  ni el status ni `cf-mitigated` lo delatan: solo el cuerpo. `detectBlock` tiene que devolver
  `{ blocked: true, reason: 'blocked-by-site' }`.
- **S2 — dos marcas, como las otras firmas.** Una frase sola no marca un muro: una ficha legítima
  puede citarla. Firma = «click the button below to continue shopping» **y**
  «errors_page/validateCaptcha».
- **S3 — la evidencia se congela.** Fixture real `amazon-interstitial` con su entrada de manifiesto,
  más un test de que la ficha buena de Amazon (`amazon-es`) sigue pasando.
- **S4 — un solo intento extra, y solo para Amazon.** Antes de gastar créditos de Firecrawl: si el
  camino directo topó con un muro o con una página sin precio ni imagen, y la ruta lleva un ASIN
  (`/dp/`, `/gp/product/`, `/gp/aw/d/`), se pide **una vez** `https://www.amazon.<tld>/gp/aw/d/<ASIN>`
  por el mismo `guardUrl` + `safeFetch` y se fusiona sin perder nada.
- **S5 — nada de `amazon.eu`.** Responde `302` a `https://www.aboutamazon.eu/`: no es una tienda.
  Cuando el propietario dice «amazon.eu» se refiere a las tiendas europeas (`.es`, `.de`, `.fr`, `.it`).

## Medición (2026-10-24, antes de escribir el arreglo)

Headers de `buildBrowserHeaders()`. Una petición por URL salvo donde se dice.

| URL | status | bytes | ¿interstitial? | `#productTitle` | `#corePrice_feature_div` | `.a-offscreen` | `#landingImage` | precio leído |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `www.amazon.com/dp/B0D1XD1ZV3` (escritorio) | 200 | 3 781 | **sí** | 0 | 0 | 0 | 0 | — (borrador titulado «Amazon.com», sin imagen) |
| `www.amazon.es/gp/aw/d/B09B8X9RGM` (móvil) | 200 | 2 217 408 | no | 1 | 2 | 8 | 1 | **89,99 EUR** |
| `www.amazon.es/gp/aw/d/B09B8RF4PY` (móvil) | 200 | 2 218 991 | no | 1 | 2 | 8 | 1 | **89,99 EUR** |
| `www.amazon.de/gp/aw/d/B0HJ258W1G` (móvil, ASIN sacado de `/s?k=echo+dot`) | 200 | 860 860 | no | 1 | 0 | 1 | 1 | — (`#corePrice_desktop` **vacío**, el cuerpo trae `"isRobot":true`) |
| `www.amazon.com/gp/aw/d/B0D1XD1ZV3` (móvil, comprobación extra) | 200 | 786 867 | no | 1 | 0 | 0 | 1 | — (`#outOfStockBuyBox_feature_div`: no hay oferta que leer) |

**Veredicto de la ficha móvil:** en `amazon.es` sirve el precio (2 de 2 ASIN, 89,99 EUR, con título e
imagen); en `.com` y `.de` la móvil **sí es una página** —título real e imagen, nada que ver con el
interstitial— pero la respuesta que recibí no traía oferta, así que no hay precio que leer. Con eso,
S4 se implementa: el intento móvil como mínimo cambia «deseo titulado Amazon.com sin nada» por la
ficha real, y en el locale del propietario recupera el precio.

**Hallazgo que se quedó fuera (a propósito).** El buscador de `amazon.de` contestó **una vez** un
segundo interstitial, de 2 222 bytes, `<title>&nbsp;</title>`, meta-refresh a `?bm-verify=…` y
`xhr.open("POST", "/_sec/verify?provider=interstitial")` (Akamai Bot Manager). Y el fixture que el
repo ya tiene como testigo negativo, `zara-es` (2 139 bytes), **es ese mismo interstitial**: no es
una cáscara de SPA. La firma sería «`/_sec/verify?provider=interstitial`» + «`bm-verify`», pero no es
específica de Amazon y obliga a reclasificar `zara-es`, así que no entra en este arreglo.

## Tasks

| # | Tarea | Specs |
| --- | --- | --- |
| T1 | Medir la ficha móvil por locale (la tabla de arriba) | S4 |
| T2 | Firma de Amazon en `net/detect-block.ts` + fixture `amazon-interstitial` y su entrada de manifiesto | S1, S2, S3 |
| T3 | Tests de detección: interstitial bloqueado, `amazon-es` no bloqueado, `safeFetch` end-to-end, y los 200 del manifiesto | S1, S3 |
| T4 | `mobile/decision.ts`: ASIN de la ruta, URL móvil y cuándo se intenta (puro) | S4, S5 |
| T5 | `mobile/attempt.ts`: el intento con `safeFetch` inyectable y el mismo `extractProduct` | S4 |
| T6 | Cableado en `extract-product/index.ts`: móvil antes del respaldo, fusión sin pérdida | S4 |
| T7 | Verificación: `pnpm run test:unit`, `npx tsc --noEmit` | S1 |

## Log

- **L1 (2026-10-24) — diagnóstico heredado, no repetido:** el interstitial llega 6 de 6 veces con 4
  juegos de headers distintos, `cf-mitigated: null`, y el respaldo de Firecrawl devuelve esa misma
  página sin precio (cero apariciones de `89,99`). El escritorio de `amazon.es` seguía sirviendo la
  ficha; el de `amazon.com`, no.

- **L2 (2026-10-24) — medición de la móvil (T1).** La tabla de arriba. Se gastaron 1 petición en
  `amazon.com` escritorio, 2 en `amazon.es` móvil, 1 en `amazon.de` buscador + 1 en `.de` móvil y 1
  en `.com` móvil; más 5 peticiones de sondeo en `.de` para caracterizar la variante de 2 222 bytes.
  **Cero créditos de Firecrawl.**

- **L3 (2026-10-24) — decisión: la firma necesita el formulario, no solo la frase.** El cuerpo real
  trae `<h4>Click the button below to continue shopping</h4>` y
  `action="/errors_page/validateCaptcha"`; el fixture `amazon-es` (ficha real de 2,26 MB) no trae
  ninguna de las dos, así que la firma no se come una página buena.

- **L4 (2026-10-24) — decisión: la móvil entra como respaldo, no como reemplazo.** Se reutiliza
  `mergeFallbackDraft(directo, móvil)`: el borrador móvil gana donde trae algo y el directo cubre los
  huecos, así que un precio ya leído nunca se pierde. Y si la móvil dio una página, `needsFallback`
  juzga **esa** página: no se paga un crédito por un dato que ya está leído.

- **L5 (2026-10-24) — verificado en local.** `pnpm run test:unit`: 71 archivos, 737 tests en verde
  (1 `todo`). `npx tsc --noEmit`: sin salida. Los tests nuevos se vieron fallar antes del arreglo: el
  interstitial daba `{ blocked: false }`, `safeFetch` lo entregaba como cuerpo (`ok: true`) y el
  módulo `mobile/` no existía (import sin resolver).

## Lo que queda sin verificar

- **El camino completo en el runtime.** El contenedor de Edge Functions está parado a propósito: no
  se ha llamado a la función con un enlace real de Amazon. Lo que está probado es la detección, la
  decisión y el intento móvil por separado.
- **Precio móvil en `.de`, `.fr` e `.it`.** En el único ASIN de `.de` que medí la respuesta venía
  marcada como robot y sin bloque de oferta. No es un resultado general: hace falta medirlo con
  ofertas reales antes de prometer que la móvil arregla esos locales.
- **Prevalencia del interstitial.** La misma URL de `.de` devolvió el interstitial de Akamai una vez y
  la página completa varias veces después. Cuándo aparece sigue sin medirse.
- **El interstitial de Akamai** (arriba) no está cubierto: hoy sigue leyéndose como página, tanto en
  Amazon como en `zara-es`. Es la deuda más grande que deja esta ficha.
- **Firecrawl en este flujo.** No se gastó ningún crédito, así que no se comprobó qué habría
  devuelto; el cambio de disparador (juzgar la página móvil en vez del fallo de transporte) no se ha
  medido contra el proveedor.
