# El gesto de atrás saca de la app (`fix/atras-navegacion`)

**Abierta:** 2026-10-09 · **Rama:** `fix/atras-navegacion` (desde `main`, `af691c2`) · **Estado:** cerrado — implementado, verificado, **revisión nativa aprobada** y autoridad quemada; pendiente el PR

## Objetivo

Que el **gesto de atrás** de Android haga lo que cualquiera espera dentro de la PWA —**cerrar lo que acabas de abrir**— en vez de sacarte de la aplicación. Y que, pase lo que pase, la app **nunca** se quede en un vacío sin explicación.

## Cómo se llegó aquí (y por qué el diagnóstico anterior no bastaba)

El propietario reportó pantalla negra permanente con el gesto de atrás. La primera investigación concluyó que venía del **service worker** sirviendo una cáscara cacheada cuyo bundle el despliegue había borrado; se arregló y se publicó (`v2026.10.09`, worker `v5`). **El síntoma siguió.** Entonces se pidieron cuatro datos al propietario, y los cuatro, juntos, descartaron el diagnóstico anterior:

| Lo que dijo | Lo que descarta |
| --- | --- |
| **Sólo en la app instalada** | No es lógica de la app: eso fallaría igual en una pestaña |
| **Sólo con el gesto**, no con la flecha de dentro | El gesto es **historial del navegador**; la flecha es navegación de la app |
| **Nada de nada de texto** | No son las pantallas negras de `expo-router`: esas **sí pintan texto blanco** |
| En pestaña normal, la misma secuencia **«se me sale de la página»** | **El gesto no actúa dentro de la app: sale de ella** |

Ese cuarto dato es el que lo cerró.

## El mecanismo, con el código delante

1. **Abrir un artículo tuyo no es una ruta: es un modal.** En la lista propia, la tarjeta llama a `openForm` (`components/WishListTab.tsx:129`, `:362`) y lo que se abre es un `Modal` de React Native. **No añade entrada de historial.**
2. **El perfil tampoco es una ruta**: es la misma pantalla con `?tab=profile`, y el cambio de pestaña es **estado de React**, no navegación (`app/index.tsx:45`, `components/ResponsiveLayout.tsx:105,163,169`). **Tampoco añade historial.**
3. **Los dos sitios que gestionan el atrás lo desactivan en web**, a propósito y con el motivo escrito: `components/WishListTab.tsx:48-50` y `components/WishDetailModal.tsx:46-48` hacen `if (Platform.OS === 'web' …) return undefined;` con el comentario «`BackHandler` no existe en web».

Consecuencia: **el gesto no tiene nada de la app que deshacer**, así que se come la entrada anterior del historial, que está **fuera** de la aplicación.

Y eso se ve distinto según dónde estés:

| Dónde | Qué ocurre |
| --- | --- |
| **Pestaña normal** | Te saca de la página: ves a dónde vas (lo que reportó el propietario) |
| **Acceso directo a pantalla completa** | No hay nada antes y **no hay barra de direcciones** con la que volver. Queda una ventana sin documento → **el negro sin una letra** |

**Por qué «sin una letra» y no la pantalla de error del router**: la app **no exporta ningún `ErrorBoundary`** (verificado: cero coincidencias en `app/`, `components/` y `lib/`). Si la ruta en la que cae el historial no se puede resolver, React se desmonta y **no queda nada que pintar**. Ese es un defecto por sí mismo: hoy **cualquier** fallo de render deja una pantalla vacía y sin salida.

**Y explica por qué el arreglo anterior no funcionó**: el commit `549f2ba` («evitar pantalla gris al volver») usó `BackHandler` y `gestureEnabled`, que son mecanismos **nativos**. Lo que se entrega es **web**, donde `BackHandler` no dispara y `gestureEnabled` no aplica.

## Decisión de producto (propietario, 2026-10-09)

**El gesto cierra modales; no recorre pestañas.** Si no hay nada abierto y estás en la raíz, el gesto sale de la app, que es el comportamiento estándar. Se descarta que el gesto vaya moviéndose entre deseos → grupos → perfil: sería más historial que gestionar y no es lo que hace la mayoría.

## Unidades de trabajo

