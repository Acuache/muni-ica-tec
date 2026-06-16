-- =============================================================
-- SPEC 12 — Adjuntos en solicitudes: imágenes (webp) y PDF
-- =============================================================
-- Tabla para rastrear cada archivo + bucket privado de Storage.
-- El cron de limpieza (borrado de cerradas / vencidas) va en una
-- migración aparte: 20260616000002_spec12_adjuntos_cron.sql.

-- -------------------------------------------------------------
-- PASO 1: Tabla solicitud_adjuntos
-- -------------------------------------------------------------

create table solicitud_adjuntos (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references solicitudes(id) on delete cascade,
  tipo            text not null check (tipo in ('imagen', 'pdf')),
  storage_path    text not null unique,        -- '{solicitud_id}/{uuid}.webp' | '.pdf'
  nombre_original text not null,               -- lo que ve el jefe/técnico
  tamano_bytes    integer not null,
  created_at      timestamptz not null default now()
);

create index on solicitud_adjuntos (solicitud_id);

-- -------------------------------------------------------------
-- PASO 2: Bucket privado de Storage
-- -------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('solicitud-adjuntos', 'solicitud-adjuntos', false)
on conflict (id) do nothing;

-- -------------------------------------------------------------
-- PASO 3: RLS de solicitud_adjuntos
-- -------------------------------------------------------------

alter table solicitud_adjuntos enable row level security;

-- SELECT: técnico y jefe ven todos; trabajador solo los de sus solicitudes.
create policy "solicitud_adjuntos_select"
  on solicitud_adjuntos for select
  to authenticated
  using (
    (select rol from profiles where id = (select auth.uid())) in ('tecnico', 'jefe')
    or exists (
      select 1 from solicitudes s
      where s.id = solicitud_id
        and s.trabajador_id = (select auth.uid())
    )
  );

-- INSERT: solo el trabajador dueño de la solicitud puede registrar adjuntos.
create policy "solicitud_adjuntos_insert_trabajador"
  on solicitud_adjuntos for insert
  to authenticated
  with check (
    (select rol from profiles where id = (select auth.uid())) = 'trabajador'
    and exists (
      select 1 from solicitudes s
      where s.id = solicitud_id
        and s.trabajador_id = (select auth.uid())
    )
  );

-- UPDATE/DELETE: nadie autenticado. El borrado lo hace el cron con service_role.
revoke update, delete on table public.solicitud_adjuntos from anon, authenticated;

-- -------------------------------------------------------------
-- PASO 4: Política de Storage — subida del trabajador
-- -------------------------------------------------------------
-- El primer segmento de la ruta es el solicitud_id. Solo se permite
-- subir a la carpeta de una solicitud propia. Se compara como texto
-- para no lanzar excepción ante rutas malformadas de otros buckets.
-- La lectura (descarga) usa URL firmada generada con el cliente admin
-- en el servidor, por eso no hay política SELECT pública.

create policy "adjuntos_storage_insert_trabajador"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'solicitud-adjuntos'
    and (select rol from profiles where id = (select auth.uid())) = 'trabajador'
    and exists (
      select 1 from public.solicitudes s
      where s.id::text = (storage.foldername(name))[1]
        and s.trabajador_id = (select auth.uid())
    )
  );
