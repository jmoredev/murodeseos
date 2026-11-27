# Implementación del rediseño «Personas primero»

Lleva a la app el diseño cerrado en `design/rediseno-muro/` (ficha de diseño:
`odd/tasks/rediseno-muro.md`). Once tramos de menos a más riesgo, cada uno un PR contra la rama de
integración `feat/rediseno`; al final, un único merge a `main` y un tag.

**Rama de integración:** `feat/rediseno` (sale de `design/rediseno-muro`) · **Estado:** abierta, T1 en
curso en `feat/rediseno-01-tokens`.

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

## Tasks

- [ ] T1 — Colores, tipografía y contorno: tokens de `sistema-nuevo.md` en `tailwind.config.cjs` y
  `app/global.css`, Nunito con `expo-font`, hex sueltos (AppErrorBoundary, PrimaryButton, DateField,
  TourOverlay, spinners, placeholders, `app.json`, `public/manifest.json`), guardianes
  `contrast-floor`/`typography-floor`. S4–S7 · worker · rama `feat/rediseno-01-tokens` · commit —
  Risk: item 5 (dependencia nueva `@expo-google-fonts/nunito`).
- [ ] T2 — Estados globales y acceso (12, 11). S4, S7 · — · commit —
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