| # | Tarea | Estado |
| --- | --- | --- |
| A1 | **Que el gesto cierre lo que abriste**: al abrir un modal, empujar una entrada de historial y cerrarlo al recibir `popstate`; al cerrarlo por la UI, retirar esa entrada para no dejar un hueco | **hecha** — `lib/use-back-to-close.ts`, aplicado a `components/WishDetailModal.tsx` y `components/WishListTab.tsx` (en este último respetando `isSaving`, igual que la ✕ y el atrás nativo) |
| A2 | **Test en rojo primero**, con el historial simulado: abrir empuja; el gesto cierra; cerrar con la ✕ no deja basura en el historial | **hecha** — `__tests__/use-back-to-close.test.tsx`, 5 casos. **Vistos fallando antes**: el módulo no existía. Incluye el caso que rompe este patrón: re-renderizar con el callback en línea **no** empuja otra entrada (por eso el callback vive en una ref) |
| B1 | **`ErrorBoundary` de verdad**, exportado donde `expo-router` lo recoge, con pantalla legible y botón de recarga que **no dependa de las fuentes** | **hecha** — `components/AppErrorBoundary.tsx` + el **export nombrado `ErrorBoundary`** en `app/_layout.tsx`, que es lo que `expo-router` busca en el módulo de ruta (sin ese export, el componente sería código muerto). Tres tests. La pantalla fija una **pila del sistema** a propósito: si el error ocurre antes de que carguen las fuentes —o son ellas la causa—, una pantalla de error con texto invisible sería el mismo vacío con más pasos |
| B2 | Que un atrás que no resuelve **no** deje la app en la nada | **cubierto por B1, y se dice por qué**: cuando el historial cae en una ruta irresoluble, `expo-router` acaba con un estado **sin rutas** y ahí lanzaba, desmontando el árbol entero. Con el `ErrorBoundary` exportado eso ya no deja un vacío: se ve una pantalla legible con **dos salidas** (reintentar y recargar). Interceptar el `resetRoot` interno del router **no se puede desde la app**, así que no se finge que se hace |
| C | Verificación (estáticos, unit, E2E con resiembra y `--workers=1`), verificación independiente y revisión nativa | **verificación hecha**; verificación independiente y revisión nativa pendientes |

## Verificación (2026-10-09)

**Un E2E nuevo que reproduce el fallo, y se le vio fallar.** En `e2e/responsive-wishlist.spec.ts`: abrir el detalle de un deseo, pulsar atrás y exigir que **el detalle se cierre y la URL no cambie**.

**RED, con el hook desconectado a propósito** — y el mensaje es literalmente el síntoma del propietario:

```
Expected: "…/wishlist/2f144dd7-…?name=Juan%20Perez"
Received: "…/groups/E2E001"
```

O sea: sin el arreglo, el atrás **se lleva la pantalla a otra ruta**. En una pestaña eso es «se me sale de la página»; con la app instalada y sin barra de direcciones, la ventana negra.

**GREEN con el arreglo.** Detalle de fidelidad: el test usa `history.back()` **desde la página** en vez de `page.goBack()`, porque el gesto es un `popstate` **en el mismo documento** y `page.goBack` espera una navegación de documento que aquí no ocurre.

| Comprobación | Resultado |
| --- | --- |
| `pnpm run typecheck` | limpio |
| `pnpm run lint` (`--max-warnings 0`) | limpio |
| `pnpm run test:unit` | **257 passed + 1 todo** (los 5 del hook y los 3 del boundary) |
| E2E chromium, **resiembra y `--workers=1`** | **54 passed / 1 skipped** (línea base 53 + el test nuevo) |
| El E2E nuevo, **visto fallar** sin el hook | sí, con la URL saltando a otra ruta |

## Restricciones

- **No se cambia la navegación existente**: los `router.push`/`replace` que ya funcionan se quedan como están. La unidad A **sólo** añade historial para los modales.
- **En nativo no se toca nada**: `BackHandler` sigue igual. Todo lo nuevo va detrás de `Platform.OS === 'web'`.
- El comportamiento en una pestaña normal debe seguir siendo coherente (ahí el gesto también cierra el modal, no saca de la página).
- Nada de efectos silenciosos: si el gesto cambia de comportamiento, se dice en la ficha y en la PR.

## Verificación

- `pnpm run typecheck`, `pnpm run lint` (`--max-warnings 0`), `pnpm run test:unit`.
- **Los tests nuevos vistos fallando antes** del arreglo.
- E2E con **resiembra y `--workers=1`**.
- **Y a mano en el navegador**, que es el único sitio donde se puede comprobar de verdad: abrir un artículo, pulsar atrás, y comprobar que cierra el modal **sin salir** de la app.

## Revisión nativa (2026-10-09)

