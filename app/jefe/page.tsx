import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PANEL_POR_ROL, type RolApp } from '@/lib/autorizacion'
import { inicioDeHoyLima } from '@/lib/reportes/fechas'
import JefePanel from './panel'

export type TecnicoCard = {
  id: string
  username: string
  estado: 'disponible' | 'atendiendo' | 'en_oficina' | 'virtual' | 'descanso'
  ubicacion: string | null
  updatedAt: string
  trabajadorUsername: string | null
}

export default async function JefePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('primer_ingreso, rol')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw new Error('No se pudo cargar tu perfil. Recarga la página.')
  }

  if (profile?.primer_ingreso) redirect('/primer-ingreso')

  // El proxy enruta por metadata (editable por el usuario); el rol real
  // se verifica aquí contra la base.
  if (profile?.rol !== 'jefe') {
    redirect(PANEL_POR_ROL[profile?.rol as RolApp] ?? '/login')
  }

  // Día "de hoy" según America/Lima, no medianoche UTC
  const hoyInicio = inicioDeHoyLima()

  const [esperandoResult, solucionadosResult, noSolucionadosResult, tecnicosResult] =
    await Promise.all([
      supabase
        .from('solicitudes')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'en_espera'),
      supabase
        .from('solicitudes')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'solucionado')
        .gte('updated_at', hoyInicio),
      supabase
        .from('solicitudes')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'no_solucionado')
        .gte('updated_at', hoyInicio),
      // !inner + filtros: la fila de technician_status se conserva al quitar el
      // rol o desactivar la cuenta, así que aquí se excluyen ex-técnicos y
      // técnicos desactivados.
      supabase
        .from('technician_status')
        .select(
          'tecnico_id, estado, ubicacion, atendiendo_solicitud_id, updated_at, profiles!tecnico_id!inner(username, rol, activo)',
        )
        .eq('profiles.rol', 'tecnico')
        .eq('profiles.activo', true)
        .order('tecnico_id', { ascending: true }),
    ])

  if (tecnicosResult.error) {
    throw new Error('No se pudo cargar el estado de los técnicos. Recarga la página.')
  }

  // KPIs: si un conteo falla se degrada a 0 sin tumbar el panel.
  for (const [nombre, result] of [
    ['esperando', esperandoResult],
    ['solucionados hoy', solucionadosResult],
    ['no solucionados hoy', noSolucionadosResult],
  ] as const) {
    if (result.error) console.error(`JefePage: conteo de ${nombre} falló`, result.error)
  }

  const esperando = esperandoResult.count
  const solucionadosHoy = solucionadosResult.count
  const noSolucionadosHoy = noSolucionadosResult.count
  const tecnicosRaw = tecnicosResult.data

  const atendiendo = (tecnicosRaw ?? []).filter(
    (t) => t.estado === 'atendiendo' && t.atendiendo_solicitud_id,
  )

  const trabajadoresPorSolicitud: Record<string, string> = {}
  if (atendiendo.length > 0) {
    const ids = atendiendo.map((t) => t.atendiendo_solicitud_id as string)
    const { data: solicitudesActivas, error: activasError } = await supabase
      .from('solicitudes')
      .select('id, profiles!trabajador_id(username)')
      .in('id', ids)

    // Dato secundario (nombre del trabajador atendido): se degrada a "—".
    if (activasError) {
      console.error('JefePage: lectura de solicitudes en atención falló', activasError)
    }

    for (const sol of solicitudesActivas ?? []) {
      const username =
        (sol.profiles as unknown as { username: string } | null)?.username ?? null
      if (username) trabajadoresPorSolicitud[sol.id] = username
    }
  }

  const tecnicos: TecnicoCard[] = (tecnicosRaw ?? [])
    .map((t) => ({
      id: t.tecnico_id,
      username:
        (t.profiles as unknown as { username: string } | null)?.username ?? '',
      estado: t.estado as TecnicoCard['estado'],
      ubicacion: t.ubicacion,
      updatedAt: t.updated_at,
      trabajadorUsername: t.atendiendo_solicitud_id
        ? (trabajadoresPorSolicitud[t.atendiendo_solicitud_id] ?? null)
        : null,
    }))
    .sort((a, b) => a.username.localeCompare(b.username))

  return (
    <JefePanel
      esperando={esperando ?? 0}
      solucionadosHoy={solucionadosHoy ?? 0}
      noSolucionadosHoy={noSolucionadosHoy ?? 0}
      tecnicos={tecnicos}
    />
  )
}
