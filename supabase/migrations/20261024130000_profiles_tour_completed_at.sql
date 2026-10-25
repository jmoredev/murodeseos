-- Tour de primer inicio (`odd/tasks/tour-tutorial.md`, D2 y D3).
--
-- La marca vive en el perfil y no en el dispositivo: el tour es por usuario, y reinstalar la
-- PWA o entrar desde otro móvil no debe volver a mostrárselo a quien ya lo vio.
--
-- El `update` de abajo es lo que hace que sólo lo vean las **cuentas nuevas**: todo perfil que
-- ya existe queda marcado como visto, así que en el código la condición es una sola
-- (`tour_completed_at IS NULL`) y no una fecha de corte repetida en cada pantalla. En una base
-- recién creada no hay filas y el `update` no hace nada; en la base real marca a los usuarios
-- actuales una sola vez, porque es inmutable: la migración no se vuelve a ejecutar.

alter table public.profiles add column if not exists tour_completed_at timestamp with time zone;

update public.profiles
set tour_completed_at = now()
where tour_completed_at is null;

comment on column public.profiles.tour_completed_at is
    'Cuándo terminó o saltó el tour de primer inicio. NULL = todavía no lo vio (sólo cuentas nuevas).';
