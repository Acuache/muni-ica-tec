-- =============================================================
-- SPEC 12 — Limpieza automática de adjuntos
-- =============================================================
-- Borra a diario los adjuntos de solicitudes cerradas o con > 21 días,
-- llamando al Route Handler de Next.js que libera Storage con la Storage API.
-- Corre a las 05:30 UTC (00:30 America/Lima), un día tras otro.
--
-- IMPORTANTE: reemplazar <CRON_SECRET> por el valor real de CRON_SECRET
-- (ver .env.local) antes de ejecutar esto en el SQL Editor de Supabase.
-- No se commitea el valor real para no dejarlo en el historial de git.
--
-- Si el dominio de despliegue cambia, reprogramar con:
--   select cron.alter_job(
--     (select jobid from cron.job where jobname = 'limpiar-adjuntos'),
--     command := $$
--       select net.http_post(
--         url := 'https://<NUEVO_DOMINIO>/api/cron/adjuntos',
--         headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
--       );
--     $$
--   );

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'limpiar-adjuntos',
  '30 5 * * *', -- todos los días, 05:30 UTC = 00:30 America/Lima
  $$
  select net.http_post(
    url := 'https://muni-ica-tec.vercel.app/api/cron/adjuntos',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);
