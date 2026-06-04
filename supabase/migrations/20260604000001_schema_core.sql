-- =============================================================
-- SPEC 02 — Esquema de base de datos + RLS base
-- =============================================================

-- -------------------------------------------------------------
-- PASO 1: Enums
-- -------------------------------------------------------------

create type user_role as enum ('jefe', 'tecnico', 'trabajador');

create type solicitud_estado as enum (
  'en_espera',
  'en_proceso',
  'solucionado',
  'no_solucionado'
);

create type tecnico_estado as enum (
  'disponible',
  'atendiendo',
  'en_oficina',
  'virtual',
  'descanso'
);

create type ayuda_tipo as enum ('presencial', 'virtual');

-- -------------------------------------------------------------
-- PASO 2: Tablas (en orden de dependencia de FK)
-- -------------------------------------------------------------

create table areas (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  rol            user_role not null,
  dni            text,
  username       text not null unique,
  telefono       text,
  email          text,
  primer_ingreso boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table solicitudes (
  id            uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references profiles(id),
  area_id       uuid not null references areas(id),
  tipo_ayuda    ayuda_tipo not null,
  titulo        text not null,
  descripcion   text,
  estado        solicitud_estado not null default 'en_espera',
  tecnico_id    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table technician_status (
  tecnico_id              uuid primary key references profiles(id) on delete cascade,
  estado                  tecnico_estado not null default 'disponible',
  ubicacion               text,
  atendiendo_solicitud_id uuid references solicitudes(id),
  updated_at              timestamptz not null default now()
);

-- -------------------------------------------------------------
-- PASO 3: Trigger — crear perfil automáticamente al registrar usuario
-- -------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Validar campos obligatorios en los metadatos
  if (new.raw_user_meta_data->>'rol') is null then
    raise exception 'handle_new_user: raw_user_meta_data debe incluir "rol"';
  end if;
  if (new.raw_user_meta_data->>'username') is null then
    raise exception 'handle_new_user: raw_user_meta_data debe incluir "username"';
  end if;

  insert into public.profiles (id, rol, username, email)
  values (
    new.id,
    (new.raw_user_meta_data->>'rol')::user_role,
    new.raw_user_meta_data->>'username',
    new.email
  );

  -- Solo los técnicos tienen fila en technician_status
  if (new.raw_user_meta_data->>'rol') = 'tecnico' then
    insert into public.technician_status (tecnico_id)
    values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -------------------------------------------------------------
-- PASO 4: RLS — habilitar y definir políticas por tabla
-- -------------------------------------------------------------

-- areas -------------------------------------------------------
alter table areas enable row level security;

create policy "areas_select_authenticated"
  on areas for select
  to authenticated
  using (true);

-- profiles ----------------------------------------------------
alter table profiles enable row level security;

create policy "profiles_select_authenticated"
  on profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- solicitudes -------------------------------------------------
alter table solicitudes enable row level security;

-- trabajador: solo las suyas; técnico y jefe: todas
create policy "solicitudes_select"
  on solicitudes for select
  to authenticated
  using (
    trabajador_id = auth.uid()
    or (select rol from profiles where id = auth.uid()) in ('tecnico', 'jefe')
  );

-- solo el trabajador crea solicitudes, y solo a su nombre
create policy "solicitudes_insert_trabajador"
  on solicitudes for insert
  to authenticated
  with check (
    trabajador_id = auth.uid()
    and (select rol from profiles where id = auth.uid()) = 'trabajador'
  );

-- trabajador: actualiza sus propias solicitudes (cancelar, confirmar resolución)
create policy "solicitudes_update_trabajador"
  on solicitudes for update
  to authenticated
  using (
    trabajador_id = auth.uid()
    and (select rol from profiles where id = auth.uid()) = 'trabajador'
  )
  with check (trabajador_id = auth.uid());

-- técnico: actualiza las que ya tiene asignadas o las sin asignar en espera
-- (la segunda condición permite el flujo "Atender ahora" de SPEC 06)
create policy "solicitudes_update_tecnico"
  on solicitudes for update
  to authenticated
  using (
    (select rol from profiles where id = auth.uid()) = 'tecnico'
    and (
      tecnico_id = auth.uid()
      or (tecnico_id is null and estado = 'en_espera')
    )
  )
  with check (
    (select rol from profiles where id = auth.uid()) = 'tecnico'
  );

-- technician_status -------------------------------------------
alter table technician_status enable row level security;

-- técnico y jefe: ven todos los estados
create policy "technician_status_select"
  on technician_status for select
  to authenticated
  using (
    (select rol from profiles where id = auth.uid()) in ('tecnico', 'jefe')
  );

-- técnico: actualiza solo su propio estado
create policy "technician_status_update_own"
  on technician_status for update
  to authenticated
  using (
    tecnico_id = auth.uid()
    and (select rol from profiles where id = auth.uid()) = 'tecnico'
  )
  with check (tecnico_id = auth.uid());

-- -------------------------------------------------------------
-- PASO 5: Seed — áreas de prueba (reemplazables)
-- -------------------------------------------------------------

insert into areas (nombre) values
  ('Tesorería'),
  ('Urbanismo'),
  ('Rentas'),
  ('Secretaría General'),
  ('Recursos Humanos'),
  ('Logística');

-- -------------------------------------------------------------
-- PASO 6: Seed de usuarios de prueba
--
-- Los usuarios NO se crean con SQL directo: las contraseñas las
-- gestiona Supabase Auth. Crear los tres usuarios una sola vez
-- desde el Dashboard o con el Admin SDK, pasando los metadatos
-- exactos que se indican abajo. Reemplazar antes de producción.
--
-- OPCIÓN A — Supabase Dashboard
--   Authentication → Users → "Invite user" o "Add user"
--   Completar email, contraseña y añadir los User Metadata JSON.
--
-- OPCIÓN B — Admin SDK (Node.js / script)
--
--   const { createClient } = require('@supabase/supabase-js')
--   const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
--
--   await supabase.auth.admin.createUser({
--     email: 'jefe@muni-ica.gob.pe',
--     password: 'Jefe2026!',
--     user_metadata: { rol: 'jefe', username: 'jefe_informatica' },
--     email_confirm: true,
--   })
--
--   await supabase.auth.admin.createUser({
--     email: 'tecnico1@muni-ica.gob.pe',
--     password: 'Tecnico2026!',
--     user_metadata: { rol: 'tecnico', username: 'tecnico_01' },
--     email_confirm: true,
--   })
--
--   await supabase.auth.admin.createUser({
--     email: 'tecnico2@muni-ica.gob.pe',
--     password: 'Tecnico2026!',
--     user_metadata: { rol: 'tecnico', username: 'tecnico_02' },
--     email_confirm: true,
--   })
--
-- El trigger handle_new_user crea automáticamente la fila en
-- profiles (y en technician_status para los técnicos).
-- -------------------------------------------------------------
