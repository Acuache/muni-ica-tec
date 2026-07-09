import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PANEL_POR_ROL, type RolApp } from '@/lib/autorizacion'
import type { AdjuntoVista } from '@/lib/adjuntos/tipos'
import { estaEnHorario, proximaApertura } from '@/lib/horario'
import TrabajadorPanel from './panel'

export default async function TrabajadorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('primer_ingreso, rol, sede, area, subarea, puesto')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw new Error('No se pudo cargar tu perfil. Recarga la página.')
  }

  if (profile?.primer_ingreso) redirect('/primer-ingreso')

  // El proxy enruta por metadata (editable por el usuario); el rol real
  // se verifica aquí contra la base.
  if (profile?.rol !== 'trabajador') {
    redirect(PANEL_POR_ROL[profile?.rol as RolApp] ?? '/login')
  }

  // Incluye la en_proceso ya confirmada por el trabajador: si se ocultara, el
  // panel mostraría el formulario de nueva solicitud que el índice único
  // rechazaría ("ya tienes una solicitud activa").
  const { data: solicitudActiva, error: solicitudError } = await supabase
    .from('solicitudes')
    .select(
      'id, tipo_ayuda, titulo, descripcion, estado, tecnico_id, anydesk_code, confirmacion_trabajador, created_at',
    )
    .eq('trabajador_id', user.id)
    .in('estado', ['en_espera', 'en_proceso'])
    .limit(1)
    .maybeSingle()

  // Sin esta verificación, un fallo aquí mostraría el formulario de nueva
  // solicitud aunque ya exista una activa.
  if (solicitudError) {
    throw new Error('No se pudo cargar tu solicitud. Recarga la página.')
  }

  let posicionCola = 0
  let adjuntos: AdjuntoVista[] = []

  if (solicitudActiva) {
    const [posicionResult, adjuntosResult] = await Promise.all([
      supabase.rpc('get_posicion_en_cola', { p_solicitud_id: solicitudActiva.id }),
      supabase
        .from('solicitud_adjuntos')
        .select('id, tipo, nombre_original, tamano_bytes')
        .eq('solicitud_id', solicitudActiva.id)
        .order('created_at', { ascending: true }),
    ])
    // Datos secundarios: si fallan se degrada a posición 0 / sin adjuntos en
    // vez de tumbar el panel.
    if (posicionResult.error) {
      console.error('TrabajadorPage: get_posicion_en_cola falló', posicionResult.error)
    }
    if (adjuntosResult.error) {
      console.error('TrabajadorPage: lectura de adjuntos falló', adjuntosResult.error)
    }
    posicionCola = posicionResult.data ?? 0
    adjuntos = (adjuntosResult.data as AdjuntoVista[]) ?? []
  }

  // Horario de atención (SPEC 15, Cambio 3): se calcula con la hora del servidor
  // y se pasa ya resuelto al cliente (texto del próximo día hábil, en es-PE/Lima).
  const ahora = new Date()
  const fueraDeHorario = !estaEnHorario(ahora)
  let proximaAperturaTexto: string | null = null
  if (fueraDeHorario) {
    const partes = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).formatToParts(proximaApertura(ahora))
    const parte = (t: string) => partes.find((p) => p.type === t)?.value ?? ''
    proximaAperturaTexto = `${parte('weekday')} ${parte('day')} de ${parte('month')}`
  }

  return (
    <TrabajadorPanel
      solicitudActiva={solicitudActiva ?? null}
      posicionCola={posicionCola}
      adjuntos={adjuntos}
      sede={profile?.sede ?? null}
      area={profile?.area ?? null}
      subarea={profile?.subarea ?? null}
      puesto={profile?.puesto ?? null}
      fueraDeHorario={fueraDeHorario}
      proximaAperturaTexto={proximaAperturaTexto}
    />
  )
}
