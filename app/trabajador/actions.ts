'use server'

import { redirect } from 'next/navigation'
import { autorizar } from '@/lib/autorizacion'
import {
  esAnydeskValido,
  esUuidValido,
  MAX_TEXTO_CORTO,
  MAX_TEXTO_LARGO,
} from '@/lib/validacion'
import { IMG_MAX_BYTES, PDF_MAX_BYTES } from '@/lib/adjuntos/comprimir'
import type { AdjuntoMeta } from '@/lib/adjuntos/tipos'

export type ActionState = { error: string } | undefined

// crearSolicitud ya no redirige: devuelve el id para que el cliente suba los
// adjuntos a la carpeta de esa solicitud y luego refresque (SPEC 12).
export type CrearSolicitudState =
  | { error: string }
  | { ok: true; solicitudId: string }
  | undefined

export async function crearSolicitud(
  _prevState: CrearSolicitudState,
  formData: FormData,
): Promise<CrearSolicitudState> {
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

  const { data, error } = await supabase
    .from('solicitudes')
    .insert({
      trabajador_id: user.id,
      tipo_ayuda,
      titulo,
      descripcion: descripcion || null,
      anydesk_code: tipo_ayuda === 'virtual' ? anydesk_code : null,
    })
    .select('id')
    .single()

  if (error || !data) {
    // Índice único parcial: una sola solicitud activa por trabajador.
    if (error?.code === '23505') {
      return { error: 'Ya tienes una solicitud activa. Actualiza la página para verla.' }
    }
    return { error: 'No se pudo crear la solicitud. Inténtalo de nuevo.' }
  }

  return { ok: true, solicitudId: data.id }
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

/**
 * Registra en `solicitud_adjuntos` los archivos que el navegador ya subió a
 * Storage (SPEC 12). No sube bytes: solo metadatos. La propiedad de la
 * solicitud la garantizan el RLS de inserción y esta verificación explícita.
 */
export async function registrarAdjuntos(
  solicitudId: string,
  adjuntos: AdjuntoMeta[],
): Promise<{ ok: true } | { error: string }> {
  if (!esUuidValido(solicitudId)) return { error: 'Solicitud no identificada.' }
  if (!Array.isArray(adjuntos) || adjuntos.length === 0) {
    return { error: 'No hay archivos para registrar.' }
  }

  const prefijo = `${solicitudId}/`
  for (const a of adjuntos) {
    if (a.tipo !== 'imagen' && a.tipo !== 'pdf') {
      return { error: 'Tipo de archivo no válido.' }
    }
    if (typeof a.storage_path !== 'string' || !a.storage_path.startsWith(prefijo)) {
      return { error: 'Ruta de archivo no válida.' }
    }
    if (
      typeof a.nombre_original !== 'string' ||
      !a.nombre_original.trim() ||
      a.nombre_original.length > 255
    ) {
      return { error: 'Nombre de archivo no válido.' }
    }
    const max = a.tipo === 'pdf' ? PDF_MAX_BYTES : IMG_MAX_BYTES
    if (!Number.isFinite(a.tamano_bytes) || a.tamano_bytes <= 0 || a.tamano_bytes > max) {
      return { error: 'Tamaño de archivo no válido.' }
    }
  }

  const auth = await autorizar(['trabajador'])
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth

  const { data: solicitud, error: solError } = await supabase
    .from('solicitudes')
    .select('id')
    .eq('id', solicitudId)
    .eq('trabajador_id', user.id)
    .maybeSingle()
  if (solError) return { error: 'No se pudieron registrar los archivos. Inténtalo de nuevo.' }
  if (!solicitud) return { error: 'La solicitud no es tuya o ya no existe.' }

  const filas = adjuntos.map((a) => ({
    solicitud_id: solicitudId,
    tipo: a.tipo,
    storage_path: a.storage_path,
    nombre_original: a.nombre_original.trim(),
    tamano_bytes: Math.round(a.tamano_bytes),
  }))

  const { error } = await supabase.from('solicitud_adjuntos').insert(filas)
  if (error) return { error: 'No se pudieron registrar los archivos. Inténtalo de nuevo.' }

  return { ok: true }
}
