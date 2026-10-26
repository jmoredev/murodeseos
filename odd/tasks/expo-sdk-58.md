# Subir Expo del SDK 54 al SDK 58

Frente abierto el 2026-10-26, **no empezado**. La app está en **Expo SDK 54** y el SDK publicado más
reciente es el **58**. Este documento existe para que el salto no se confunda con la alineación de
dependencias (que ya se hizo: ver «Contexto»).

**Estado:** sin implementar. **Rama:** ninguna todavía. **Decisión del propietario:** subirlo como
frente propio, no dentro de la publicación del 2026-10-26.

## Specs

S1 — Subir la app al SDK más reciente de Expo:

> «También creo que hay una versión de expo más reciente que es la 58: https://docs.expo.dev/versions/latest/»

S2 — Tratarlo como frente propio, con su ficha, en lugar de mezclarlo con la alineación de
dependencias del SDK 54:

> «Alinear a SDK 54 ahora y dejar el salto a 58 como frente propio»

## Contexto medido (2026-10-26)

| Paquete | Instalado | `latest` en el registro |
| --- | --- | --- |
| `expo` | **54.0.37** (declarado `^54.0.33`) | **58.0.19** (`latest`); `sdk-57` = 57.0.31 |
| `react-native` | **0.81.5** | **0.88.0** |
| `react` / `react-dom` | 19.1.0 | — |
| `eslint-config-expo` | `~10.0.0` (config del SDK 54) | 58.0.4 |
| `react-native-safe-area-context` | `~5.6.0` (5.6.2) | — |
| `nativewind` | `^4.0.0-rc.3` | — |
| `react-native-css-interop` | `^0.2.1` | — |
| `react-native-reanimated` | `~4.1.1` | — |

La alineación del 2026-10-26 (`chore/expo-alineacion`, PR #92) dejó `npx expo install --check` en
«Dependencies are up to date» **para el SDK 54**: `react-native-safe-area-context` a `~5.6.0` y
`eslint-config-expo` a `~10.0.0`. No es un retroceso: `eslint-config-expo` cambió su numeración para
seguir al SDK, así que `10.x` es el config del 54 y `57.x`/`58.x` son de SDKs posteriores. Es el
mismo tipo de defecto que **R1** de `odd/tasks/consolidacion.md`.

## Lo que hay que resolver antes de tocar nada

1. **Compatibilidad de la cadena de estilos.** La app usa NativeWind 4 (rc) sobre
   `react-native-css-interop`. Hay que confirmar que esa pareja soporta React Native 0.88; si no,
   el salto arrastra también la migración de estilos, que es el cambio más caro de todos los que
   toca este frente (todas las pantallas usan `className`).
2. **`react-native-reanimated`** pasa de la línea 4.1 a la que pida el SDK 58, y con ella
   `react-native-worklets`. El velo del tour depende de `reanimated` y hay una trampa ya medida: el
   `className` se pierde en `Animated.View` (L2 de `odd/tasks/tour-ajustes-visuales.md`).
3. **Módulos nativos con ramas propias en la app**: `react-native-safe-area-context` (insets),
   `expo-notifications` (avisos), `expo-splash-screen`, `expo-font`, `expo-linear-gradient`,
   `expo-image-picker`, `expo-web-browser`. Los avisos y el splash no se pueden verificar en jsdom.
4. **La PWA y el export estático.** La publicación es `expo export` a GitHub Pages con
   `dist/404.html` igual a `dist/index.html`; hay que confirmar que el export del SDK 58 sigue
   dejando esa forma, porque el despliegue y la comprobación posterior dependen de ella.
5. **El gate E2E sólo corre Chromium.** Un salto de SDK puede romper Android/iOS sin que el CI diga
   nada: hace falta una pasada manual en dispositivo antes de publicar.

## Tasks

| ID | Specs | Qué | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1 | Medir el salto: `npx expo install expo@^58` en una rama, leer qué pide `expo install --fix` y qué rompe, sin tocar `main` | — | — |
| T2 | S1 | Resolver la cadena de estilos si NativeWind 4 no soporta RN 0.88 | `package.json` | — |
| T3 | S1 | Subir el resto de dependencias al SDK 58 y dejar `expo install --check` limpio | `package.json`, `pnpm-lock.yaml` | — |
| T4 | S1 | Gate completo: `vitest`, `tsc`, `eslint`, el spec del tour en Chromium y la suite E2E entera | — | — |
| T5 | S1 | Pasada manual en dispositivo Android e iOS: insets, splash, avisos y el tour | — | — |
| T6 | S1 | Publicar con tag y verificar el bundle servido y la PWA | — | — |

## Log

L1 — Pedido del propietario, verbatim:

> «El downgrade de ESlint me parece demasiado, no entiendo el motivo exacto. También creo que hay una
> versión de expo más reciente que es la 58: https://docs.expo.dev/versions/latest/»

L2 — Respuesta con la medición del registro (2026-10-26): el SDK 58 es real (`expo` `latest` =
58.0.19, `react-native` `latest` = 0.88.0) y el config de ESLint no era viejo sino del SDK 57 en una
app del 54. El propietario eligió alinear primero al 54 y dejar el salto como este frente.
