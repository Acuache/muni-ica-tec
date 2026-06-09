-- =============================================================
-- SPEC 07g — area_id ya no se requiere al crear una solicitud
-- =============================================================
-- El formulario "Nueva Solicitud" dejó de pedir área; el área del
-- trabajador vive en profiles.area. Se deja la columna para no
-- romper registros existentes; una migración de limpieza futura
-- puede eliminarla.

alter table solicitudes
  alter column area_id drop not null;
