-- =============================================================
-- SPEC 08 — Doble confirmación y tabla completa del jefe
-- =============================================================
-- Agrega las columnas de confirmación para el flujo de doble
-- confirmación (técnico + trabajador) y el índice de rendimiento
-- para la consulta paginada del jefe.

alter table solicitudes
  add column confirmacion_trabajador boolean not null default false,
  add column confirmacion_tecnico    boolean not null default false;

create index if not exists idx_solicitudes_created_at
  on solicitudes (created_at desc);

-- Las solicitudes ya cerradas quedan con ambas confirmaciones en true
-- para evitar indicadores contradictorios (✗/✗ en estado solucionado).
update solicitudes
  set confirmacion_trabajador = true,
      confirmacion_tecnico    = true
  where estado = 'solucionado';
