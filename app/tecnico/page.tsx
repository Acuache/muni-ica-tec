import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TecnicoPanel from './panel'

export type TecnicoEstado =
  | 'disponible'
  | 'atendiendo'
  | 'en_oficina'
  | 'virtual'
  | 'descanso'

export type SolicitudActiva = {
  id: string
  titulo: string
  area: string
  trabajador: string
}

export type SolicitudCola = {
  id: string
  titulo: string
  area: string
}

export default async function TecnicoPage() {
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

  // Inicio del día en UTC para el filtro FINALIZADAS HOY
  const hoyInicio = new Date()
  hoyInicio.setUTCHours(0, 0, 0, 0)

  const [
    { data: techStatus },
    { count: esperando },
    { count: finalizadasHoy },
  ] = await Promise.all([
    supabase
      .from('technician_status')
      .select('estado, atendiendo_solicitud_id')
      .eq('tecnico_id', user.id)
      .single(),
    supabase
      .from('solicitudes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'en_espera'),
    supabase
      .from('solicitudes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'solucionado')
      .gte('updated_at', hoyInicio.toISOString()),
  ])

  const estadoTecnico = (techStatus?.estado ?? 'disponible') as TecnicoEstado

  let solicitudActiva: SolicitudActiva | null = null
  let cola: SolicitudCola[] = []

  if (estadoTecnico === 'atendiendo') {
    const { data: sol } = await supabase
      .from('solicitudes')
      .select('id, titulo, trabajador_id, areas!area_id(nombre)')
      .eq('tecnico_id', user.id)
      .eq('estado', 'en_proceso')
      .maybeSingle()

    if (sol) {
      const { data: trabajador } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', sol.trabajador_id)
        .single()

      solicitudActiva = {
        id: sol.id,
        titulo: sol.titulo,
        area: (sol.areas as unknown as { nombre: string } | null)?.nombre ?? '',
        trabajador: trabajador?.username ?? '',
      }
    }
  } else if (estadoTecnico !== 'descanso') {
    const { data: colaData } = await supabase
      .from('solicitudes')
      .select('id, titulo, areas!area_id(nombre)')
      .eq('estado', 'en_espera')
      .order('created_at', { ascending: true })

    cola = (colaData ?? []).map((s) => ({
      id: s.id,
      titulo: s.titulo,
      area: (s.areas as unknown as { nombre: string } | null)?.nombre ?? '',
    }))
  }

  return (
    <TecnicoPanel
      estadoTecnico={estadoTecnico}
      esperando={esperando ?? 0}
      finalizadasHoy={finalizadasHoy ?? 0}
      solicitudActiva={solicitudActiva}
      cola={cola}
    />
  )
}
