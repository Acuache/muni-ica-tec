'use server'

import { autorizar } from '@/lib/autorizacion'
import { esUuidValido } from '@/lib/validacion'

export type ActionState = { error: string } | undefined

type TecnicoEstadoManual = 'disponible' | 'en_oficina' | 'virtual' | 'descanso'

const ESTADOS_MANUALES: TecnicoEstadoManual[] = [
  'disponible',
  'en_oficina',
  'virtual',
  'descanso',
]

const TIPOS_AYUDA = ['presencial', 'virtual'] as const
type TipoAyuda = (typeof TIPOS_AYUDA)[number]

export async function cambiarEstado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const estado = (formData.get('estado') as string | null) ?? ''

  if (!ESTADOS_MANUALES.includes(estado as TecnicoEstadoManual)) {
    return { error: 'Estado no válido.' }
  }

  const auth = await autorizar(['tecnico'])
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth

  const { data: current, error: currentError } = await supabase
    .from('technician_status')
    .select('estado, atendiendo_solicitud_id')
    .eq('tecnico_id', user.id)
    .maybeSingle()

  if (currentError) return { error: 'No se pudo leer tu estado. Inténtalo de nuevo.' }

  // Técnico sin fila de estado (caso borde): se crea con el estado pedido.
  if (!current) {
    const { error: insertError } = await supabase
      .from('technician_status')
      .insert({ tecnico_id: user.id, estado })
    if (insertError) return { error: 'No se pudo actualizar el estado.' }
    // Éxito: el cliente refresca la vista (sin redirect, evita recargas duras).
    return
  }

  // "Atendiendo" solo bloquea si de verdad hay una solicitud en proceso a su
  // nombre; un estado huérfano (la solicitud cambió por otra vía) se puede
  // sobreescribir o el técnico quedaría atascado.
  let huerfano = false
  if (current.estado === 'atendiendo') {
    const { data: activa, error: activaError } = await supabase
      .from('solicitudes')
      .select('id')
      .eq('tecnico_id', user.id)
      .eq('estado', 'en_proceso')
      .limit(1)
      .maybeSingle()

    if (activaError) return { error: 'No se pudo leer tu estado. Inténtalo de nuevo.' }
    if (activa) {
      return {
        error: 'No puedes cambiar tu estado mientras estás atendiendo una solicitud.',
      }
    }
    huerfano = true
  }

  // Condicional por si el estado cambió entre la lectura y el update.
  let query = supabase
    .from('technician_status')
    .update({ estado, atendiendo_solicitud_id: null })
    .eq('tecnico_id', user.id)
  if (huerfano) {
    query = current.atendiendo_solicitud_id
      ? query.eq('atendiendo_solicitud_id', current.atendiendo_solicitud_id)
      : query.is('atendiendo_solicitud_id', null)
  } else {
    query = query.neq('estado', 'atendiendo')
  }
  const { data, error } = await query.select('tecnico_id')

  if (error) return { error: 'No se pudo actualizar el estado.' }
  if (!data || data.length === 0) {
    return { error: 'Tu estado cambió mientras tanto. Actualiza la página.' }
  }

  // Éxito: el cliente refresca la vista (sin redirect, evita recargas duras).
  return
}

export async function atenderAhora(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const solicitudId = (formData.get('solicitud_id') as string | null) ?? ''
  if (!esUuidValido(solicitudId)) return { error: 'Solicitud no identificada.' }

  const auth = await autorizar(['tecnico'])
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth

  // RPC atómica (migración spec10): asigna la solicitud y actualiza el
  // estado del técnico en una sola transacción, first-write-wins.
  const { data: tomada, error } = await supabase.rpc('atender_solicitud', {
    p_solicitud_id: solicitudId,
  })

  if (error) return { error: 'No se pudo tomar la solicitud.' }

  if (!tomada) {
    // Otro técnico llegó primero — el cliente mostrará el toast y refrescará
    return { error: 'Este turno ya fue tomado por otro técnico.' }
  }

  // Éxito: el cliente refresca la cola/atención (sin redirect, evita recargas duras).
  return
}

