'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ActionState = { error: string } | undefined

export async function marcarSolucionado(
  { solicitudId }: { solicitudId: string },
): Promise<ActionState> {
  if (!solicitudId) return { error: 'Solicitud no identificada.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada.' }

  const admin = createAdminClient()

  const { data: fila } = await admin
    .from('solicitudes')
    .select('estado, confirmacion_trabajador, confirmacion_tecnico')
    .eq('id', solicitudId)
    .single()

  if (!fila) return { error: 'No se encontró la solicitud.' }
  if (fila.estado !== 'en_proceso') {
    return { error: 'La solicitud no está en proceso.' }
  }
  if (!fila.confirmacion_trabajador && !fila.confirmacion_tecnico) {
    return { error: 'Ninguna de las partes ha confirmado la resolución.' }
  }

  const { error } = await admin
    .from('solicitudes')
    .update({ confirmacion_trabajador: true, confirmacion_tecnico: true, estado: 'solucionado' })
    .eq('id', solicitudId)

  if (error) return { error: 'No se pudo marcar la solicitud como solucionada.' }
}

export async function marcarTodosSolucionados(): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada.' }

  const admin = createAdminClient()

  const { error } = await admin
    .from('solicitudes')
    .update({ confirmacion_trabajador: true, confirmacion_tecnico: true, estado: 'solucionado' })
    .eq('estado', 'en_proceso')
    .or('confirmacion_trabajador.eq.true,confirmacion_tecnico.eq.true')

  if (error) return { error: 'No se pudieron marcar las solicitudes como solucionadas.' }
}

export async function cancelarSolicitudJefe(
  { solicitudId }: { solicitudId: string },
): Promise<ActionState> {
  if (!solicitudId) return { error: 'Solicitud no identificada.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada.' }

  const admin = createAdminClient()

  const { error } = await admin
    .from('solicitudes')
    .update({ estado: 'cancelado' })
    .eq('id', solicitudId)
    .eq('estado', 'en_espera')

  if (error) return { error: 'No se pudo cancelar la solicitud.' }
}
