import { createAdminClient } from '@/lib/supabase/admin'
import { rangoMesLima, formatMesLabel, formatFechaLima } from './fechas'
import { construirPdfReporte, type FilaSolicitud, type ResumenMes } from './pdf'

export type ResultadoGeneracion = { ok: true } | { error: string }

const ESTADOS_CERRADOS = ['solucionado', 'no_solucionado'] as const

const MAX_REPORTES = 3

type PerfilTrabajador = {
  username: string
  lugar: string | null
  area: string | null
  puesto: string | null
}

type PerfilTecnico = { username: string } | null

type SolicitudCerrada = {
  titulo: string
  estado: 'solucionado' | 'no_solucionado'
  updated_at: string
  trabajador: PerfilTrabajador
  tecnico: PerfilTecnico
}

// Consulta las solicitudes cerradas (solucionado/no_solucionado) cuyo
// updated_at cae en [inicio, fin) y arma las filas + el resumen del PDF.
export async function obtenerFilasYResumen(
  inicio: string,
  fin: string,
): Promise<{ filas: FilaSolicitud[]; resumen: ResumenMes } | { error: string }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('solicitudes')
    .select(
      'titulo, estado, updated_at, trabajador:profiles!trabajador_id(username, lugar, area, puesto), tecnico:profiles!tecnico_id(username)',
    )
    .in('estado', ESTADOS_CERRADOS)
    .gte('updated_at', inicio)
    .lt('updated_at', fin)
    .order('updated_at', { ascending: true })

  if (error) return { error: error.message }

  const solicitudes = (data ?? []) as unknown as SolicitudCerrada[]

  const filas: FilaSolicitud[] = solicitudes.map((s) => ({
    fecha: formatFechaLima(s.updated_at),
    trabajador: s.trabajador.username,
    lugar: s.trabajador.lugar,
    area: s.trabajador.area,
    puesto: s.trabajador.puesto,
    titulo: s.titulo,
    tecnico: s.tecnico?.username ?? null,
    resultado: s.estado === 'solucionado' ? 'Solucionado' : 'No solucionado',
  }))

  const totalCerradas = filas.length
  const totalSolucionadas = filas.filter((f) => f.resultado === 'Solucionado').length
  const totalNoSolucionadas = totalCerradas - totalSolucionadas
  const resumen: ResumenMes = {
    totalCerradas,
    totalSolucionadas,
    totalNoSolucionadas,
    tasaExito:
      totalCerradas === 0 ? '—' : `${Math.round((totalSolucionadas / totalCerradas) * 100)} %`,
  }

  return { filas, resumen }
}

export async function generarReporteMensual(mesISO: string): Promise<ResultadoGeneracion> {
  const { inicio, fin } = rangoMesLima(mesISO)

  const resultado = await obtenerFilasYResumen(inicio, fin)
  if ('error' in resultado) return resultado

  const pdf = await construirPdfReporte(
    `Reporte mensual — ${formatMesLabel(mesISO)}`,
    resultado.resumen,
    resultado.filas,
  )

  const supabase = createAdminClient()
  const { error: uploadError } = await supabase.storage
    .from('reportes')
    .upload(`${mesISO}.pdf`, pdf, { contentType: 'application/pdf', upsert: true })

  if (uploadError) return { error: uploadError.message }

  return aplicarRetencion(supabase)
}

// Conserva los MAX_REPORTES nombres más recientes (orden lexicográfico
// "YYYY-MM.pdf") y borra el resto.
async function aplicarRetencion(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<ResultadoGeneracion> {
  const { data: archivos, error } = await supabase.storage.from('reportes').list()
  if (error) return { error: error.message }

  const nombres = (archivos ?? [])
    .map((archivo) => archivo.name)
    .filter((nombre) => /^\d{4}-\d{2}\.pdf$/.test(nombre))
    .sort()
    .reverse()

  const aBorrar = nombres.slice(MAX_REPORTES)
  if (aBorrar.length > 0) {
    const { error: removeError } = await supabase.storage.from('reportes').remove(aBorrar)
    if (removeError) return { error: removeError.message }
  }

  return { ok: true }
}
