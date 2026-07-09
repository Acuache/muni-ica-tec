-- =============================================================
-- Hardening según advisors de Supabase (auditoría 2026-07)
-- =============================================================

-- -------------------------------------------------------------
-- 1) Trigger functions expuestas como RPC
-- -------------------------------------------------------------
-- Postgres concede EXECUTE a PUBLIC por defecto: handle_new_user y
-- reset_tecnico_en_cierre (SECURITY DEFINER) eran invocables vía
-- /rest/v1/rpc por anon/authenticated. Los triggers no requieren el
-- privilegio EXECUTE del invocador, así que revocarlo no rompe nada.

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.reset_tecnico_en_cierre()
  from public, anon, authenticated;
revoke execute on function public.set_updated_at()
  from public, anon, authenticated;

-- -------------------------------------------------------------
-- 2) search_path fijo en set_updated_at (function_search_path_mutable)
-- -------------------------------------------------------------
alter function public.set_updated_at() set search_path = public;

-- -------------------------------------------------------------
-- 3) FKs sin índice de cobertura (unindexed_foreign_keys)
-- -------------------------------------------------------------
-- Parciales: solo filas con valor, que son las que consultan las queries
-- (casos del técnico, técnico atendiendo X).

create index if not exists idx_solicitudes_tecnico_id
  on solicitudes (tecnico_id)
  where tecnico_id is not null;

create index if not exists idx_technician_status_atendiendo
  on technician_status (atendiendo_solicitud_id)
  where atendiendo_solicitud_id is not null;
