import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PANEL_POR_ROL, type RolApp } from '@/lib/autorizacion'
import type { AdjuntoVista } from '@/lib/adjuntos/tipos'
import TablaSolicitudes from '../tabla-solicitudes'
import type { SolicitudTabla } from '../tabla-solicitudes'

const ESTADOS_VALIDOS = [
  'en_espera',
  'en_proceso',
  'solucionado',
  'no_solucionado',
  'cancelado',
]

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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('primer_ingreso, rol')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw new Error('No se pudo cargar tu perfil. Recarga la página.')
  }

  if (profile?.primer_ingreso) redirect('/primer-ingreso')

  if (profile?.rol !== 'jefe') {
    redirect(PANEL_POR_ROL[profile?.rol as RolApp] ?? '/login')
  }

  // Parámetros de URL saneados: page no numérico cae a 1 y un estado fuera
  // del enum se ignora (antes ?page=abc producía un range NaN en la query).
  const { page: pageParam, estado: estadoParam } = await searchParams
  const pageNum = parseInt(pageParam ?? '1', 10)
  const paginaActual = Number.isNaN(pageNum) ? 1 : Math.max(1, pageNum)
  const estadoFiltro =
    estadoParam && ESTADOS_VALIDOS.includes(estadoParam) ? estadoParam : null
  const offset = (paginaActual - 1) * 10

  let solicitudesQuery = supabase
    .from('solicitudes')
    .select(
      'id, created_at, titulo, descripcion, estado, confirmacion_trabajador, confirmacion_tecnico, trabajador:profiles!trabajador_id(username, telefono, email, lugar, area, puesto), tecnico:profiles!tecnico_id(username, email), adjuntos:solicitud_adjuntos(id, tipo, nombre_original, tamano_bytes)',
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + 9)

  let countQuery = supabase
    .from('solicitudes')
    .select('id', { count: 'exact', head: true })

  if (estadoFiltro) {
    solicitudesQuery = solicitudesQuery.eq('estado', estadoFiltro)
    countQuery = countQuery.eq('estado', estadoFiltro)
  }

  const conteoMarcarTodosQuery =
    estadoFiltro === 'en_proceso'
      ? supabase
          .from('solicitudes')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'en_proceso')
          .or('confirmacion_trabajador.eq.true,confirmacion_tecnico.eq.true')
      : null

  const [solicitudesResult, countResult, conteoMarcarTodosResult] = await Promise.all([
    solicitudesQuery,
    countQuery,
    conteoMarcarTodosQuery ?? Promise.resolve({ count: 0, error: null }),
  ])

  if (solicitudesResult.error || countResult.error) {
    throw new Error('No se pudieron cargar las solicitudes. Recarga la página.')
  }

  // Conteo del botón masivo: si falla se degrada a 0 (el botón no aparece).
  if (conteoMarcarTodosResult.error) {
    console.error('JefeSolicitudesPage: conteo de marcar todos falló', conteoMarcarTodosResult.error)
  }

  const solicitudesRaw = solicitudesResult.data
  const totalItems = countResult.count
  const conteoMarcarTodos = estadoFiltro === 'en_proceso' ? (conteoMarcarTodosResult.count ?? 0) : 0

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
      adjuntos: (s.adjuntos as unknown as AdjuntoVista[]) ?? [],
    }
  })

  const totalPaginas = Math.max(1, Math.ceil((totalItems ?? 0) / 10))

  return (
    <TablaSolicitudes
      solicitudes={solicitudes}
      totalPaginas={totalPaginas}
      paginaActual={paginaActual}
      estadoFiltro={estadoFiltro}
      conteoMarcarTodos={conteoMarcarTodos}
    />
  )
}
