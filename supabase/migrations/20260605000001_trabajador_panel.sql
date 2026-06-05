-- SPEC 05 — Trabajador: pedir y seguir ayuda
-- ─────────────────────────────────────────
-- NOTA: ALTER TYPE ... ADD VALUE no puede ejecutarse dentro de una transacción.
-- Supabase CLI envuelve las migraciones en transacciones por defecto.
-- Si el push falla con "unsafe use of new value", ejecutar este bloque
-- directamente en Dashboard → SQL Editor fuera de una transacción.

alter type solicitud_estado add value if not exists 'cancelado';

-- ─────────────────────────────────────────
-- RPC: get_posicion_en_cola
-- Devuelve cuántas solicitudes en_espera fueron creadas antes que la indicada.
-- SECURITY DEFINER permite contar filas ajenas sin exponer el RLS del trabajador.
-- ─────────────────────────────────────────

create or replace function get_posicion_en_cola(p_solicitud_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from solicitudes
  where estado = 'en_espera'
    and created_at < (
      select created_at from solicitudes where id = p_solicitud_id
    );
$$;
