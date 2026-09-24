# Consolidar el repositorio en una sola línea de trabajo

**Feature:** `consolidacion`
**Estado:** en curso
**Inicio:** 2026-09-24
**Rama:** `feat/pwa-adaptation`

## Objetivo

Dejar una única fuente de verdad para la aplicación, un único canal de entrega
y una única convención de herramientas, de modo que el producto pueda avanzar
sin la ambigüedad actual sobre qué rama, qué ejecutor de tareas y qué destino de
publicación son los reales.

## Contexto encontrado

El repositorio contenía tres líneas de trabajo en paralelo, y el clon local
estaba situado en la abandonada:

| Rama | Fecha | Stack | Versión |
| --- | --- | --- | --- |
| `develop` / `main` | 2026-02-04 | Next.js 16 App Router, `@supabase/ssr`, middleware | 1.3.0 |
| `feature/ui-keepsake` | 2026-05-12 | reescritura a Expo Router + React Native Web + NativeWind | 1.4.0 |
| `feat/pwa-adaptation` | 2026-06-05 | la anterior más PWA y export estático | 1.4.0 |

`develop` es ancestro de `feat/pwa-adaptation` (35 commits por detrás).
`feature/ui-keepsake` también lo es (11 commits por detrás).
`main` no lo es: contiene el merge `49e31a1`, que la otra rama no tiene.

`feat/pwa-adaptation` es la única línea capaz de cumplir el objetivo de
distribución, porque el renderizado en servidor y el middleware de Next.js no
pueden ejecutarse en GitHub Pages, mientras que `expo export --platform web`
genera un sitio estático instalable como PWA en Android y iOS.

El sitio de producción `https://jmoredev.github.io/murodeseos/` se publica desde
la rama `gh-pages-test` (`build_type: legacy`). La rama `gh-pages` está congelada
y sin uso, así que el despliegue manual no tiene efecto sobre lo que ve el
usuario.

## Decisiones

| # | Decisión | Motivo |
| --- | --- | --- |
| D1 | `feat/pwa-adaptation` es la aplicación vigente; la línea Next.js es legado. | Es la única que llega a GitHub Pages y permite una PWA instalable en Android e iOS. |
| D2 | Ver una lista de deseos exige un grupo en común, aplicado en la base de datos. | Hoy cualquier usuario autenticado que conozca un UUID puede leer cualquier lista. |
| D3 | La sorpresa se garantiza en la base de datos: el dueño nunca recibe `reserved_by`. | La regla actual es solo de interfaz y el dueño puede leer la reserva desde el navegador. |
| D4 | Una sola reserva por deseo: gana el primero y el segundo recibe un error claro. | El read-modify-write actual permite que dos personas reserven el mismo regalo en silencio. |
| D5 | La entrada a los grupos sigue siendo abierta por código, con unión instantánea. | Mantiene el comportamiento actual y la baja fricción que busca el producto. |
| D6 | Notificaciones: in-app hoy, push web para la PWA instalada después. | Solo in-app no alcanza a quien tiene la aplicación cerrada. |
| D7 | `main` se actualiza con un merge, no con force-push. | Al no ser ancestro, un force-push borraría el commit `49e31a1`. El merge produce el mismo árbol y conserva la historia. |
| D8 | GitHub Pages se publica mediante GitHub Actions al sitio único. | Solo hay un sitio Pages por repositorio y `gh-pages-test` es producción, no una vista previa: no existe un sitio de previsualización. |
| D9 | Convención de commits: Conventional Commits sin emoji. | Coherente con la disciplina de commits por unidad de trabajo adoptada con gentle-ai. |
| D10 | Se eliminan `.agents/` y `skills-lock.json`. | La configuración de opencode/Cursor queda superada por la del harness. |
| D11 | npm sustituye a bun como gestor de paquetes y ejecutor de tareas. | Docker sí es necesario para el Supabase local; bun no está instalado y añade un segundo ejecutor sin aportar nada aquí. |

## Fuera de alcance

- Ninguna funcionalidad nueva de producto en esta feature.
- Ninguna reescritura de migraciones existentes: producción tiene datos reales,
  así que todo cambio de esquema es aditivo y solo hacia delante.
- Ningún cambio en el sistema de diseño visual.

## Restricciones

- El proyecto Supabase de producción `bztfzifafqulelcxycqk` tiene usuarios y
  datos reales. Las migraciones deben ser aditivas y nunca reiniciar el esquema.
- El repositorio es público, así que la clave anónima del bundle publicado es
  pública por diseño y la corrección de las políticas RLS es la única frontera
  de acceso real.

## Tareas

| # | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Preservar el cambio local de `.gitignore` y cambiar a `feat/pwa-adaptation` | hecho | entrada del stash "local .atl/ gitignore entry" |
| 2 | Ignorar el directorio local de estado de Pi | hecho | `1540ba5` |
| 3 | Registrar este diario de decisiones | hecho | este archivo |
| 4 | Fusionar `feat/pwa-adaptation` en `main` y publicar | pendiente | |
| 5 | Eliminar la rama remota `develop` | pendiente | |
| 6 | Sustituir bun por npm en scripts y documentación | en curso | el script `dev` ejecutaba `next dev`, que no está instalado en esta rama |
| 7 | Eliminar `.agents/` y `skills-lock.json` | pendiente | |
| 8 | Añadir el flujo de CI: lint y tests unitarios en cada pull request | pendiente | |
| 9 | Añadir el flujo de despliegue: build y publicación en GitHub Pages | pendiente | |
| 10 | Cambiar la fuente de GitHub Pages a GitHub Actions | pendiente | acción del propietario en el panel |
| 11 | Auditar políticas RLS, migraciones aplicadas y privilegios de funciones contra producción | bloqueado | requiere el proyecto Supabase vinculado |
| 12 | Añadir migraciones para visibilidad por grupo, reserva única y privacidad de la reserva | pendiente | depende de la tarea 11 |

## Defectos conocidos para la fase de seguridad

| ID | Defecto | Estado |
| --- | --- | --- |
| S1 | El dueño del deseo puede leer `reserved_by`: la sorpresa es falsificable | abierto |
| S2 | Cualquier usuario autenticado lee cualquier lista sin grupo en común | abierto |
| S3 | Las notificaciones se pueden insertar en nombre de otros usuarios | pendiente de verificar contra producción |
| S4 | La política de actualización de `wishlist_items` es permisiva y depende de un trigger | pendiente de verificar contra producción |
| S5 | Funciones `SECURITY DEFINER` alcanzables por RPC | verificado cerrado para `anon` |
| S6 | Listado del bucket de Storage por usuarios anónimos | no concluyente, no expone objetos |
| S7 | `draw_performed` ausente de la restricción de tipos de notificación | pendiente de verificar contra producción |

## Verificación

- `git merge-base --is-ancestor origin/main origin/feat/pwa-adaptation` debe
  indicar divergencia antes del merge y éxito después.
- El bundle publicado por GitHub Pages debe coincidir con la salida `dist` del
  `main` fusionado.
