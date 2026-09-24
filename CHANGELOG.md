# Changelog

Todos los cambios notables del proyecto se documentan aquí. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

## [1.4.0] - 2026-05-12

### Added

- **Accesibilidad (web y base RN):** foco visible global (`app/global.css`), `lang="es"` en documento (`app/_layout.tsx`), enlace «Saltar al contenido» y región principal (`ResponsiveLayout.tsx`), roles ARIA y teclado en modales (`ConfirmModal`, `RevealModal`, `UserProfileModal`, `SecretSantaModal`), notificaciones como botón semántico (`NotificationItem`), etiquetas en `GroupCard` y `PrimaryButton`, pestañas de escritorio como `tablist`/`tab` en web.

### Fixed

- **Mis grupos:** el número de participantes (y los datos de perfil en tarjeta) coinciden con la vista de detalle del grupo al cargar miembros sin embed anidado y enriquecer `profiles` en consulta aparte (`components/GroupsTab.tsx`, alineado con `app/groups/[id]/index.tsx`).
