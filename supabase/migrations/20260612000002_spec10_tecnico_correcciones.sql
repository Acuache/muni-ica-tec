-- =============================================================
-- SPEC 10 (H-16/H-17/H-18) — Correcciones del panel del técnico
-- =============================================================

-- -------------------------------------------------------------
-- H-16: updated_at nunca se actualizaba
-- -------------------------------------------------------------
-- Ninguna action seteaba updated_at en solicitudes y no había trigger:
-- la columna quedaba congelada en el valor del insert, y la métrica
-- "finalizadas hoy" (filtra por updated_at) solo contaba solicitudes
-- creadas hoy. El trigger lo garantiza para todo UPDATE, venga del
-- cliente con RLS o del service-role.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_solicitudes_updated_at on solicitudes;
create trigger trg_solicitudes_updated_at
  before update on solicitudes
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_technician_status_updated_at on technician_status;
create trigger trg_technician_status_updated_at
  before update on technician_status
  for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------------
-- H-17: técnico sin fila en technician_status
-- -------------------------------------------------------------
-- El trigger handle_new_user crea la fila, pero si falta (usuario creado
-- antes del trigger, fila borrada a mano) no había política INSERT y el
-- técnico no podía recuperarse. Se le permite crear solo SU propia fila.

create policy "technician_status_insert_own"
  on technician_status for insert
  to authenticated
  with check (
    tecnico_id = auth.uid()
    and (select rol from profiles where id = auth.uid()) = 'tecnico'
  );

-- -------------------------------------------------------------
-- H-18: asignación atómica de "Atender ahora"
-- -------------------------------------------------------------
-- La action hacía el UPDATE condicional de solicitudes y luego, por
-- separado, el de technician_status: un fallo intermedio dejaba la
-- solicitud asignada con el técnico aún "disponible". La función hace
-- ambos en una transacción. SECURITY INVOKER: las políticas RLS del
-- técnico siguen aplicando dentro.
-- Devuelve true si este técnico se quedó con la solicitud; false si
-- otro llegó primero (o ya no está en espera).

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
     and tecnico_id is null;

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