Linaje **`review-74ff5ecfc5b7fb00`**: riesgo medio, 1 lente (`review-reliability`), 9 ficheros / 730 líneas → **aprobada** y autoridad **quemada**. Dos hallazgos advisory, ambos informativos y ninguno bloqueante: `R3-001` en `components/AppErrorBoundary.tsx:37-43` y `R3-002` en `lib/use-back-to-close.ts:111-119`.

**Pero llegar aquí costó tres CRITICAL, todos reales y todos míos.** Los dos primeros los encontró la lente y el tercero **el refutador**, y los tres están arreglados:

| ID | Quién | Defecto | Arreglo |
| --- | --- | --- | --- |
| `R3-001` | lente | Cada instancia añadía su `popstate`, así que **un gesto cerraba todos los modales abiertos**; y cerrar uno con la ✕ lanzaba un `history.back()` cuyo `popstate` cerraba el otro | Una entrada para toda la capa, **un solo escuchador por gesto** —comparando el **objeto de evento**, idéntico para todos los escuchadores: sin banderas ni temporizadores— y reposición de la entrada mientras quede capa |
| `R3-002` | lente | Con `isSaving`, el callback no cerraba pero el gesto se daba por consumido y su limpieza no reponía la entrada → **el siguiente atrás salía de la app**, anulando el arreglo justo al guardar | El invariante «mientras haya capa, hay entrada» la repone. La decisión se difiere un turno porque **React aplica el cierre de forma asíncrona** |
| `R3-001` | **refutador** | El `history.back()` de la limpieza es **asíncrono e indistinguible** de un gesto del usuario: si se abría otro modal antes de que llegara su `popstate`, lo **cerraba solo** | **Se elimina el back interno.** La carrera deja de ser improbable y pasa a ser **imposible por construcción** |

**Dos correcciones de diseño que forzaron los tests**, y merecen quedar escritas porque las dos eran trampas:

1. **El estado del módulo ya no recuerda si la entrada era nuestra** en un booleano. Ese booleano **se queda obsoleto en cuanto el router navega** (empuja su propia entrada y la nuestra deja de estar arriba), así que la capa creía tener paso cuando no lo tenía. Ahora **se pregunta al historial**, que es la única fuente de verdad de lo que hay en el historial. Lo destapó una fuga de estado entre tests, no una lectura del código.
2. **El arnés mentía sobre la plataforma**: despachaba el `popstate` sin consumir antes la entrada. Ahora simula el gesto como lo hace el navegador (consume la entrada, después el evento). Un arnés que no reproduce el orden real no prueba el comportamiento real.

**Coste aceptado y documentado**: cerrar un modal con la ✕ deja la entrada «gastada», así que un toque de atrás posterior no hace nada. Se cambia por que la carrera sea imposible.

### Dos defectos de la fontanería de revisión, no del código

- **El plan de corrección se envía ANTES de aplicar la corrección.** Enviado después, el proveedor lo rechaza (`capture-binding-rejected`, «no lleva un linaje y un objetivo válidos»), porque el árbol avanzó y el `target_identity` del binding ya no coincide con el actual. Probarlo al revés cuesta dos operaciones reversibles y **no se arregla retrocediendo el árbol de trabajo**: el proveedor **proyecta desde HEAD**. Con el orden correcto, el plan se aceptó a la primera.
- **La validación dirigida rechaza su propio binding.** Con el plan aceptado y la corrección commiteada, STATUS pide `targeted_validation_required`, y ese binding —copia exacta del del proveedor— se rechaza con «collectBinding is missing or stale for current STATUS» **sin que el STATUS cambie entre intentos**. Pasó en dos linajes distintos. No se manipulan tokens del proveedor para sortearlo: se declara.

**Vía que sí funcionó, y está declarada como rodeo**: `inspect` volvió a ofrecer `review.start` sobre el candidato ya corregido, y una **revisión nueva** corrió entera (lente → refutador → aprobada). Los dos linajes anteriores quedan en `correction_required`: **es deuda de mantenimiento, no un corte sin revisar**, y así está dicho.

## Commits

- **`49ab916`** — `fix(pwa): the back gesture closes what you opened, instead of leaving the app` (A1+A2).
- **`20c3e1c`** — `fix(pwa): never leave a blank void, and prove the back gesture in CI` (B1+B2+E2E).
- **`ee430d9`** — `fix(pwa): coordinate the modal layer, and restore the entry when a close cannot happen` (corrección de los dos CRITICAL de la lente).
- **`f3c3842`** — `fix(pwa): remove the internal history back, so the race cannot exist` (corrección del CRITICAL del refutador).
