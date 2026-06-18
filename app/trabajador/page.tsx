import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PANEL_POR_ROL, type RolApp } from '@/lib/autorizacion'
import type { AdjuntoVista } from '@/lib/adjuntos/tipos'
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

  const { data: solicitudActiva, error: solicitudError } = await supabase
    .from('solicitudes')
    .select('id, tipo_ayuda, titulo, descripcion, estado, tecnico_id, created_at')
    .eq('trabajador_id', user.id)
    .or('estado.eq.en_espera,and(estado.eq.en_proceso,confirmacion_trabajador.eq.false)')
    .limit(1)
    .maybeSingle()

  // Sin esta verificación, un fallo aquí mostraría el formulario de nueva
  // solicitud aunque ya exista una activa.
  if (solicitudError) {
    throw new Error('No se pudo cargar tu solicitud. Recarga la página.')
  }

  let posicionCola = 0
  let tecnicoNombre: string | null = null
  let adjuntos: AdjuntoVista[] = []

  if (solicitudActiva) {
    const tecnicoQuery = solicitudActiva.tecnico_id
      ? supabase
          .from('profiles')
          .select('username')
          .eq('id', solicitudActiva.tecnico_id)
          .single()
      : null

    const [posicionResult, tecnicoResult, adjuntosResult] = await Promise.all([
      supabase.rpc('get_posicion_en_cola', { p_solicitud_id: solicitudActiva.id }),
      tecnicoQuery,
      supabase
        .from('solicitud_adjuntos')
        .select('id, tipo, nombre_original, tamano_bytes')
        .eq('solicitud_id', solicitudActiva.id)
        .order('created_at', { ascending: true }),
    ])
    // Datos secundarios: si fallan se degrada a posición 0 / técnico sin
    // nombre / sin adjuntos en vez de tumbar el panel.
    if (posicionResult.error) {
      console.error('TrabajadorPage: get_posicion_en_cola falló', posicionResult.error)
    }
    if (tecnicoResult?.error) {
      console.error('TrabajadorPage: lectura de técnico falló', tecnicoResult.error)
    }
    if (adjuntosResult.error) {
      console.error('TrabajadorPage: lectura de adjuntos falló', adjuntosResult.error)
    }
    posicionCola = posicionResult.data ?? 0
    tecnicoNombre = tecnicoResult?.data?.username ?? null
    adjuntos = (adjuntosResult.data as AdjuntoVista[]) ?? []
  }

  return (
    <TrabajadorPanel
      solicitudActiva={solicitudActiva ?? null}
      posicionCola={posicionCola}
      tecnicoNombre={tecnicoNombre}
      adjuntos={adjuntos}
      sede={profile?.sede ?? null}
      area={profile?.area ?? null}
      subarea={profile?.subarea ?? null}
      puesto={profile?.puesto ?? null}
    />
  )
}
