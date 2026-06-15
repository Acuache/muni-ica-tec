-- =============================================================
-- SPEC 11 (TEMPORAL) — Helper de medición EXPLAIN
-- =============================================================
-- Función de medición SOLO para la auditoría de rendimiento del SPEC 11.
-- Permite correr EXPLAIN sobre las consultas recurrentes vía supabase-js
-- (no hay psql/driver local). Decisión del spec: medir la USABILIDAD del
-- índice forzando el planner (enable_seqscan=off), sin sembrar datos.
--
-- ⚠️ SECURITY DEFINER + SQL dinámico: se concede EXECUTE solo a service_role
-- y se ELIMINA en la migración de cierre del spec (20260615000099).
-- No debe quedar en producción.

create or replace function public.explain_sql(q text, no_seqscan boolean default false)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
begin
  if no_seqscan then
    set local enable_seqscan = off;
  end if;
  return query execute 'EXPLAIN ' || q;
end;
$$;

revoke execute on function public.explain_sql(text, boolean) from public, anon, authenticated;
grant execute on function public.explain_sql(text, boolean) to service_role;
