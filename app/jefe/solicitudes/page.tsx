import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TablaSolicitudes from '../tabla-solicitudes'
import type { SolicitudTabla } from '../tabla-solicitudes'

export default async function JefeSolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; estado?: string }>
}) {
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

  const { page: pageParam, estado: estadoParam } = await searchParams
  const paginaActual = Math.max(1, parseInt(pageParam ?? '1', 10))
  const estadoFiltro = estadoParam && estadoParam !== 'todos' ? estadoParam : null
  const offset = (paginaActual - 1) * 10

  let solicitudesQuery = supabase
    .from('solicitudes')
    .select(
      'id, created_at, titulo, descripcion, estado, confirmacion_trabajador, confirmacion_tecnico, trabajador:profiles!trabajador_id(username, telefono, email, lugar, area, puesto), tecnico:profiles!tecnico_id(username, email)',
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + 9)

  let countQuery = supabase
    .from('solicitudes')
    .select('*', { count: 'exact', head: true })

  if (estadoFiltro) {
    solicitudesQuery = solicitudesQuery.eq('estado', estadoFiltro)
    countQuery = countQuery.eq('estado', estadoFiltro)
  }

  const [{ data: solicitudesRaw }, { count: totalItems }] = await Promise.all([
    solicitudesQuery,
    countQuery,
  ])

  type PerfilTrabajador = {
    username: string
    telefono: string | null
    email: string | null
    lugar: string | null
    area: string | null
    puesto: string | null
  }
  type PerfilTecnico = { username: string; email: string | null }

  const solicitudes: SolicitudTabla[] = (solicitudesRaw ?? []).map((s) => {
    const trabajador = s.trabajador as unknown as PerfilTrabajador | null
    const tecnico = s.tecnico as unknown as PerfilTecnico | null
    return {
      id: s.id,
      created_at: s.created_at,
      titulo: s.titulo,
      descripcion: s.descripcion ?? null,
      estado: s.estado,
      confirmacion_trabajador: s.confirmacion_trabajador,
      confirmacion_tecnico: s.confirmacion_tecnico,
      trabajador_nombre: trabajador?.username ?? '',
      trabajador_telefono: trabajador?.telefono ?? null,
      trabajador_email: trabajador?.email ?? null,
      trabajador_lugar: trabajador?.lugar ?? null,
      trabajador_area: trabajador?.area ?? null,
      trabajador_puesto: trabajador?.puesto ?? null,
      tecnico_nombre: tecnico?.username ?? null,
      tecnico_email: tecnico?.email ?? null,
    }
  })

  const totalPaginas = Math.max(1, Math.ceil((totalItems ?? 0) / 10))

  return (
    <TablaSolicitudes
      solicitudes={solicitudes}
      totalPaginas={totalPaginas}
      paginaActual={paginaActual}
      estadoFiltro={estadoFiltro}
    />
  )
}
