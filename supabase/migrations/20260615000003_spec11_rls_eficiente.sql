-- =============================================================
-- SPEC 11 (paso 3) — RLS eficiente: auth.uid() envuelto en (select ...)
-- =============================================================
-- Postgres llama auth.uid() UNA VEZ por fila cuando aparece directo en una
-- política; envuelto en (select auth.uid()) lo evalúa una sola vez por
-- consulta (InitPlan cacheado). Mismo efecto de permisos, mejor plan a
-- volumen. Los lookups de rol ya eran subconsultas; se les envuelve también
-- el auth.uid() interno por consistencia.
--
-- Solo cambian las expresiones auth.uid(); roles, columnas (GRANTs del
-- SPEC 10) y semántica quedan idénticos. Las políticas `using (true)`
-- (areas_select, profiles_select) no tienen funciones por fila → no se tocan.

-- profiles --------------------------------------------------------
drop policy "profiles_update_own" on profiles;
create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- solicitudes -----------------------------------------------------
drop policy "solicitudes_select" on solicitudes;
create policy "solicitudes_select"
  on solicitudes for select
  to authenticated
  using (
    trabajador_id = (select auth.uid())
    or (select rol from profiles where id = (select auth.uid())) in ('tecnico', 'jefe')
  );

drop policy "solicitudes_insert_trabajador" on solicitudes;
create policy "solicitudes_insert_trabajador"
  on solicitudes for insert
  to authenticated
  with check (
    trabajador_id = (select auth.uid())
    and (select rol from profiles where id = (select auth.uid())) = 'trabajador'
  );

drop policy "solicitudes_update_trabajador" on solicitudes;
create policy "solicitudes_update_trabajador"
  on solicitudes for update
  to authenticated
  using (
    trabajador_id = (select auth.uid())
    and (select rol from profiles where id = (select auth.uid())) = 'trabajador'
  )
  with check (trabajador_id = (select auth.uid()));

drop policy "solicitudes_update_tecnico" on solicitudes;
create policy "solicitudes_update_tecnico"
  on solicitudes for update
  to authenticated
  using (
    (select rol from profiles where id = (select auth.uid())) = 'tecnico'
    and (
      tecnico_id = (select auth.uid())
      or (tecnico_id is null and estado = 'en_espera')
    )
  )
  with check (
    (select rol from profiles where id = (select auth.uid())) = 'tecnico'
  );

-- technician_status -----------------------------------------------
drop policy "technician_status_select" on technician_status;
create policy "technician_status_select"
  on technician_status for select
  to authenticated
  using (
    (select rol from profiles where id = (select auth.uid())) in ('tecnico', 'jefe')
  );

drop policy "technician_status_update_own" on technician_status;
create policy "technician_status_update_own"
  on technician_status for update
  to authenticated
  using (
    tecnico_id = (select auth.uid())
    and (select rol from profiles where id = (select auth.uid())) = 'tecnico'
  )
  with check (tecnico_id = (select auth.uid()));

drop policy "technician_status_insert_own" on technician_status;
create policy "technician_status_insert_own"
  on technician_status for insert
  to authenticated
  with check (
    tecnico_id = (select auth.uid())
    and (select rol from profiles where id = (select auth.uid())) = 'tecnico'
  );
