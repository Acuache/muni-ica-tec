import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PANEL_POR_ROL, type RolApp } from '@/lib/autorizacion'
import { inicioDeHoyLima } from '@/lib/reportes/fechas'
import type { AdjuntoVista } from '@/lib/adjuntos/tipos'
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
  sede: string
  area: string
  subarea: string
  puesto: string
  adjuntos: AdjuntoVista[]
}

export type SolicitudCola = {
  id: string
  titulo: string
  anydesk_code: string | null
  trabajador: string
  telefono: string | null
  sede: string
  area: string
  subarea: string
  puesto: string
}

export default async function TecnicoPage() {
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
  if (profile?.rol !== 'tecnico') {
    redirect(PANEL_POR_ROL[profile?.rol as RolApp] ?? '/login')
  }

  const [statusResult, esperandoResult, finalizadasResult] = await Promise.all([
    supabase
      .from('technician_status')
      .select('estado, atendiendo_solicitud_id')
      .eq('tecnico_id', user.id)
      .maybeSingle(),
    supabase
      .from('solicitudes')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_espera'),
    supabase
      .from('solicitudes')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'solucionado')
      // Día "de hoy" según America/Lima, no medianoche UTC
      .gte('updated_at', inicioDeHoyLima()),
  ])

  if (statusResult.error) {
    throw new Error('No se pudo cargar tu estado. Recarga la página.')
  }

  // KPIs secundarios: si fallan se degradan a 0 sin tumbar el panel.
  if (esperandoResult.error) {
    console.error('TecnicoPage: conteo de en_espera falló', esperandoResult.error)
  }
  if (finalizadasResult.error) {
    console.error('TecnicoPage: conteo de finalizadas hoy falló', finalizadasResult.error)
  }

  const esperando = esperandoResult.count
  const finalizadasHoy = finalizadasResult.count

  // Sin fila de estado (caso borde): se asume disponible; cambiarEstado
  // crea la fila al primer cambio manual.
  const estadoTecnico = (statusResult.data?.estado ?? 'disponible') as TecnicoEstado

  let solicitudActiva: SolicitudActiva | null = null
  let cola: SolicitudCola[] = []

  type PerfilTrabajador = {
    username: string
    telefono: string | null
    sede: string | null
    area: string | null
    subarea: string | null
    puesto: string | null
  }

  if (estadoTecnico === 'atendiendo') {
    const { data: sol, error: solError } = await supabase
      .from('solicitudes')
      .select('id, titulo, anydesk_code, profiles!trabajador_id(username, telefono, sede, area, subarea, puesto)')
      .eq('tecnico_id', user.id)
      .eq('estado', 'en_proceso')
      .maybeSingle()

    if (solError) {
      throw new Error('No se pudo cargar la solicitud en atención. Recarga la página.')
    }

    if (sol) {
      const perfil = sol.profiles as unknown as PerfilTrabajador | null

      const { data: adjData, error: adjError } = await supabase
        .from('solicitud_adjuntos')
        .select('id, tipo, nombre_original, tamano_bytes')
        .eq('solicitud_id', sol.id)
        .order('created_at', { ascending: true })

      if (adjError) {
        console.error('TecnicoPage: lectura de adjuntos falló', adjError)
      }

      solicitudActiva = {
        id: sol.id,
        titulo: sol.titulo,
        anydesk_code: sol.anydesk_code ?? null,
        trabajador: perfil?.username ?? '',
        telefono: perfil?.telefono ?? null,
        sede: perfil?.sede ?? '',
        area: perfil?.area ?? '',
        subarea: perfil?.subarea ?? '',
        puesto: perfil?.puesto ?? '',
        adjuntos: (adjData as AdjuntoVista[]) ?? [],
      }
    }
  } else if (estadoTecnico !== 'descanso') {
    const { data: colaData, error: colaError } = await supabase
      .from('solicitudes')
      .select('id, titulo, anydesk_code, profiles!trabajador_id(username, telefono, sede, area, subarea, puesto)')
      .eq('estado', 'en_espera')
      .order('created_at', { ascending: true })

    if (colaError) {
      throw new Error('No se pudo cargar la cola de espera. Recarga la página.')
    }

    cola = (colaData ?? []).map((s) => {
      const perfil = s.profiles as unknown as PerfilTrabajador | null
      return {
        id: s.id,
        titulo: s.titulo,
        anydesk_code: s.anydesk_code ?? null,
        trabajador: perfil?.username ?? '',
        telefono: perfil?.telefono ?? null,
        sede: perfil?.sede ?? '',
        area: perfil?.area ?? '',
        subarea: perfil?.subarea ?? '',
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
