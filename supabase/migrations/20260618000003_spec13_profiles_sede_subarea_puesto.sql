-- =============================================================
-- SPEC 13 (Migración C) — profiles: rename lugar->sede, +subarea, CHECK puesto
-- =============================================================
-- Formaliza la jerarquía en profiles (modelo snapshot: siguen siendo
-- texto nullable). El CHECK de puesto es NOT VALID a propósito.

-- lugar pasa a llamarse sede
alter table profiles rename column lugar to sede;

-- nueva columna, nullable (modelo snapshot)
alter table profiles add column subarea text;

-- SPEC 10 acotó el UPDATE de profiles por columna (revoke + grant de columnas
-- concretas). Añadir una columna NO concede privilegios sobre ella, así que la
-- nueva `subarea` debe sumarse al grant; sin esto el primer ingreso (rol
-- authenticated) falla con 42501 al escribir subarea. `sede` heredó el grant
-- de `lugar` al renombrar.
grant update (subarea) on public.profiles to authenticated;

-- CHECK NOT VALID: valida solo inserciones/actualizaciones FUTURAS y deja
-- las filas de prueba existentes (puesto en texto libre) intactas. Un
-- VALIDATE CONSTRAINT futuro fallaría sobre esas filas viejas: habría que
-- limpiarlas antes (están grandfathered a propósito).
alter table profiles
  add constraint profiles_puesto_check
  check (puesto in ('Jefe de área', 'Secretaria', 'Trabajador'))
  not valid;
