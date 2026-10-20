-- Caché y cuota del extractor de productos (T5b de `odd/tasks/compartir-producto.md`).
--
-- Dos estados compartidos por la Edge Function `extract-product`:
--
--   · `product_extraction_cache` — el borrador ya extraído, por clave de URL normalizada. Un
--     acierto devuelve el borrador sin pedir la página y **sin gastar cuota**.
--   · `product_extraction_quota` — cuántas extracciones permitidas gastó cada usuario en su
--     ventana fija.
--
-- RLS ACTIVO Y **SIN POLÍTICAS**, a propósito, en las dos tablas: solo las toca el `service_role`
-- de la Edge Function, que salta RLS por diseño. Ninguna fila se lee ni se escribe desde el
-- cliente con la `anon` key: exponer la caché mostraría el borrador de otros usuarios y exponer la
-- cuota permitiría inflarla o reiniciarla. `anon` y `authenticated` conservan `TRUNCATE`, que no
-- está sujeto a RLS, así que además se les revocan los privilegios (misma lección que
-- `20260924140609_drop_leftover_tmp_auth_tables.sql`). Una política se añade solo el día que
-- exista un caso de uso legítimo con `authenticated`; hoy no lo hay.
--
-- CADUCIDAD: no hay trabajo de fondo que purgue. La lectura filtra por `expires_at > now()`, así
-- que una fila vencida es invisible; el índice de `expires_at` existe para poder borrarlas por
-- lotes cuando el volumen lo pida. Mientras tanto la tabla es un registro de lo extraído, no un
-- registro de quién lo pidió.

create table if not exists public.product_extraction_cache (
    cache_key text primary key,
    draft jsonb not null,
    final_url text not null,
    created_at timestamp with time zone not null default now(),
    expires_at timestamp with time zone not null
);

comment on table public.product_extraction_cache is
    'Borrador extraido por clave de URL normalizada (capa `cache/` de _shared). Solo service_role; RLS sin politicas.';
comment on column public.product_extraction_cache.cache_key is
    'Clave de `normalizeCacheKey`: no es una identidad del producto ni una canonica, ver el modulo.';
comment on column public.product_extraction_cache.final_url is
    'URL del ultimo salto de la capa de red, para diagnostico; la clave sigue siendo `cache_key`.';
comment on column public.product_extraction_cache.expires_at is
    'A partir de aca la fila es invisible; el TTL lo fija la Edge Function (PRODUCT_EXTRACTION_CACHE_TTL_SECONDS).';

alter table public.product_extraction_cache enable row level security;
revoke all on table public.product_extraction_cache from anon, authenticated;

-- Índice para purgar por lotes las filas vencidas; la lectura por `cache_key` ya está cubierta
-- por la clave primaria.
create index if not exists product_extraction_cache_expires_at_idx
    on public.product_extraction_cache (expires_at);

create table if not exists public.product_extraction_quota (
    user_id uuid not null references auth.users (id) on delete cascade,
    window_start timestamp with time zone not null,
    count integer not null default 0 check (count >= 0),
    primary key (user_id, window_start)
);

comment on table public.product_extraction_quota is
    'Extracciones permitidas por usuario y ventana fija. Solo service_role; RLS sin politicas.';
comment on column public.product_extraction_quota.window_start is
    'Inicio de la ventana alineada a epoca: floor(epoch/ventana)*ventana. Dos peticiones a la vez caen en la misma fila.';
comment on column public.product_extraction_quota.count is
    'Extracciones **permitidas** en la ventana, no intentos: una peticion rechazada no la incrementa.';

alter table public.product_extraction_quota enable row level security;
revoke all on table public.product_extraction_quota from anon, authenticated;

-- Consumo de cuota **atomico**. Devuelve si esta peticion fue admitida, el conteo tras el intento
-- y el fin de la ventana (para que el handler calcule `retryAfterSeconds`).
--
-- POR QUE ES ATOMICO Y NO UN «LEER Y DESPUES ESCRIBIR»: la ventana es fija y alineada a epoca, asi
-- que dos peticiones simultaneas calculan el MISMO `window_start` y compiten por UNA fila. El
-- `insert ... on conflict do update ... where count < p_limit returning count` es una sola
-- sentencia: PostgreSQL toma el lock de la fila y la segunda transaccion espera y vuelve a
-- evaluar el `where` contra el conteo ya confirmado. Cuando el conteo llega al limite, el `where`
-- es falso, la sentencia no afecta ninguna fila y `returning` no devuelve nada. Resultado: pasan
-- como mucho `p_limit` peticiones por usuario y ventana, corran en paralelo o no.
--
-- QUE PASA CON EL CONTEO AL RECHAZAR: no se incrementa. El `count` es «extracciones permitidas»,
-- no «intentos»: al llegar al limite se queda ahi hasta que rueda la ventana. Asi un rechazo no
-- agranda el numero ni altera el `retryAfterSeconds` de los demas. El costo de no contar intentos
-- es de telemetria: quien quiera medir abuso lo hara aparte, no en la cuota.
--
-- QUE QUEDA SIN CUBRIR: la cuota se gasta ANTES de pedir la pagina, asi que un fallo de red o un
-- cierre del worker despues de consumir y antes de responder igual cuenta. Es la eleccion
-- conservadora (nunca se regala una extraccion), no un descuido. El trabajo de red no ocurre bajo
-- el lock: la fila se libera al confirmar la sentencia.
create or replace function public.consume_product_extraction_quota(
    p_user_id uuid,
    p_limit integer,
    p_window_seconds integer
)
returns table (allowed boolean, used integer, window_end timestamp with time zone)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_window_start timestamp with time zone;
    v_window_end timestamp with time zone;
    v_count integer;
begin
    if p_user_id is null then
        raise exception 'p_user_id no puede ser nulo';
    end if;
    if p_window_seconds is null or p_window_seconds <= 0 then
        raise exception 'p_window_seconds debe ser mayor que cero';
    end if;

    v_window_start := to_timestamp(
        floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
    );
    v_window_end := v_window_start + make_interval(secs => p_window_seconds);

    -- Con limite <= 0 no hay nada que insertar: se rechaza sin tocar la tabla.
    if p_limit is null or p_limit <= 0 then
        return query select false, 0, v_window_end;
        return;
    end if;

    insert into public.product_extraction_quota (user_id, window_start, count)
    values (p_user_id, v_window_start, 1)
    on conflict (user_id, window_start) do update
        set count = public.product_extraction_quota.count + 1
        where public.product_extraction_quota.count < p_limit
    returning count into v_count;

    if v_count is null then
        -- Rechazada: la fila ya estaba en el limite. Se lee para telemetria; el conteo no cambio.
        select q.count into v_count
          from public.product_extraction_quota q
         where q.user_id = p_user_id
           and q.window_start = v_window_start;
        return query select false, coalesce(v_count, 0), v_window_end;
        return;
    end if;

    return query select true, v_count, v_window_end;
end;
$function$;

comment on function public.consume_product_extraction_quota(uuid, integer, integer) is
    'Consume cuota de extraccion de forma atomica (upsert con incremento y returning). Solo service_role.';

-- Solo el `service_role` puede ejecutarla: con `security definer` corre como el dueno y salta RLS,
-- asi que dejarla ejecutable por `anon`/`authenticated` permitiria gastar la cuota de cualquier
-- usuario. Se revoca explicitamente porque las default privileges de Supabase conceden EXECUTE.
revoke all on function public.consume_product_extraction_quota(uuid, integer, integer)
    from public, anon, authenticated;
grant execute on function public.consume_product_extraction_quota(uuid, integer, integer)
    to service_role;
