-- =============================================================
-- El trabajador que ya confirmó no queda bloqueado por el técnico
-- =============================================================
-- Si el trabajador confirma "Resuelto" y el técnico se olvida de confirmar,
-- la solicitud queda en_proceso indefinidamente y el trabajador no podía
-- pedir ayuda de nuevo. Una solicitud con confirmacion_trabajador = true deja
-- de contar como "activa" para el índice único: el trabajador vuelve al
-- formulario y el caso viejo queda a la espera del cierre del técnico (o del
-- jefe, que puede marcarlo Solucionado con una sola confirmación). El trigger
-- cerrar_solicitud_confirmada lo cierra solo en cuanto el técnico confirme.
--
-- El predicado nuevo es un subconjunto del anterior, así que la recreación
-- no puede fallar por duplicados.

drop index if exists solicitudes_trabajador_activa_unica;

create unique index solicitudes_trabajador_activa_unica
  on solicitudes (trabajador_id)
  where estado = 'en_espera'
     or (estado = 'en_proceso' and not confirmacion_trabajador);
