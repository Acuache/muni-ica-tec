-- =============================================================
-- SPEC 13 (Migración A) — Limpieza de lo muerto + tablas de catálogo
-- =============================================================
-- Reemplaza el campo de texto libre por un catálogo normalizado
-- Sede → Área → Subárea. Primero se elimina lo que quedó muerto
-- (SPEC 07g volvió area_id nullable y nadie consulta la tabla areas),
-- luego se recrean las tablas de catálogo con el esquema nuevo.
--
-- ORDEN OBLIGATORIO (un DDL fuera de orden aborta la migración):
--   1. drop column solicitudes.area_id  (arrastra su FK a areas)
--   2. drop table areas                 (la vieja: id, nombre)
--   3. create sedes / areas (nueva) / subareas

-- -------------------------------------------------------------
-- PASO 1: Eliminar lo muerto
-- -------------------------------------------------------------

alter table solicitudes drop column area_id;   -- vestigial, nullable, sin uso
drop table areas;                               -- la vieja, antes de recrearla

-- -------------------------------------------------------------
-- PASO 2: Tablas de catálogo (nuevas), en orden de dependencia de FK
-- -------------------------------------------------------------

create table sedes (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden  int  not null default 0
);

create table areas (
  id      uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sedes(id) on delete cascade,
  nombre  text not null,
  orden   int  not null default 0,
  unique (sede_id, nombre)
);

create table subareas (
  id      uuid primary key default gen_random_uuid(),
  area_id uuid not null references areas(id) on delete cascade,
  nombre  text not null,
  orden   int  not null default 0,
  unique (area_id, nombre)
);

-- -------------------------------------------------------------
-- PASO 3: Índices en las FK (SPEC 11 — toda FK consultada lleva índice)
-- -------------------------------------------------------------

create index idx_areas_sede_id    on areas (sede_id);
create index idx_subareas_area_id on subareas (area_id);

-- -------------------------------------------------------------
-- PASO 4: RLS — SELECT para autenticados; sin escritura
-- (el catálogo se gestiona por SQL/migración, igual que la areas
--  original de SPEC 02)
-- -------------------------------------------------------------

alter table sedes    enable row level security;
alter table areas    enable row level security;
alter table subareas enable row level security;

create policy "sedes_select_authenticated"
  on sedes for select
  to authenticated
  using (true);

create policy "areas_select_authenticated"
  on areas for select
  to authenticated
  using (true);

create policy "subareas_select_authenticated"
  on subareas for select
  to authenticated
  using (true);
