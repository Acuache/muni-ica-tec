-- =============================================================
-- SPEC 11 (cierre) — Eliminar el helper temporal de medición
-- =============================================================
-- Revierte 20260615000001: la función explain_sql() solo existió para medir
-- los EXPLAIN durante la auditoría de rendimiento. No debe quedar en
-- producción (SECURITY DEFINER + SQL dinámico). Las mediciones quedaron en
-- specs/11-resultados.md.

drop function if exists public.explain_sql(text, boolean);
