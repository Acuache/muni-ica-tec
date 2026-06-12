'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { autorizar } from '@/lib/autorizacion'
import { esUuidValido } from '@/lib/validacion'

export type ActionState = { error: string } | undefined

export async function marcarSolucionado(
  { solicitudId }: { solicitudId: string },
): Promise<ActionState> {
  if (!esUuidValido(solicitudId)) return { error: 'Solicitud no identificada.' }

  // Estas actions usan el cliente service-role (sin RLS): la verificación
  // de rol en el servidor es la única barrera. No quitarla.
  const auth = await autorizar(['jefe'])
  if (!auth.ok) return { error: auth.error }

  const admin = createAdminClient()

  const { data: fila, error: filaError } = await admin
    .from('solicitudes')
    .select('estado, confirmacion_trabajador, confirmacion_tecnico')
    .eq('id', solicitudId)
    .maybeSingle()

  if (filaError) return { error: 'No se pudo marcar la solicitud como solucionada.' }
  if (!fila) return { error: 'No se encontró la solicitud.' }
  if (fila.estado !== 'en_proceso') {
    return { error: 'La solicitud no está en proceso.' }
  }
  if (!fila.confirmacion_trabajador && !fila.confirmacion_tecnico) {
    return { error: 'Ninguna de las partes ha confirmado la resolución.' }
  }

  // Condicionado al estado leído: si cambió entre la lectura y el update
  // (lo cerró otro actor), 0 filas → error claro, sin pisar nada.
  const { data, error } = await admin
    .from('solicitudes')
    .update({ confirmacion_trabajador: true, confirmacion_tecnico: true, estado: 'solucionado' })
    .eq('id', solicitudId)
    .eq('estado', 'en_proceso')
    .select('id')

  if (error) return { error: 'No se pudo marcar la solicitud como solucionada.' }
  if (!data || data.length === 0) {
    return { error: 'La solicitud ya cambió de estado. Actualiza la página.' }
  }
}

export async function marcarTodosSolucionados(): Promise<ActionState> {
  const auth = await autorizar(['jefe'])
  if (!auth.ok) return { error: auth.error }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('solicitudes')
    .update({ confirmacion_trabajador: true, confirmacion_tecnico: true, estado: 'solucionado' })
    .eq('estado', 'en_proceso')
    .or('confirmacion_trabajador.eq.true,confirmacion_tecnico.eq.true')
    .select('id')

  if (error) return { error: 'No se pudieron marcar las solicitudes como solucionadas.' }
  // 0 candidatas (cambiaron entre el render y el clic): aviso, no fallo mudo.
  if (!data || data.length === 0) {
    return { error: 'No había solicitudes pendientes de marcar. Actualiza la página.' }
  }
}

export async function cancelarSolicitudJefe(
  { solicitudId }: { solicitudId: string },
): Promise<ActionState> {
  if (!esUuidValido(solicitudId)) return { error: 'Solicitud no identificada.' }

  const auth = await autorizar(['jefe'])
  if (!auth.ok) return { error: auth.error }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('solicitudes')
    .update({ estado: 'cancelado' })
    .eq('id', solicitudId)
    .eq('estado', 'en_espera')
    .select('id')

  if (error) return { error: 'No se pudo cancelar la solicitud.' }
  if (!data || data.length === 0) {
    return { error: 'La solicitud ya no está en espera. Actualiza la página.' }
  }
}
