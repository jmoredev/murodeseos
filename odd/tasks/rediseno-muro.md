# Rediseño de la interfaz: dirección «Personas primero»

Maquetas HTML del rediseño completo (móvil primero + navegador) en `design/rediseno-muro/`. Esta ficha
cubre sólo el **diseño**; la implementación en la app se abrirá como frente propio cuando el
propietario cierre el diseño con sus comentarios.

**Rama:** `design/rediseno-muro` · **Estado:** 01–15 dibujadas + `sistema-nuevo.md`; en curso los comentarios del propietario sobre las
pantallas de T1–T9.

## Specs

S1 — Petición original (verbatim, L1): diseño para navegador y para móvil, «(sin perfer de vista que la
aplicación es mobile first)»; «Se puede modificar por completo el estilo actual de la aplicación»;
«Quiero que sea una aplicación fácil de usar para todo tipo de edades y que muestre claramente su
objetivo».

S2 — Dirección elegida por el propietario: **02 «Personas primero»**
(`design/rediseno-muro/02-personas-primero.html`). Toda pantalla nueva reutiliza su base visual:
fondo `#FFF8F1`, tinta `#2B1A12`, tinta-2 `#5C4033`, primario `#B93D12` (teja), acento `#2F6F4E`,
tarjetas con radio 20px, botones en píldora, fuentes del sistema en la maqueta (la app usará una
tipografía redondeada nueva, p. ej. Nunito). Pestañas: **Inicio / Mi lista / Personas / Avisos**
(los grupos viven dentro de Personas).

S3 — Decisiones de producto del propietario que toda pantalla respeta:
- «Próxima celebración» = cumpleaños + onomásticas (no fechas de eventos de grupo); la página de una
  persona lista ambas ordenadas por cercanía.
- Amigo invisible / sorteo queda **fuera** del diseño por ahora.
- Avatares: sólo emoji.
- Deseos con **iconos de categoría** en vez de fotos (12 categorías: Tecnología, Libros, Ropa y
  accesorios, Calzado, Hogar y cocina, Comida y bebida, Música y entradas, Experiencias y talleres,
  Juegos y juguetes, Deporte y aire libre, Belleza y cuidado, Otro regalo).
- Enlace a la tienda = **sólo icono** con aria-label «Abrir en la tienda (dominio): título»; la nota
  se muestra como bloque «Nota …» recortado a 3 líneas; ambos sólo si existen.
- «Ya lo tengo» mueve el deseo a «Recibidos» (deshacible), no lo borra.
- Sólo **alias de persona** (no de grupo); en «Personas» cada persona aparece **una vez** con sus
  grupos listados.
- Visibilidad por grupo como «¿Quién puede verlo?» (por defecto «Todos mis grupos» + casillas).
- El dueño **nunca** ve las reservas de sus propios deseos (la sorpresa se respeta).
- Unirse con código sólo existe dentro de la app («Personas › Unirme con un código»); el enlace de
  invitación abre la bienvenida «Lucía te ha invitado a «Familia Martín»».
- Tallas/gustos fuera del alta: se piden al añadir un deseo de Ropa/Calzado, en una tarjeta
  descartable de Inicio y en Perfil.

S4 — Pantallas pendientes (lista de la sesión 2026-11-26): «Personas tab, wish detail, Avisos,
Perfil, login/reset-password, global states, new design system spec, tablet breakpoint, tour».

## Tasks

Cada tarea es **un artboard nuevo** en `design/rediseno-muro/`, con sus estados en móvil (390 px) y su
versión de escritorio, como 04–06. El manifiesto `design.json` lo actualiza sólo el padre.

- [x] T1 — `07-personas.html`: pestaña Personas (personas una vez con sus grupos, tus grupos,
  «Unirme con un código», crear grupo, alias de persona). S2–S4 · worker · commit —
- [x] T2 — `08-detalle-deseo.html`: detalle de un deseo ajeno (reservar / reservado por ti / ya
  reservado por otro, varias tiendas) y del propio (sin reservas visibles). S2–S4 · worker · commit —
- [x] T3 — `09-avisos.html`: avisos (deseo añadido → abre ese deseo, reserva retirada, deseo borrado
  por su dueño, celebraciones próximas, novedades), vacío y ajustes por grupo. S2–S4 · worker · commit —
- [x] T4 — `10-perfil.html`: perfil (nombre + emoji, fechas, tallas y gustos, contraseña, instalar la
  app, novedades, repetir el tour, cerrar sesión). S2–S4 · worker · commit —
- [x] T5 — `11-acceso.html`: iniciar sesión, recuperar y restablecer contraseña, errores. S2–S4 ·
  worker · commit —
- [x] T6 — `12-estados-globales.html`: cargando, sin conexión, error, avisos tipo toast, diálogos de
  confirmación, página no encontrada. S2–S4 · pendiente · commit —
- [x] T7 — `13-tablet.html`: punto de corte de tablet. S2, S4 · pendiente · commit —
- [x] T8 — `14-tour.html`: tour de primer inicio con la nueva estética. S2–S4 · pendiente · commit —
- [x] T9 — Especificación del nuevo sistema de diseño (tokens, tipografía, componentes) sin pisar
  `design/system.md` (que es la foto del sistema actual). S2 · pendiente · commit —

