-- =============================================================
-- SPEC 10 (H-11/H-29/H-30) — Correcciones de RLS y privilegios
-- =============================================================
-- Revisión de cada política contra la matriz de permisos de SPEC 02.
-- Las políticas de filas eran correctas; el hueco estaba en las COLUMNAS:
-- RLS limita qué filas se actualizan, pero no qué columnas. Se corrige con
-- privilegios por columna (GRANT UPDATE (cols)), que PostgREST respeta.

-- -------------------------------------------------------------
-- H-11: profiles.rol era auto-editable (escalada de privilegios)
-- -------------------------------------------------------------
-- "profiles_update_own" permitía a cualquier usuario hacer
-- `update profiles set rol = 'jefe' where id = auth.uid()`. Todo el modelo
-- de autorización (políticas RLS, autorizar(), páginas) lee profiles.rol,
-- así que esa columna debe ser inmutable para el usuario. Se concede solo
-- lo que el primer ingreso y el perfil escriben de verdad.

revoke update on table public.profiles from authenticated;
grant update (username, telefono, email, lugar, area, puesto, primer_ingreso)
  on public.profiles to authenticated;

-- -------------------------------------------------------------
-- H-29: columnas de solicitudes y technician_status sin acotar
-- -------------------------------------------------------------
-- Un trabajador podía setear confirmacion_tecnico o tecnico_id en sus
-- propias filas (la política de filas lo dejaba pasar); un técnico podía
-- reasignar tecnico_id de technician_status. Se concede únicamente lo que
-- las actions actualizan; created_at, ids y dueños quedan inmutables.
-- updated_at lo pone el trigger set_updated_at (migración anterior), que
-- no está sujeto a privilegios de columna.

revoke update on table public.solicitudes from authenticated;
grant update (estado, tecnico_id, confirmacion_trabajador, confirmacion_tecnico)
  on public.solicitudes to authenticated;

revoke update on table public.technician_status from authenticated;
grant update (estado, ubicacion, atendiendo_solicitud_id)
  on public.technician_status to authenticated;

-- profiles también gana el trigger de updated_at (faltaba).
drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------------
-- H-30: RPCs ejecutables por anon
-- -------------------------------------------------------------
-- Postgres concede EXECUTE a PUBLIC por defecto: get_posicion_en_cola
-- (SECURITY DEFINER) era invocable sin sesión y filtraba el tamaño de la
-- cola. Solo usuarios autenticados (y service_role) las necesitan.

revoke execute on function public.get_posicion_en_cola(uuid) from public, anon;
grant execute on function public.get_posicion_en_cola(uuid) to authenticated, service_role;

revoke execute on function public.atender_solicitud(uuid) from public, anon;
grant execute on function public.atender_solicitud(uuid) to authenticated, service_role;
