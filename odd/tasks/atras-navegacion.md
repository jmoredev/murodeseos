# El gesto de atrás saca de la app (`fix/atras-navegacion`)

**Abierta:** 2026-10-09 · **Rama:** `fix/atras-navegacion` (desde `main`, `af691c2`) · **Estado:** hecho y verificado; pendiente la revisión nativa y la PR

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

## Commits

- _(A1+A2, pendiente de commit)_
