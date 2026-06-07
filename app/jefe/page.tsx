import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import JefePanel from './panel'

export type SolicitudColaJefe = {
  id: string
  titulo: string
  area: string
  estado: 'en_espera' | 'en_proceso'
}

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('primer_ingreso')
    .eq('id', user.id)
    .single()

  if (profile?.primer_ingreso) redirect('/primer-ingreso')

  const hoyInicio = new Date()
  hoyInicio.setUTCHours(0, 0, 0, 0)

  const [
    { count: esperando },
    { count: solucionadosHoy },
    { count: noSolucionadosHoy },
    { data: colaRaw },
    { data: tecnicosRaw },
  ] = await Promise.all([
    supabase
      .from('solicitudes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'en_espera'),
    supabase
      .from('solicitudes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'solucionado')
      .gte('updated_at', hoyInicio.toISOString()),
    supabase
      .from('solicitudes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'no_solucionado')
      .gte('updated_at', hoyInicio.toISOString()),
    supabase
      .from('solicitudes')
      .select('id, titulo, estado, areas!area_id(nombre)')
      .in('estado', ['en_espera', 'en_proceso'])
      .order('created_at', { ascending: true }),
    supabase
      .from('technician_status')
      .select(
        'tecnico_id, estado, ubicacion, atendiendo_solicitud_id, updated_at, profiles!tecnico_id(username)',
      )
      .order('tecnico_id', { ascending: true }),
  ])

  // Resolve trabajador usernames for technicians currently 'atendiendo'
  const atendiendo = (tecnicosRaw ?? []).filter(
    (t) => t.estado === 'atendiendo' && t.atendiendo_solicitud_id,
  )

  const trabajadoresPorSolicitud: Record<string, string> = {}
  if (atendiendo.length > 0) {
    const ids = atendiendo.map((t) => t.atendiendo_solicitud_id as string)
    const { data: solicitudesActivas } = await supabase
      .from('solicitudes')
      .select('id, profiles!trabajador_id(username)')
      .in('id', ids)

    for (const sol of solicitudesActivas ?? []) {
      const username =
        (sol.profiles as unknown as { username: string } | null)?.username ??
        null
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

  const cola: SolicitudColaJefe[] = (colaRaw ?? []).map((s) => ({
    id: s.id,
    titulo: s.titulo,
    area: (s.areas as unknown as { nombre: string } | null)?.nombre ?? '',
    estado: s.estado as SolicitudColaJefe['estado'],
  }))

  return (
    <JefePanel
      esperando={esperando ?? 0}
      solucionadosHoy={solucionadosHoy ?? 0}
      noSolucionadosHoy={noSolucionadosHoy ?? 0}
      cola={cola}
      tecnicos={tecnicos}
    />
  )
}
