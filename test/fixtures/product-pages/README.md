# Fixtures de páginas de producto

Páginas reales congeladas para probar la extracción **sin red**. Las genera
`scripts/capture-product-fixtures.ts`; **no se editan a mano**.

## Formato

- **`<id>.html.gz`** — la página **completa**, comprimida con gzip. El test la descomprime con
  `gunzipSync` (`node:zlib`) y la lee como texto UTF-8.
- **`manifest.json`** — un registro por fixture: `id`, `shop`, `url` (la semilla pedida),
  `finalUrl` (tras redirecciones y descubrimiento), `status`, `ok`, `bytes`, `sha256`,
  `charset` y `failure`.

## Reglas

1. **Entera, no recortada.** Recortar el `<head>` perdería los JSON-LD que muchas tiendas
   escriben al final del `<body>`, que es justo lo que la cascada lee.
2. **`ok` significa «se congeló un fixture», no «la página sirvió».** Un 403 de Cloudflare y
   una cáscara de SPA se congelan a propósito: son testigos negativos del comportamiento que
   hay que aguantar, y cada uno tiene que estar cubierto por al menos un test.
3. **El `sha256` es de los bytes antes de comprimir.** Descomprimir el `.html.gz` y hashear
   debe dar ese valor: así se detecta un fixture tocado a mano.
4. **Los tests no tocan la red.** Si un test necesita una página nueva, se captura, se commitea
   el `.html.gz` y se agrega al manifiesto.

## Cómo recapturar

```bash
npx tsx scripts/capture-product-fixtures.ts                    # todas las semillas
npx tsx scripts/capture-product-fixtures.ts --only=zara-es     # una o varias
npx tsx scripts/capture-product-fixtures.ts --max-bytes=8000000 --delay-ms=1500
```

La captura hace **una** petición por semilla, con pausa y sin reintentos. Una corrida parcial
no borra lo ya capturado: el manifiesto se fusiona por `id`. No corre en CI.

## Qué garantiza y qué no

Un fixture es la foto de un día. Un test que pasa contra él **no** prueba que la tienda siga
igual: prueba que nuestra extracción es correcta para ese HTML concreto. Vigilar que la tienda
cambió es trabajo de la telemetría por dominio, no de esta carpeta.
