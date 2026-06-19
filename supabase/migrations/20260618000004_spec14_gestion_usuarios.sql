-- =============================================================
-- SPEC 14 — Gestión de usuarios (panel del jefe)
-- =============================================================
-- Cambios de esquema sobre profiles:
--   1) username deja de ser único (dos personas pueden llamarse igual).
--   2) se elimina dni (nunca se llenó ni se usa).
--   3) se añade activo (soft-delete; las cuentas existentes quedan activas).
-- Las escrituras de gestión (crear/editar/desactivar) corren con el cliente
-- admin (service_role) tras autorizar(['jefe']); por eso NO se añaden grants de
-- columna sobre `activo` ni políticas RLS de insert/delete para el jefe.

-- 1) El nombre ya no es único.
alter table profiles drop constraint profiles_username_key;

-- 2) El DNI no se usa: se elimina la columna (también desaparecen sus grants).
alter table profiles drop column dni;

-- 3) Bandera de cuenta activa (soft-delete). Filas existentes quedan en true.
alter table profiles add column activo boolean not null default true;
