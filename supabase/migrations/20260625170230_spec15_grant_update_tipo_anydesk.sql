-- =============================================================
-- SPEC 15 — Privilegios de columna: tipo_ayuda y anydesk_code
-- =============================================================
-- SPEC 10 (H-29) acotó el UPDATE de public.solicitudes por columna a
-- (estado, tecnico_id, confirmacion_trabajador, confirmacion_tecnico) para el
-- rol authenticated. SPEC 15 incorpora dos escrituras nuevas sobre solicitudes:
--   • el técnico cambia tipo_ayuda (presencial↔virtual) mientras atiende y
--     limpia anydesk_code al volver a presencial (cambiarTipoAyuda);
--   • el trabajador registra anydesk_code cuando su caso quedó virtual sin
--     código (registrarAnydeskCode, modal obligatorio "esperando código").
-- Sin estos privilegios el UPDATE falla con 42501 (permission denied for table
-- solicitudes). Mismo patrón que SPEC 13 con profiles.subarea.
--
-- Las FILAS siguen acotadas por las políticas RLS existentes
-- (solicitudes_update_trabajador / solicitudes_update_tecnico): un trabajador
-- solo toca sus propias solicitudes; un técnico, las que atiende o las libres
-- en espera. Esto solo abre las dos COLUMNAS, no nuevas filas.

grant update (tipo_ayuda, anydesk_code)
  on public.solicitudes to authenticated;
