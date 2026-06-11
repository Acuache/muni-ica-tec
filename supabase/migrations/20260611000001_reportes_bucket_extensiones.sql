-- =============================================================
-- SPEC 09 — Reportes mensuales del jefe
-- =============================================================
-- Bucket privado de Storage para los PDFs mensuales y extensiones
-- necesarias para programar la generación automática (pg_cron + pg_net).

insert into storage.buckets (id, name, public)
values ('reportes', 'reportes', false)
on conflict (id) do nothing;

create extension if not exists pg_cron;
create extension if not exists pg_net;
