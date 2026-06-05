-- SPEC 06 — Técnico: cola y atención
-- ─────────────────────────────────────────────────────────────────
-- Contiene dos cambios independientes:
--   1. Trigger set_updated_at en solicitudes (necesario para que
--      la métrica FINALIZADAS HOY use la fecha de cierre real).
--   2. Trigger reset_tecnico_en_cierre: cuando el trabajador cierra
--      una solicitud (solucionado / no_solucionado), libera al
--      técnico asignado (technician_status → disponible).
-- ─────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────
-- 1. Auto-actualizar solicitudes.updated_at en cada UPDATE
-- ─────────────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger solicitudes_set_updated_at
before update on solicitudes
for each row
execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 2. Liberar al técnico cuando la solicitud se cierra
--    Disparo: AFTER UPDATE en solicitudes, solo cuando el estado
--    pasa de en_proceso a solucionado o no_solucionado y hay un
--    técnico asignado.
-- ─────────────────────────────────────────────────────────────────

create or replace function reset_tecnico_en_cierre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update technician_status
  set estado                  = 'disponible',
      atendiendo_solicitud_id = null,
      updated_at              = now()
  where tecnico_id = old.tecnico_id;
  return new;
end;
$$;

create trigger solicitud_cierre_reset_tecnico
after update on solicitudes
for each row
when (
  old.estado = 'en_proceso'
  and new.estado in ('solucionado', 'no_solucionado')
  and old.tecnico_id is not null
)
execute function reset_tecnico_en_cierre();
