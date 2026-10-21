-- Presupuesto del respaldo con Firecrawl (T3 de `odd/tasks/respaldo-firecrawl.md`).
--
-- POR QUE UNA TABLA PROPIA Y NO LA CUOTA DE EXTRACCION. La cuota de extraccion vive en
-- `product_extraction_quota` con ventana por hora. El respaldo necesita la MISMA forma pero con
-- ventana de 30 dias, y la clave primaria es `(user_id, window_start)`: reusar la tabla haría que
-- ambos contadores compartan fila cuando el inicio de la ventana horaria coincide con el de la de
-- 30 dias — pasa exactamente al principio de cada ventana de 30 dias — y los dos consumos se
-- sumarian en silencio. Dos tablas, cero colisiones.
--
-- QUÉ CUENTA: cada fila es un **rescate permitido**, no un intento. Una peticion rechazada no
-- incrementa nada, igual que en la cuota de extraccion.
--
-- RLS ACTIVO Y SIN POLITICAS: solo la toca el `service_role` de la Edge Function. Se revocan los
-- privilegios de `anon` y `authenticated` porque `TRUNCATE` no está sujeto a RLS.

create table if not exists public.product_fallback_quota (
    user_id uuid not null references auth.users (id) on delete cascade,
    window_start timestamp with time zone not null,
    count integer not null default 0 check (count >= 0),
    primary key (user_id, window_start)
);

comment on table public.product_fallback_quota is
    'Rescates con Firecrawl permitidos por usuario y ventana de 30 dias. Solo service_role; RLS sin politicas.';
comment on column public.product_fallback_quota.window_start is
    'Inicio de la ventana alineada a epoca: floor(epoch/ventana)*ventana. Misma convencion que la cuota de extraccion.';
comment on column public.product_fallback_quota.count is
    'Rescates **permitidos** en la ventana, no intentos: una peticion rechazada no la incrementa.';

alter table public.product_fallback_quota enable row level security;
revoke all on table public.product_fallback_quota from anon, authenticated;

-- Consumo atomico: el `insert ... on conflict do update ... where count < p_limit returning count`
-- es una sola sentencia, así que dos peticiones simultáneas no pueden pasar de `p_limit`. Si no
-- afecta ninguna fila, `returning` no devuelve nada y la petición se rechaza.
create or replace function public.consume_product_fallback(
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

    -- Con limite <= 0 el respaldo esta apagado: se rechaza sin tocar la tabla.
    if p_limit is null or p_limit <= 0 then
        return query select false, 0, v_window_end;
        return;
    end if;

    insert into public.product_fallback_quota (user_id, window_start, count)
    values (p_user_id, v_window_start, 1)
    on conflict (user_id, window_start) do update
        set count = public.product_fallback_quota.count + 1
        where public.product_fallback_quota.count < p_limit
    returning count into v_count;

    if v_count is null then
        select q.count into v_count
          from public.product_fallback_quota q
         where q.user_id = p_user_id
           and q.window_start = v_window_start;
        return query select false, coalesce(v_count, 0), v_window_end;
        return;
    end if;

    return query select true, v_count, v_window_end;
end;
$function$;

comment on function public.consume_product_fallback(uuid, integer, integer) is
    'Consume presupuesto de respaldo de forma atomica (upsert con incremento y returning). Solo service_role.';

revoke all on function public.consume_product_fallback(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_product_fallback(uuid, integer, integer) to service_role;
