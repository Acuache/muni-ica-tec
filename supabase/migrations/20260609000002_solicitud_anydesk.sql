-- =============================================================
-- SPEC 07g — Trabajador: datos de perfil en solicitud y campo AnyDesk
-- =============================================================
-- Agrega columna anydesk_code nullable a solicitudes.
-- La obligatoriedad se impone a nivel de aplicación cuando
-- tipo_ayuda = 'virtual'.

alter table solicitudes
  add column anydesk_code text;