- [x] T10 — Comentarios L6 sobre `07-personas.html`: rediseñar la pestaña con acceso rápido a
  personas y a grupos, grupos clicables, iconos sin comprimir. S2–S3, L6 · worker · commit —
- [x] T11 — Comentario L6 sobre `06-formulario-deseo.html`: añadir y editar casi idénticos, con
  «¿Quién puede verlo?» y enlaces debajo de Notas. S2–S3, L6 · worker · commit —
- [x] T12 — Comentario L6 sobre `10-perfil.html`: dejar claro cómo se edita el perfil (desde la
  pantalla 3 se llega a la 1 y la 2). S2–S3, L6 · worker · commit —
- [x] T13 — Comentario L6 sobre `02-personas-primero.html`: toda la tarjeta del selector de grupo
  es pulsable. S2, L6 · worker · commit —
- [x] T14 — Decisión L8 sobre `07-personas.html`: queda sólo la Opción A (selector «Personas |
  Grupos»); se retira la B. S2–S3, L8 · worker · commit —

## Log

L1 — Petición original (2026-11-26): «Tengo un problema con esta aplicación y es que el diseño de la
interfaz no me termina de convencer, he cambiado de orquestador para que me proponga otro diseño de la
misma. Necesito tanto diseño a nivel de navegador como diseño para ser utilizado en el móvil (sin
perfer de vista que la aplicación es mobile first) Se puede modificar por completo el estilo actual de
la aplicación. Quiero que sea una aplicación fácil de usar para todo tipo de edades y que muestre
claramente su objetivo»

L2 — 2026-11-26: el propietario elige 02 «Personas primero» y toma las decisiones de S3 (detalle en
Engram `design/rediseno-muro`). Se dibujan 04 ficha de grupo, 05 mi lista y 06 formulario de deseo.

L3 — 2026-11-27: el ordenador se reinició a mitad de sesión; no quedó código a medias. El propietario
pide: «Vale, vamos con el commit en una rama nueva y seguimos con las pantallas que faltan para poder
ver el diseño y añadir los comentarios necesarios». `design/` commiteado en `design/rediseno-muro`
(`c1c7b02`, frontera de tramo: sólo maquetas, ~7.8k líneas de HTML). Se abre esta ficha.

L4 — 2026-11-27: T1–T5 dibujadas por cinco workers en paralelo (07 personas, 08 detalle de deseo, 09
avisos, 10 perfil, 11 acceso) y añadidas a `design.json`. Preguntas de producto abiertas para el
propietario: disparador del alias de persona (07); reservar con confirmación o en un toque con
«Deshacer» (08); el aviso «reserva retirada» no existe en el código, «Novedades» como fila del hilo,
alcance del permiso push y ocultar `draw_performed` en los ajustes por grupo (09); tallas por lista o
texto libre (10); nueva contraseña con un solo campo frente a la repetición actual (11).

L5 — 2026-11-27: T6–T9 dibujadas (12 estados globales, 13 tablet a 2560 de ancho, 14 tour con 9
paradas, 15 sistema de diseño + `sistema-nuevo.md`). Preguntas abiertas nuevas: cartel de instalar la
app, error a pantalla completa sin pestañas, bloquear escrituras sin conexión (12); 2 o 3 columnas de
«Mi lista» a 1280, Perfil como quinto destino del raíl, escritorio a 1024 o 1280 (13); parada propia
para el grupo de ejemplo, «Atrás»/«Saltar el recorrido», actualizar los datos de demostración (14);
contorno de controles más oscuro `#B67A50` para pasar 3:1 (15).

L6 — 2026-11-27: comentarios del propietario en el canvas (verbatim):
- 06 «Nuevo deseo»: «A la hora de añadir un nuevo deseo entiendo que debajo d Notas van también las
  opciones de ¿Quien puede verlo? y el/los enlaces a la tienda. Al final la vista de de la pantalla 2
  de añadir un deseo y la pantalla 3 de editarlo tienen que ser casi idénticas»
- 07 avatar «🎸»: «Cuidado con que se compriman los iconos, se ve muy mal»
- 07 «🎸 Familia Martín»: «Estos grupos deberían de ser clickeables para que te lleve a su vista»
- 07 pantalla «Personas»: «No me gusta nada esta pantalla, porque mezcla personas y grupos y si tienes
  muchas personas tienes que bajar hasta abajo del todo para encontrar los grupos. Hay que
  rediseñarla, hay que tener acceso rápido tanto a los grupos como a la spersonas»
- 10 «Perfil»: «No entiendo bien en esta pantalla como editar tu perfil. Entiendo que desde la
  pantalla 3 deberías de llegar a las pantallas 1 y 2»
- 02 selector de grupo: «Entiendo que no hace falta pulsar unicamente sobre el radio button sino que
  al pulsar sobre toda la tarjeta se selecciona»

L7 — 2026-11-27: comentarios L6 aplicados y resueltos en el canvas (T10–T13). 07 ofrece ahora dos
opciones para elegir (A selector «Personas | Grupos», B tira de grupos arriba); 06 iguala añadir y
editar; 10 pasa a índice + dos apartados; 02 deja claro que toda la tarjeta del selector es pulsable.
