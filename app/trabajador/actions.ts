'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ActionState = { error: string } | undefined

export async function crearSolicitud(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const tipo_ayuda = (formData.get('tipo_ayuda') as string | null) ?? ''
  const titulo = (formData.get('titulo') as string | null)?.trim() ?? ''
  const descripcion = (formData.get('descripcion') as string | null)?.trim() ?? ''
  const anydesk_code = (formData.get('anydesk_code') as string | null)?.trim() ?? ''

  if (!tipo_ayuda) return { error: 'Selecciona el tipo de ayuda.' }
  if (!titulo) return { error: 'El título no puede estar vacío.' }
  if (tipo_ayuda === 'virtual' && !/^\d+$/.test(anydesk_code)) {
    return { error: 'El código AnyDesk debe contener solo números.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada. Vuelve a iniciar sesión.' }

  const { error } = await supabase.from('solicitudes').insert({
    trabajador_id: user.id,
    tipo_ayuda,
    titulo,
    descripcion: descripcion || null,
    anydesk_code: tipo_ayuda === 'virtual' ? anydesk_code : null,
  })

  if (error) return { error: 'No se pudo crear la solicitud. Inténtalo de nuevo.' }

  redirect('/trabajador')
}

export async function cancelarSolicitud(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const solicitudId = (formData.get('solicitud_id') as string | null) ?? ''

  if (!solicitudId) return { error: 'Solicitud no identificada.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada.' }

  const { error } = await supabase
    .from('solicitudes')
    .update({ estado: 'cancelado' })
    .eq('id', solicitudId)
    .eq('trabajador_id', user.id)
    .eq('estado', 'en_espera')

  if (error) return { error: 'No se pudo cancelar la solicitud.' }

  redirect('/trabajador')
}

export async function confirmarResolucion(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const solicitudId = (formData.get('solicitud_id') as string | null) ?? ''
  const resultado = (formData.get('resultado') as string | null) ?? ''

  if (!solicitudId) return { error: 'Solicitud no identificada.' }
  if (resultado !== 'solucionado' && resultado !== 'no_solucionado') {
    return { error: 'Resultado no válido.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada.' }

  if (resultado === 'no_solucionado') {
    const { error } = await supabase
      .from('solicitudes')
      .update({ estado: 'no_solucionado' })
      .eq('id', solicitudId)
      .eq('trabajador_id', user.id)
      .eq('estado', 'en_proceso')
    if (error) return { error: 'No se pudo guardar la resolución. Inténtalo de nuevo.' }
  } else {
    const { data: fila } = await supabase
      .from('solicitudes')
      .select('confirmacion_tecnico')
      .eq('id', solicitudId)
      .eq('trabajador_id', user.id)
      .eq('estado', 'en_proceso')
      .single()

    const updates = fila?.confirmacion_tecnico
      ? { confirmacion_trabajador: true, estado: 'solucionado' }
      : { confirmacion_trabajador: true }

    const { error } = await supabase
      .from('solicitudes')
      .update(updates)
      .eq('id', solicitudId)
      .eq('trabajador_id', user.id)
      .eq('estado', 'en_proceso')
    if (error) return { error: 'No se pudo guardar la resolución. Inténtalo de nuevo.' }
  }

  redirect('/trabajador')
}
