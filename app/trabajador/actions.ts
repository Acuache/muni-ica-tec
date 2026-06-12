'use server'

import { redirect } from 'next/navigation'
import { autorizar } from '@/lib/autorizacion'
import {
  esAnydeskValido,
  esUuidValido,
  MAX_TEXTO_CORTO,
  MAX_TEXTO_LARGO,
} from '@/lib/validacion'

export type ActionState = { error: string } | undefined

export async function crearSolicitud(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const tipo_ayuda = (formData.get('tipo_ayuda') as string | null) ?? ''
  const titulo = (formData.get('titulo') as string | null)?.trim() ?? ''
  const descripcion = (formData.get('descripcion') as string | null)?.trim() ?? ''
  const anydesk_code = (formData.get('anydesk_code') as string | null)?.trim() ?? ''

  if (tipo_ayuda !== 'presencial' && tipo_ayuda !== 'virtual') {
    return { error: 'Selecciona el tipo de ayuda.' }
  }
  if (!titulo) return { error: 'El título no puede estar vacío.' }
  if (titulo.length > MAX_TEXTO_CORTO) {
    return { error: `El título no puede superar ${MAX_TEXTO_CORTO} caracteres.` }
  }
  if (descripcion.length > MAX_TEXTO_LARGO) {
    return { error: `La descripción no puede superar ${MAX_TEXTO_LARGO} caracteres.` }
  }
  if (tipo_ayuda === 'virtual' && !esAnydeskValido(anydesk_code)) {
    return { error: 'El código AnyDesk debe contener solo números.' }
  }

  const auth = await autorizar(['trabajador'])
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth

  const { error } = await supabase.from('solicitudes').insert({
    trabajador_id: user.id,
    tipo_ayuda,
    titulo,
    descripcion: descripcion || null,
    anydesk_code: tipo_ayuda === 'virtual' ? anydesk_code : null,
  })

  if (error) {
    // Índice único parcial: una sola solicitud activa por trabajador.
    if (error.code === '23505') {
      return { error: 'Ya tienes una solicitud activa. Actualiza la página para verla.' }
    }
    return { error: 'No se pudo crear la solicitud. Inténtalo de nuevo.' }
  }

  redirect('/trabajador')
}

export async function cancelarSolicitud(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const solicitudId = (formData.get('solicitud_id') as string | null) ?? ''

  if (!esUuidValido(solicitudId)) return { error: 'Solicitud no identificada.' }

  const auth = await autorizar(['trabajador'])
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth

  const { data, error } = await supabase
    .from('solicitudes')
    .update({ estado: 'cancelado' })
    .eq('id', solicitudId)
    .eq('trabajador_id', user.id)
    .eq('estado', 'en_espera')
    .select('id')

  if (error) return { error: 'No se pudo cancelar la solicitud.' }

  // 0 filas afectadas: la solicitud ya no está en espera (la tomó un
  // técnico o ya se cerró por otra vía).
  if (!data || data.length === 0) {
    return { error: 'La solicitud ya no está en espera: un técnico la tomó o ya fue cerrada. Actualiza la página.' }
  }

  redirect('/trabajador')
}

export async function confirmarResolucion(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const solicitudId = (formData.get('solicitud_id') as string | null) ?? ''
  const resultado = (formData.get('resultado') as string | null) ?? ''

  if (!esUuidValido(solicitudId)) return { error: 'Solicitud no identificada.' }
  if (resultado !== 'solucionado' && resultado !== 'no_solucionado') {
    return { error: 'Resultado no válido.' }
  }

  const auth = await autorizar(['trabajador'])
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth

  const yaCerrada =
    'Esta solicitud ya fue cerrada o cambió de estado. Actualiza la página.'

  if (resultado === 'no_solucionado') {
    const { data, error } = await supabase
      .from('solicitudes')
      .update({ estado: 'no_solucionado' })
      .eq('id', solicitudId)
      .eq('trabajador_id', user.id)
      .eq('estado', 'en_proceso')
      .select('id')
    if (error) return { error: 'No se pudo guardar la resolución. Inténtalo de nuevo.' }
    if (!data || data.length === 0) return { error: yaCerrada }
  } else {
    const { data: fila, error: filaError } = await supabase
      .from('solicitudes')
      .select('confirmacion_tecnico')
      .eq('id', solicitudId)
      .eq('trabajador_id', user.id)
      .eq('estado', 'en_proceso')
      .maybeSingle()

    if (filaError) return { error: 'No se pudo guardar la resolución. Inténtalo de nuevo.' }
    if (!fila) return { error: yaCerrada }

    const updates = fila.confirmacion_tecnico
      ? { confirmacion_trabajador: true, estado: 'solucionado' }
      : { confirmacion_trabajador: true }

    const { data, error } = await supabase
      .from('solicitudes')
      .update(updates)
      .eq('id', solicitudId)
      .eq('trabajador_id', user.id)
      .eq('estado', 'en_proceso')
      .select('id')
    if (error) return { error: 'No se pudo guardar la resolución. Inténtalo de nuevo.' }
    if (!data || data.length === 0) return { error: yaCerrada }
  }

  redirect('/trabajador')
}
