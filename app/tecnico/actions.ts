'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ActionState = { error: string } | undefined

type TecnicoEstadoManual = 'disponible' | 'en_oficina' | 'virtual' | 'descanso'

const ESTADOS_MANUALES: TecnicoEstadoManual[] = [
  'disponible',
  'en_oficina',
  'virtual',
  'descanso',
]

export async function cambiarEstado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const estado = (formData.get('estado') as string | null) ?? ''

  if (!ESTADOS_MANUALES.includes(estado as TecnicoEstadoManual)) {
    return { error: 'Estado no válido.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada.' }

  const { data: current } = await supabase
    .from('technician_status')
    .select('estado')
    .eq('tecnico_id', user.id)
    .single()

  if (current?.estado === 'atendiendo') {
    return {
      error: 'No puedes cambiar tu estado mientras estás atendiendo una solicitud.',
    }
  }

  const { error } = await supabase
    .from('technician_status')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('tecnico_id', user.id)

  if (error) return { error: 'No se pudo actualizar el estado.' }

  redirect('/tecnico')
}

export async function atenderAhora(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const solicitudId = (formData.get('solicitud_id') as string | null) ?? ''
  if (!solicitudId) return { error: 'Solicitud no identificada.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada.' }

  // UPDATE condicional — first-write-wins
  const { data, error } = await supabase
    .from('solicitudes')
    .update({ estado: 'en_proceso', tecnico_id: user.id })
    .eq('id', solicitudId)
    .eq('estado', 'en_espera')
    .select('id')

  if (error) return { error: 'No se pudo tomar la solicitud.' }

  if (!data || data.length === 0) {
    // Otro técnico llegó primero — el cliente mostrará el toast y refrescará
    return { error: 'Este turno ya fue tomado por otro técnico.' }
  }

  const { error: statusError } = await supabase
    .from('technician_status')
    .update({
      estado: 'atendiendo',
      atendiendo_solicitud_id: solicitudId,
      updated_at: new Date().toISOString(),
    })
    .eq('tecnico_id', user.id)

  if (statusError) return { error: 'No se pudo actualizar tu estado.' }

  redirect('/tecnico')
}

export async function liberarSolicitud(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const solicitudId = (formData.get('solicitud_id') as string | null) ?? ''
  if (!solicitudId) return { error: 'Solicitud no identificada.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada.' }

  const { error: solError } = await supabase
    .from('solicitudes')
    .update({ estado: 'en_espera', tecnico_id: null })
    .eq('id', solicitudId)
    .eq('tecnico_id', user.id)

  if (solError) return { error: 'No se pudo liberar la solicitud.' }

  const { error: statusError } = await supabase
    .from('technician_status')
    .update({
      estado: 'disponible',
      atendiendo_solicitud_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tecnico_id', user.id)

  if (statusError) return { error: 'No se pudo actualizar tu estado.' }

  redirect('/tecnico')
}
