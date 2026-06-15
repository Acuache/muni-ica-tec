-- =============================================================
-- SPEC 11 (paso 2) — Índices de rendimiento
-- =============================================================
-- Único índice nuevo que EXPLAIN demostró necesario (ver 11-resultados.md):
-- las métricas "de hoy" del técnico y el jefe filtran por
--   estado = 'solucionado' | 'no_solucionado'  AND  updated_at >= <inicio de hoy>
-- y eran la única consulta sin índice usable (Seq Scan incluso forzando el
-- planner). El índice compuesto (estado, updated_at) cubre la igualdad de
-- estado + el rango de updated_at en una sola estructura.
--
-- El resto de consultas recurrentes ya tienen índice usable y NO se indexan
-- "por si acaso" (cada índice encarece los INSERT/UPDATE de solicitudes):
--   - cola / solicitud activa / en proceso → solicitudes_trabajador_activa_unica (SPEC 10)
--   - tabla del jefe / count total          → idx_solicitudes_created_at (SPEC 08)
--   - estado del técnico                     → technician_status_pkey

create index if not exists idx_solicitudes_estado_updated_at
  on solicitudes (estado, updated_at);
