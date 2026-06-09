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
  anydesk_code: string | null
  trabajador: string
  telefono: string | null
  lugar: string
  area: string
  puesto: string
  confirmacionTecnico: boolean
}

export type SolicitudCola = {
  id: string
  titulo: string
  anydesk_code: string | null
  trabajador: string
  telefono: string | null
  lugar: string
  area: string
  puesto: string
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

  type PerfilTrabajador = {
    username: string
    telefono: string | null
    lugar: string | null
    area: string | null
    puesto: string | null
  }

  if (estadoTecnico === 'atendiendo') {
    const { data: sol } = await supabase
      .from('solicitudes')
      .select('id, titulo, anydesk_code, confirmacion_tecnico, profiles!trabajador_id(username, telefono, lugar, area, puesto)')
      .eq('tecnico_id', user.id)
      .eq('estado', 'en_proceso')
      .maybeSingle()

    if (sol) {
      const perfil = sol.profiles as unknown as PerfilTrabajador | null
      solicitudActiva = {
        id: sol.id,
        titulo: sol.titulo,
        anydesk_code: sol.anydesk_code ?? null,
        trabajador: perfil?.username ?? '',
        telefono: perfil?.telefono ?? null,
        lugar: perfil?.lugar ?? '',
        area: perfil?.area ?? '',
        puesto: perfil?.puesto ?? '',
        confirmacionTecnico: sol.confirmacion_tecnico ?? false,
      }
    }
  } else if (estadoTecnico !== 'descanso') {
    const { data: colaData } = await supabase
      .from('solicitudes')
      .select('id, titulo, anydesk_code, profiles!trabajador_id(username, telefono, lugar, area, puesto)')
      .eq('estado', 'en_espera')
      .order('created_at', { ascending: true })

    cola = (colaData ?? []).map((s) => {
      const perfil = s.profiles as unknown as PerfilTrabajador | null
      return {
        id: s.id,
        titulo: s.titulo,
        anydesk_code: s.anydesk_code ?? null,
        trabajador: perfil?.username ?? '',
        telefono: perfil?.telefono ?? null,
        lugar: perfil?.lugar ?? '',
        area: perfil?.area ?? '',
        puesto: perfil?.puesto ?? '',
      }
    })
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