export async function confirmarResolucionTecnico(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const solicitudId = (formData.get('solicitud_id') as string | null) ?? ''
  if (!esUuidValido(solicitudId)) return { error: 'Solicitud no identificada.' }

  const auth = await autorizar(['tecnico'])
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth

  const { data: fila, error: filaError } = await supabase
    .from('solicitudes')
    .select('confirmacion_trabajador')
    .eq('id', solicitudId)
    .eq('tecnico_id', user.id)
    .eq('estado', 'en_proceso')
    .maybeSingle()

  if (filaError) return { error: 'No se pudo guardar la resolución. Inténtalo de nuevo.' }
  if (!fila) {
    await liberarEstadoHuerfano(supabase, user.id, solicitudId)
    return { error: 'La solicitud ya cambió de estado. Actualiza la página.' }
  }

  const updates = fila.confirmacion_trabajador
    ? { confirmacion_tecnico: true, estado: 'solucionado' }
    : { confirmacion_tecnico: true }

  const { data, error } = await supabase
    .from('solicitudes')
    .update(updates)
    .eq('id', solicitudId)
    .eq('tecnico_id', user.id)
    .eq('estado', 'en_proceso')
    .select('id')

  if (error) return { error: 'No se pudo guardar la resolución. Inténtalo de nuevo.' }
  if (!data || data.length === 0) {
    await liberarEstadoHuerfano(supabase, user.id, solicitudId)
    return { error: 'La solicitud ya cambió de estado. Actualiza la página.' }
  }

  const { error: statusError } = await supabase
    .from('technician_status')
    .update({
      estado: 'disponible',
      atendiendo_solicitud_id: null,
    })
    .eq('tecnico_id', user.id)

  if (statusError) return { error: 'No se pudo actualizar tu estado.' }

  // Éxito: el cliente refresca la cola (sin redirect, evita recargas duras).
  return
}

export async function liberarSolicitud(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const solicitudId = (formData.get('solicitud_id') as string | null) ?? ''
  if (!esUuidValido(solicitudId)) return { error: 'Solicitud no identificada.' }

  const auth = await autorizar(['tecnico'])
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth

  // Condicionado a en_proceso: sin esa condición, liberar una solicitud ya
  // solucionada/cerrada la reabría (volvía a en_espera).
  const { data, error: solError } = await supabase
    .from('solicitudes')
    .update({ estado: 'en_espera', tecnico_id: null })
    .eq('id', solicitudId)
    .eq('tecnico_id', user.id)
    .eq('estado', 'en_proceso')
    .select('id')

  if (solError) return { error: 'No se pudo liberar la solicitud.' }
  if (!data || data.length === 0) {
    await liberarEstadoHuerfano(supabase, user.id, solicitudId)
    return { error: 'La solicitud ya cambió de estado. Actualiza la página.' }
  }

  const { error: statusError } = await supabase
    .from('technician_status')
    .update({
      estado: 'disponible',
      atendiendo_solicitud_id: null,
    })
    .eq('tecnico_id', user.id)

  if (statusError) return { error: 'No se pudo actualizar tu estado.' }

  // Éxito: el cliente refresca la cola (sin redirect, evita recargas duras).
  return
}

// SPEC 15, Cambio 2: el técnico dueño cambia el tipo de ayuda mientras atiende.
// Al pasar a presencial se limpia el código AnyDesk; al pasar a virtual sin
// código, el caso queda "esperando código" (lo deriva la UI/queries de otros
// pasos a partir de tipo_ayuda='virtual' ∧ anydesk_code IS NULL).
export async function cambiarTipoAyuda(
  solicitudId: string,
  nuevoTipo: string,
): Promise<ActionState> {
  if (!esUuidValido(solicitudId)) return { error: 'Solicitud no identificada.' }
  if (!TIPOS_AYUDA.includes(nuevoTipo as TipoAyuda)) {
    return { error: 'Tipo de ayuda no válido.' }
  }

  const auth = await autorizar(['tecnico'])
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth

  const updates =
    nuevoTipo === 'presencial'
      ? { tipo_ayuda: 'presencial', anydesk_code: null }
      : { tipo_ayuda: 'virtual' }

  // Solo el técnico dueño y solo mientras atiende (en_proceso). Condicional
  // optimista: 0 filas ⇒ el caso ya cambió de estado/dueño, recarga.
  const { data, error } = await supabase
    .from('solicitudes')
    .update(updates)
    .eq('id', solicitudId)
    .eq('tecnico_id', user.id)
    .eq('estado', 'en_proceso')
    .select('id')

  if (error) {
    return { error: 'No se pudo cambiar el tipo de ayuda. Inténtalo de nuevo.' }
  }
  if (!data || data.length === 0) {
    return { error: 'La solicitud ya cambió de estado. Actualiza la página.' }
  }

  // Éxito: el cliente refresca la card (sin redirect, evita recargas duras).
  return
}

// Si el técnico quedó "atendiendo" una solicitud que ya no es suya (cambió
// de estado por otra vía), restablece su estado para que no quede atascado
// (cambiarEstado bloquea cualquier cambio mientras está "atendiendo").
async function liberarEstadoHuerfano(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server')['createClient']>>,
  tecnicoId: string,
  solicitudId: string,
) {
  const { error } = await supabase
    .from('technician_status')
    .update({ estado: 'disponible', atendiendo_solicitud_id: null })
    .eq('tecnico_id', tecnicoId)
    .eq('atendiendo_solicitud_id', solicitudId)

  if (error) {
    console.error('liberarEstadoHuerfano: no se pudo restablecer el estado', error)
  }
}
