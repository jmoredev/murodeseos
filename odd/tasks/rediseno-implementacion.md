# Implementación del rediseño «Personas primero»

Lleva a la app el diseño cerrado en `design/rediseno-muro/` (ficha de diseño:
`odd/tasks/rediseno-muro.md`). Once tramos de menos a más riesgo, cada uno un PR contra la rama de
integración `feat/rediseno`; al final, un único merge a `main` y un tag.

**Rama de integración:** `feat/rediseno` (sale de `design/rediseno-muro`) · **Estado:** abierta; T1 integrado
(`bc75133`, #100), T2 en curso en `feat/rediseno-02-estados-acceso`.

## Specs

S1 — Petición (verbatim, L1): «Todo perfecto, ahora pasamos a la implementación».

S2 — Entrega (decisión del propietario, L2): «Rama de integración feat/rediseno (Recomendada)» — cada
tramo entra por PR en `feat/rediseno`; `main` sigue limpio y se pueden publicar arreglos; al final un
único merge y tag. Push, PR, merge y tag siguen siendo decisiones del propietario en cada tramo.

S3 — Orden (decisión del propietario, L2): «De menos a más riesgo (Recomendado)»: 1 colores y
tipografía · 2 estados y acceso · 3 perfil · 4 mi lista y formulario · 5 detalle y reserva · 6 Personas
· 7 ficha de grupo · 8 Avisos (migración) · 9 Recibidos y categorías (migración) · 10 Inicio e
invitación · 11 tour.

S4 — Fuente de verdad visual: los artboards `design/rediseno-muro/02`, `04`–`15` y
`design/rediseno-muro/sistema-nuevo.md` (tokens canónicos, §12 inconsistencias resueltas). Decisiones
de producto: `odd/tasks/rediseno-muro.md` S3 y L8 (Personas con selector «Personas | Grupos»; reservar
con hoja «¿Lo regalas tú?»; nueva contraseña con un campo y «Mostrar»; tallas de lista corta).

S5 — Contorno de controles (decisión del propietario, L2): «Sí, borde #B67A50» (`--border-control`,
`sistema-nuevo.md` §12.2).

S6 — Tipografía de la app: tipografía redondeada nueva, Nunito (`sistema-nuevo.md` §2), sustituyendo
Be Vietnam Pro + Plus Jakarta Sans.

S7 — Sin regresiones: cada tramo mantiene en verde `tsc`, `eslint --max-warnings 0`, Vitest y los e2e
afectados; los tests que fijan textos o estilos antiguos se actualizan en el mismo tramo, nunca se
borran sin sustituto. Los ids del tour y los `?tab=` antiguos siguen funcionando hasta T11/T10.

S8 — Alcance de T2 (decisiones del propietario, L8): sin conexión «Aviso simple, sin prometer datos
guardados (Recomendado)»; instalar la app «Fuera de T2, para más adelante (Recomendado)»; entrega
«Dos PRs: T2a estados y T2b acceso (Recomendado)».

S9 — Límites técnicos de T2 (L8): la invitación con auto-unión (11 P6) es T10; T2a crea el componente
de esqueleto y la pantalla de arranque, y cada pestaña lo conecta en su tramo (T3/T4/T6/T10); el
registro no cambia salvo lo que comparta `PasswordInput` (el «Mostrar» de texto entra como opción);
la hoja de confirmación cambia de forma pero mantiene el texto que le pasa cada pantalla (el texto de
borrar deseo es T4/T5); el enlace «Ver todo el historial en Avisos» espera a T8.

## Tasks

- [x] T1 — Colores, tipografía y contorno: tokens de `sistema-nuevo.md` en `tailwind.config.cjs` y
  `app/global.css`, Nunito con `expo-font`, hex sueltos (AppErrorBoundary, PrimaryButton, DateField,
  TourOverlay, spinners, placeholders, `app.json`, `public/manifest.json`), guardianes
  `contrast-floor`/`typography-floor`. S4–S7 · worker · rama `feat/rediseno-01-tokens` · commits `529f83a`, `6c83b74`, `04346a0`, `fd92c3f` · PR #100 → `feat/rediseno`, squash `bc75133`
  Risk: item 5 (dependencia nueva `@expo-google-fonts/nunito`).
- [ ] T2a — Estados globales (12): arranque, componente de esqueleto, aviso sin conexión simple,
  «Algo ha ido mal», 404, toasts, hoja de confirmación, Novedades. S4, S7, S8, S9 · worker · rama
  `feat/rediseno-02-estados-acceso` · commit —
- [ ] T2b — Acceso (11): login (móvil y escritorio), errores, recuperar contraseña como pantalla,
  correo enviado, límite de enlaces, nueva contraseña con un campo y «Mostrar», contraseña cambiada,
  enlace caducado. S4, S7, S8, S9 · worker · rama `feat/rediseno-02b-acceso` · commit —
- [ ] T3 — Perfil índice + apartados, tallas de lista (10). S4, S7 · — · commit —
- [ ] T4 — Mi lista y formulario de deseo (05, 06; varios enlaces, «¿Quién puede verlo?»). S4, S7 · — ·
  commit —
