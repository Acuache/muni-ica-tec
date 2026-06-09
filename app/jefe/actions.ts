'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ActionState = { error: string } | undefined

export async function toggleConfirmacionJefe(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const solicitudId = (formData.get('solicitud_id') as string | null) ?? ''
  const campo = (formData.get('campo') as string | null) ?? ''
  const valor = formData.get('valor') === 'true'

  if (!solicitudId) return { error: 'Solicitud no identificada.' }
  if (campo !== 'trabajador' && campo !== 'tecnico') return { error: 'Campo no válido.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada.' }

  const columna = campo === 'trabajador' ? 'confirmacion_trabajador' : 'confirmacion_tecnico'

  const admin = createAdminClient()

  const { error: updateError } = await admin
    .from('solicitudes')
    .update({ [columna]: valor })
    .eq('id', solicitudId)

  if (updateError) return { error: 'No se pudo actualizar la confirmación.' }

  // Releer ambas columnas y el estado actual para aplicar la regla de transición
  const { data: fila } = await admin
    .from('solicitudes')
    .select('confirmacion_trabajador, confirmacion_tecnico, estado')
    .eq('id', solicitudId)
    .single()

  if (!fila) return { error: 'No se encontró la solicitud.' }

  if (fila.confirmacion_trabajador && fila.confirmacion_tecnico) {
    await admin
      .from('solicitudes')
      .update({ estado: 'solucionado' })
      .eq('id', solicitudId)
  } else if (!valor && fila.estado === 'solucionado') {
    // Se desmarcó una confirmación — el cierre deja de ser válido
    await admin
      .from('solicitudes')
      .update({ estado: 'en_proceso' })
      .eq('id', solicitudId)
  }
}

export async function forzarEstado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const solicitudId = (formData.get('solicitud_id') as string | null) ?? ''
  const estado = (formData.get('estado') as string | null) ?? ''

  if (!solicitudId) return { error: 'Solicitud no identificada.' }
  if (estado !== 'solucionado' && estado !== 'no_solucionado') {
    return { error: 'Estado no válido.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada.' }

  const admin = createAdminClient()

  const updates =
    estado === 'solucionado'
      ? { estado, confirmacion_trabajador: true, confirmacion_tecnico: true }
      : { estado }

  const { error } = await admin
    .from('solicitudes')
    .update(updates)
    .eq('id', solicitudId)

  if (error) return { error: 'No se pudo forzar el estado.' }
}
