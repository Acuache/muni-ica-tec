import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PANEL_POR_ROL, type RolApp } from '@/lib/autorizacion'
import TablaUsuarios, { type UsuarioFila } from '../tabla-usuarios'

const COLUMNAS =
  'id, username, email, telefono, rol, sede, area, subarea, puesto, primer_ingreso, activo'

export default async function JefeUsuariosBuscarPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    page?: string
    incluirDesactivados?: string
    sede?: string
  }>
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

  const {
    q: qParam,
    page: pageParam,
    incluirDesactivados: incParam,
    sede: sedeParam,
  } = await searchParams

  const incluirDesactivados = incParam === 'true'
  const sedeSeleccionada = (sedeParam ?? '').trim()
  const modoSede = sedeSeleccionada !== ''
  // Los dos modos son excluyentes: en modo sede se ignora la búsqueda por texto.
  // Se retiran , ( ) % del término: son separadores/comodines en la sintaxis
  // de .or() de PostgREST y romperían el filtro (SPEC 16).
  const q = modoSede ? '' : (qParam ?? '').replace(/[,()%]/g, '').trim()
  const pageNum = parseInt(pageParam ?? '1', 10)
  const paginaActual = Number.isNaN(pageNum) ? 1 : Math.max(1, pageNum)

  // Catálogo para el selector de sede y para los selects del modal de edición
  // (cliente de servidor autenticado, SPEC 13).
  const [sedesRes, areasRes, subareasRes] = await Promise.all([
    supabase.from('sedes').select('id, nombre').order('orden'),
    supabase.from('areas').select('id, sede_id, nombre').order('orden'),
    supabase.from('subareas').select('id, area_id, nombre').order('orden'),
  ])
  const sedes = sedesRes.data ?? []
  const areas = areasRes.data ?? []
  const subareas = subareasRes.data ?? []

  let filas: Omit<UsuarioFila, 'tieneSolicitudActiva'>[] = []
  let totalPaginas = 1

  if (modoSede) {
    // Modo sede: todas las cuentas de la sede, ordenadas por área (para agrupar)
    // y luego por nombre. Sin paginación: una sede está acotada.
    let listaQuery = supabase
      .from('profiles')
      .select(COLUMNAS)
      .eq('sede', sedeSeleccionada)
      .order('area', { ascending: true })
      .order('username', { ascending: true })

    if (!incluirDesactivados) listaQuery = listaQuery.eq('activo', true)

    const listaResult = await listaQuery
    if (listaResult.error) {
      throw new Error('No se pudieron cargar los usuarios. Recarga la página.')
    }
    filas = (listaResult.data ?? []) as Omit<UsuarioFila, 'tieneSolicitudActiva'>[]
  } else {
    // Modo texto: filtro por nombre/apellido, paginado de 10.
    const offset = (paginaActual - 1) * 10
    let listaQuery = supabase
      .from('profiles')
      .select(COLUMNAS)
      .order('username', { ascending: true })
      .range(offset, offset + 9)
    let countQuery = supabase.from('profiles').select('id', { count: 'exact', head: true })

    if (!incluirDesactivados) {
      listaQuery = listaQuery.eq('activo', true)
      countQuery = countQuery.eq('activo', true)
    }
    if (q) {
      // Coincidencia parcial por nombre O correo desde la misma caja (SPEC 16).
      const filtro = `username.ilike.%${q}%,email.ilike.%${q}%`
      listaQuery = listaQuery.or(filtro)
      countQuery = countQuery.or(filtro)
    }

    const [listaResult, countResult] = await Promise.all([listaQuery, countQuery])
    if (listaResult.error || countResult.error) {
      throw new Error('No se pudieron cargar los usuarios. Recarga la página.')
    }
    filas = (listaResult.data ?? []) as Omit<UsuarioFila, 'tieneSolicitudActiva'>[]
    totalPaginas = Math.max(1, Math.ceil((countResult.count ?? 0) / 10))
  }

  // Marcar qué cuentas tienen una solicitud activa (en_espera/en_proceso) para
  // que el modal de desactivar avise que se cancelará.
  const ids = filas.map((f) => f.id)
  let conSolicitudActiva = new Set<string>()
  if (ids.length > 0) {
    const { data: solRows } = await supabase
      .from('solicitudes')
      .select('trabajador_id')
      .in('trabajador_id', ids)
      .in('estado', ['en_espera', 'en_proceso'])
    conSolicitudActiva = new Set((solRows ?? []).map((r) => r.trabajador_id as string))
  }

  const usuarios: UsuarioFila[] = filas.map((f) => ({
    ...f,
    tieneSolicitudActiva: conSolicitudActiva.has(f.id),
  }))

  return (
    <TablaUsuarios
      usuarios={usuarios}
      totalPaginas={totalPaginas}
      paginaActual={paginaActual}
      q={q}
      incluirDesactivados={incluirDesactivados}
      sedes={sedes}
      areas={areas}
      subareas={subareas}
      sedeSeleccionada={sedeSeleccionada}
    />
  )
}
