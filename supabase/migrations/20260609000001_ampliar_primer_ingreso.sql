-- =============================================================
-- SPEC 07f — Ampliar formulario de primer ingreso
-- =============================================================
-- Agrega tres columnas nullable a profiles para capturar lugar,
-- área y puesto del usuario durante el primer ingreso.
-- La obligatoriedad se impone a nivel de aplicación (Server Action).

alter table profiles
  add column lugar  text,
  add column area   text,
  add column puesto text;
