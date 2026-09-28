# Los avisos que dejó el refactor del lint

**Rama:** `fix/avisos-refactor-lint`
**Abierta:** 2026-09-28
**Estado:** en curso

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
| 1 | Pestaña activa: validar el parámetro `tab` contra las pestañas reales (vacío y desconocido) | pendiente | — |
| 2 | Grupos: derivar el estado de carga del usuario cuyos datos están cargados | pendiente | — |
| 3 | Brindis: el cierre cancela el cuadro de entrada si aún no llegó | pendiente | — |
| 4 | Un solo idioma de montaje (`useClientMounted`) y los dos restos sueltos | pendiente | — |
| 5 | Verificación: lint, tipos, unitarios y el gate completo de chromium | pendiente | — |

## Restricciones

- Ninguna migración se toca: la unidad es de interfaz y de pruebas.
- No se cambia el comportamiento visible más allá de los tres defectos: el idioma
  de montaje y los dos restos son equivalencias.
- Cada defecto que se pueda probar con una prueba unitaria trae la suya.

## Verificación

Pendiente.

## Consecuencia

Al terminar, el refactor del lint no deja deuda suya: sus tres defectos pequeños
quedan corregidos, el idioma de montaje tiene una sola definición y no quedan
restos muertos en los archivos que tocó.
