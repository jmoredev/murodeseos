# Los avisos que dejó el refactor del lint

**Rama:** `fix/avisos-refactor-lint`
**Abierta:** 2026-09-28
**Estado:** cerrada el 2026-09-28 — los tres defectos corregidos con su prueba, el idioma de montaje compartido y los dos restos retirados; revisión nativa aprobada

## Objetivo

Cerrar los hallazgos informativos de la revisión que hizo verde el lint (PR #18),
que son consecuencia directa de aquel refactor: tres defectos pequeños de
comportamiento, un idioma repetido y dos restos sueltos.

## Contexto encontrado

- **Pestaña activa.** `app/index.tsx` hace `(params.tab as Tab) ?? null`. El
  operador `??` solo cae en `null` con `undefined`, así que un `?tab=` vacío deja
  `activeTab` en cadena vacía y **ninguna de las tres pestañas se pinta**: lienzo
  en blanco. Lo mismo con un `?tab=basura`. Es un defecto anterior al refactor,
  pero está en el código que el refactor reescribió.
- **Estado de carga de los grupos.** `components/GroupsTab.tsx` enciende `loading`
  en el valor inicial y lo apaga al terminar la carga, pero nunca lo vuelve a
  encender. Si `userId` cambia (cierre de sesión y entrada con otra cuenta) el
  efecto se repite y durante la recarga se ven los grupos de la cuenta anterior.
  El comentario que dejé en el refactor dice justo lo contrario de lo que ahora
  conviene.
- **Carrera del brindis.** `components/Toast.tsx` agenda la entrada en el
  siguiente cuadro y el cierre con `setTimeout(duration)`. Con una `duration` más
  corta que un cuadro, el cierre llega primero y el cuadro vuelve a poner
  `isVisible` en `true` después: el brindis se queda visible hasta que el padre lo
  retira.
- **Idioma de montaje repetido.** El «en el servidor no hay DOM» se escribe con
  `useSyncExternalStore(() => () => {}, () => true, () => false)` en
  `ConfirmModal`, `UserProfileModal` y `NotificationMenu`, con el mismo comentario
  copiado. No hay ningún hook propio en `lib/` todavía.
- **Dos restos sueltos.** `app/groups/join/index.tsx` importa `React` sin usar
  ninguna vez (el runtime automático lo hace innecesario); y
  `app/groups/create/index.tsx` declara `const [icon] = useState('🎁')`, que
  descarta el modificador porque el valor nunca cambia.

## Decisiones

- **D1 — La pestaña se valida contra la lista real, no solo contra el vacío.** El
  arreglo del caso señalado es el mismo que el del parámetro desconocido, así que
  se resuelven juntos: `?tab=basura` producía el mismo lienzo en blanco.
- **D2 — El estado de carga se deriva, no se enciende con un efecto.** Se guarda
  **para qué usuario** están cargados los datos y `loading` se calcula comparando
  con el usuario actual. Volver a encenderlo con un `setState` dentro del efecto
  sería justo lo que la regla del lint prohíbe y lo que el refactor acaba de
  quitar; así el estado vuelve a encenderse solo, sin efecto y sin encadenar
  renders.
- **D3 — El brindis conserva su semántica.** `duration` sigue siendo el tiempo
  total: el arreglo es que el temporizador de cierre **cancele el cuadro de
  entrada** si aún no ha llegado, en vez de reordenar los efectos y mover el
  significado de `duration`.
- **D4 — La importación de `React` se retira solo en el archivo señalado.** El
  resto del repositorio la conserva como estilo previo; cambiarla en todos los
  archivos sería una unidad propia y no aporta nada al comportamiento.

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Pestaña activa: validar el parámetro `tab` contra las pestañas reales (vacío y desconocido) | **hecho** | `a33e65e`: `lib/tabs.ts` reúne la lista y el analizador; cuatro casos nuevos en `__tests__/tabs.test.ts` |
| 2 | Grupos: derivar el estado de carga del usuario cuyos datos están cargados | **hecho** | `8198412`: `loading` se calcula contra el usuario cargado, y la prueba nueva **falla contra el componente anterior** |
| 3 | Brindis: el cierre cancela el cuadro de entrada si aún no llegó | **hecho** | `80105f2` |
| 4 | Un solo idioma de montaje (`useClientMounted`) y los dos restos sueltos | **hecho** | `52ae71f` (`lib/use-client-mounted.ts` y los tres componentes) y `72df94b` (la importación de `React` y el estado del icono) |
| 5 | Verificación: lint, tipos, unitarios y el gate completo de chromium | **hecho** | ver abajo |

## Restricciones

- Ninguna migración se toca: la unidad es de interfaz y de pruebas.
- No se cambia el comportamiento visible más allá de los tres defectos: el idioma
  de montaje y los dos restos son equivalencias.
- Cada defecto que se pueda probar con una prueba unitaria trae la suya.

## Verificación

- `pnpm run lint` limpio, avisos incluidos.
- `pnpm exec tsc --noEmit` sin errores.
- **147** pruebas unitarias en verde: cinco nuevas (cuatro del analizador de la
  pestaña y la de la carga al cambiar de usuario).
- Suite completa de chromium: **40/40, sin inestables**.
- La prueba de la carga **se comprobó contra el defecto**: revirtiendo el componente
  a su forma anterior falla con «Unable to find an element with the text: Cargando
  grupos...», y con el arreglo pasa. Una prueba que nunca se vio fallar no prueba
  nada.

Lo que la verificación **no** cubre: la carrera del brindis no tiene prueba
unitaria. Su estado visible es una clase de opacidad, y decidir el ganador entre un
cuadro de animación y un temporizador no es observable de forma fiable en jsdom. El
arreglo es de una línea y el razonamiento queda en el mensaje del commit `80105f2`.

## Hallazgos informativos de la revisión

La revisión nativa (tier medio, lente de fiabilidad) **aprobó** el candidato sin abrir
corrección. Devolvió tres hallazgos informativos, que no bloquean y se trabajan aparte:

| ID | Lente | Ubicación | Gravedad |
| --- | --- | --- | --- |
| R3-1 | fiabilidad | `components/GroupsTab.tsx:20` | aviso |
| R3-2 | fiabilidad | `__tests__/GroupsTab.test.tsx:56` | aviso |
| R3-3 | fiabilidad | `components/GroupsTab.tsx:145` | sugerencia |

_Repasados el 2026-09-28: el veredicto de cada uno y por qué no se toca está en [`informativos.md`](./informativos.md)._

## Consecuencia

Al terminar, el refactor del lint no deja deuda suya: sus tres defectos pequeños
quedan corregidos, el idioma de montaje tiene una sola definición y no quedan
restos muertos en los archivos que tocó.
