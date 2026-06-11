-- =============================================================
-- SPEC 09 — Reportes mensuales del jefe
-- =============================================================
-- Programa la generación automática mensual del reporte: el día 1 de cada
-- mes a las 05:10 UTC (00:10 America/Lima) llama al Route Handler de Next.js
-- que genera el reporte del mes que acaba de cerrar.
--
-- IMPORTANTE: reemplazar <CRON_SECRET> por el valor real de CRON_SECRET
-- (ver .env.local) antes de ejecutar esto en el SQL Editor de Supabase.
-- No se commitea el valor real para no dejarlo en el historial de git.
--
-- Si el dominio de despliegue cambia, reprogramar con:
--   select cron.alter_job(
--     (select jobid from cron.job where jobname = 'generar-reporte-mensual'),
--     command := $$
--       select net.http_post(
--         url := 'https://<NUEVO_DOMINIO>/api/cron/reportes',
--         headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
--       );
--     $$
--   );

select cron.schedule(
  'generar-reporte-mensual',
  '10 5 1 * *', -- día 1 de cada mes, 05:10 UTC = 00:10 America/Lima
  $$
  select net.http_post(
    url := 'https://muni-ica-tec.vercel.app/api/cron/reportes',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);
