-- =============================================================
-- SPEC 10 (H-12) — Unicidad de solicitud activa por trabajador
-- =============================================================
-- El panel del trabajador asume una sola solicitud activa (en_espera o
-- en_proceso) por persona, pero nada lo garantizaba en la base: un doble
-- submit (p. ej. desde dos pestañas) creaba duplicados invisibles para la
-- UI. El índice único parcial lo hace atómico; la action traduce el error
-- 23505 en "Ya tienes una solicitud activa".

-- Saneamiento previo: si ya existieran duplicados activos, se conserva la
-- que está en proceso (o la más reciente) y se cancelan las demás, para que
-- la creación del índice no falle.
with duplicadas as (
  select id,
         row_number() over (
           partition by trabajador_id
           order by (estado = 'en_proceso') desc, created_at desc
         ) as rn
  from solicitudes
  where estado in ('en_espera', 'en_proceso')
)
update solicitudes
   set estado = 'cancelado'
 where id in (select id from duplicadas where rn > 1);

create unique index if not exists solicitudes_trabajador_activa_unica
  on solicitudes (trabajador_id)
  where estado in ('en_espera', 'en_proceso');