- [ ] T5 — Detalle de deseo y confirmación de reserva (08). S4, S7 · — · commit —
- [ ] T6 — Personas con selector «Personas | Grupos», sin alias de grupo (07). S4, S7 · — · commit —
- [ ] T7 — Ficha de grupo (04). S4, S7 · — · commit —
- [ ] T8 — Avisos como pestaña (09) + migración si entra «reserva retirada». S4, S7 · — · commit —
- [ ] T9 — Recibidos y categorías (05, migración `received_at` + `category`). S4, S7 · — · commit —
- [ ] T10 — Inicio, onboarding e invitación con auto-unión tras el acceso (02). S4, S7 · — · commit —
- [ ] T11 — Tour nuevo de 9 paradas (14). S4, S7 · — · commit —

## Log

L1 — 2026-11-27, propietario: «Todo perfecto, ahora pasamos a la implementación».

L2 — 2026-11-27, respuestas (ask_user_question): entrega «Rama de integración feat/rediseno
(Recomendada)»; orden «De menos a más riesgo (Recomendado)»; contorno «Sí, borde #B67A50».

L3 — 2026-11-27, mapa del explorador: estilos con NativeWind `className` casi en todo; tokens en
`tailwind.config.cjs:9-57` y `app/global.css:5-16`; ~40 hex fuera de tokens; fuentes con `useFonts` en
`app/_layout.tsx`; Nunito no instalado; tabs por estado en `app/index.tsx` + `lib/tabs.ts:7`;
breakpoint único `> 768` (`lib/use-is-desktop.ts`); guardianes que leen el repo
(`__tests__/contrast-floor.test.ts`, `typography-floor.test.ts`, `icon-chrome.test.ts`); 88 ficheros
Vitest y 25 specs Playwright; huecos de datos con migración: `category`, Recibidos (`received_at`),
aviso «reserva retirada»; el resto es UI.

L4 — 2026-11-27, T1: commits `529f83a` (paleta, Nunito, hex sueltos, guardianes, docs) y `6c83b74`
(página sin conexión de `public/sw.js` y `--font-app` con la cara `Nunito_600SemiBold`, defectos A1/A2
del verificador). Verificador independiente (item 5): PASS en S4–S7; `tsc`, `eslint`, Vitest 89
ficheros / 938 pruebas + 1 todo y `expo export -p web` en verde; e2e pendientes de CI (Supabase).
Pendiente fuera de T1: regenerar `public/AppIcons/*.png` y `favicon.ico` con fondo #FFF8F1;
`expo-linear-gradient` queda sin uso. Revisión nativa `review-9dac295bf8de4c6e` (lentes riesgo,
resiliencia, fiabilidad; base `bd21e1a`, `--committed-only`): el primer revisor superó el límite del
relay (996 s, prompt 113 KB). El propietario elige «Subir el límite y relanzar»: reiniciar Pi con
`GENTLE_PI_REVIEW_RELAY_PI_TIMEOUT_MS` más alto y retomar el mismo linaje con STATUS.

L5 — 2026-11-27, revisión `review-9dac295bf8de4c6e` retomada con el límite a 3 600 000 ms: los tres
revisores terminan (25 s, 227 s, 320 s) y el refutador corrobora un único BLOCKER, R3-001 («/61 ya
llega a 4.5037:1, el guardián de contraste fallaría»). Reproducido: falso positivo — el test pasa
(9/9); 4.5037 es la mezcla sin redondear, y `blendOver` redondea a 8 bits como el píxel pintado
(#7e7169), que queda bajo AA. Propietario: «Corrección honesta mínima (Recomendada)». Commit
`04346a0` fija ese redondeo en el test (+4 líneas, sin tocar aserciones). El validador dirigido la
rechaza porque las aserciones no cambian → estado terminal `escalated` (sin regresión, sin
follow-ups). T1 queda verificado por Vitest/tsc/eslint; la revisión nativa no aprobó.

L6 — 2026-11-27, propietario: «adelante con push y pr». Se sube `feat/rediseno` (`bd21e1a`) y
`feat/rediseno-01-tokens`; PR #100 hacia `feat/rediseno`. CI: E2E falla en
`e2e/wishlist.spec.ts:354`, que fijaba el degradado viejo de Guardar (hueco de S7 en T1); `fd92c3f`
lo comprueba por el relleno plano `primary` leído del token. Segundo intento: fallo de
infraestructura (puerto 54524 ocupado al arrancar Supabase), relanzado una vez → tipos, unitarias
y E2E en verde. `birthday-reminders.spec.ts:213` fue intermitente (pasó al reintentar). Merge del
PR: decisión del propietario.

L7 — 2026-11-27, propietario: «Merge y seguimos con T2». PR #100 integrado con squash (`bc75133`,
convención del repo); T2 arranca en `feat/rediseno-02-estados-acceso` desde `feat/rediseno`.

L8 — 2026-11-27, mapa del explorador para T2: ~1 400–1 850 líneas en dos bloques sin ficheros
comunes (estados ~650–900, acceso ~750–950); hoy no hay detección de conexión, ni esqueletos, ni
aviso de instalar, ni pantallas de recuperar contraseña/correo enviado/contraseña cambiada. Respuestas
(ask_user_question): sin conexión «Aviso simple, sin prometer datos guardados (Recomendado)»; instalar
«Fuera de T2, para más adelante (Recomendado)»; entrega «Dos PRs: T2a estados y T2b acceso
(Recomendado)».
