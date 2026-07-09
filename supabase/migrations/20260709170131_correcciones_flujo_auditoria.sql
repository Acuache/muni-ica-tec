-- =============================================================
-- Correcciones de flujo (auditoría 2026-07)
-- =============================================================

-- -------------------------------------------------------------
-- 1) Cierre atómico de la doble confirmación (SPEC 08)
-- -------------------------------------------------------------
-- Las actions hacen read-then-write: leen la confirmación del otro y deciden
-- si cierran. Si trabajador y técnico confirman a la vez, cada uno lee false,
-- ambos UPDATE marcan solo su flag y nadie pone 'solucionado': la solicitud
-- queda en_proceso con ambas confirmaciones en true, invisible para el
-- trabajador. El trigger cierra en la base, donde la carrera no existe, y
-- encadena con solicitud_cierre_reset_tecnico (libera al técnico).

create or replace function public.cerrar_solicitud_confirmada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estado = 'en_proceso'
     and new.confirmacion_trabajador
     and new.confirmacion_tecnico then
    new.estado := 'solucionado';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solicitudes_cierre_confirmado on solicitudes;
create trigger trg_solicitudes_cierre_confirmado
  before update on solicitudes
  for each row execute procedure public.cerrar_solicitud_confirmada();

revoke execute on function public.cerrar_solicitud_confirmada()
  from public, anon, authenticated;

-- Destrabar filas que ya hubieran caído en la carrera (verificado: hoy 0).
update solicitudes
   set estado = 'solucionado'
 where estado = 'en_proceso'
   and confirmacion_trabajador
   and confirmacion_tecnico;

-- -------------------------------------------------------------
-- 2) SPEC 15: "esperando código" fuera de la cola también en la base
-- -------------------------------------------------------------
-- El panel del técnico aparta los casos virtual ∧ sin código (FILTRO_TOMABLE),
-- pero la RPC atender_solicitud permitía tomarlos por request manual y
-- get_posicion_en_cola los contaba delante del trabajador. Se alinean ambas.

create or replace function get_posicion_en_cola(p_solicitud_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from solicitudes
  where estado = 'en_espera'
    and not (tipo_ayuda = 'virtual' and anydesk_code is null)
    and created_at < (
      select created_at from solicitudes where id = p_solicitud_id
    );
$$;

create or replace function public.atender_solicitud(p_solicitud_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update solicitudes
     set estado = 'en_proceso',
         tecnico_id = auth.uid()
   where id = p_solicitud_id
     and estado = 'en_espera'
     and tecnico_id is null
     and not (tipo_ayuda = 'virtual' and anydesk_code is null);

  if not found then
    return false;
  end if;

  update technician_status
     set estado = 'atendiendo',
         atendiendo_solicitud_id = p_solicitud_id
   where tecnico_id = auth.uid();

  if not found then
    insert into technician_status (tecnico_id, estado, atendiendo_solicitud_id)
    values (auth.uid(), 'atendiendo', p_solicitud_id);
  end if;

  return true;
end;
$$;

-- -------------------------------------------------------------
-- 3) Validar el CHECK de puesto (cierra el "grandfathered" de SPEC 13)
-- -------------------------------------------------------------
-- Ya no quedan filas con puesto fuera del catálogo (verificado). El CHECK
-- NOT VALID igual se evaluaba en cada UPDATE de una fila vieja (bloqueándola),
-- y la UI ofrecía una opción imposible de guardar; se valida y se retira esa
-- opción del perfil.

alter table profiles validate constraint profiles_puesto_check;
