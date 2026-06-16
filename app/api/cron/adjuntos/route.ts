import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'solicitud-adjuntos'
const DIAS_VENCIMIENTO = 21
const ESTADOS_CERRADOS = ['cancelado', 'solucionado', 'no_solucionado']
const CHUNK = 100

// Comparación en tiempo constante para no filtrar el secreto por timing.
function secretoValido(authHeader: string | null, cronSecret: string): boolean {
  const esperado = Buffer.from(`Bearer ${cronSecret}`)
  const recibido = Buffer.from(authHeader ?? '')
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido)
}

type FilaAdjunto = {
  id: string
  storage_path: string
  created_at: string
  solicitudes: { estado: string } | { estado: string }[] | null
}

/**
 * Borra los adjuntos cuya solicitud ya está cerrada o que superan los 21 días
 * (SPEC 12). Elimina SIEMPRE con la Storage API (remove) para liberar el
 * archivo físico, y solo entonces borra la fila. Usa el cliente admin
 * (service_role) porque el DELETE de la tabla está vedado a authenticated.
 */
async function limpiar(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || !secretoValido(authHeader, cronSecret)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()

  // La tabla se autolimita (lo cerrado/vencido se borra a diario), así que el
  // universo a evaluar es pequeño: adjuntos de solicitudes abiertas y recientes.
  const { data, error } = await admin
    .from('solicitud_adjuntos')
    .select('id, storage_path, created_at, solicitudes!inner(estado)')

  if (error) {
    return NextResponse.json({ error: 'No se pudieron leer los adjuntos.' }, { status: 500 })
  }

  const cutoff = Date.now() - DIAS_VENCIMIENTO * 24 * 60 * 60 * 1000
  const aEliminar = (data as unknown as FilaAdjunto[]).filter((a) => {
    const estado = Array.isArray(a.solicitudes)
      ? a.solicitudes[0]?.estado
      : a.solicitudes?.estado
    const cerrada = estado != null && ESTADOS_CERRADOS.includes(estado)
    const vencida = new Date(a.created_at).getTime() < cutoff
    return cerrada || vencida
  })

  let borrados = 0
  for (let i = 0; i < aEliminar.length; i += CHUNK) {
    const lote = aEliminar.slice(i, i + CHUNK)
    const paths = lote.map((a) => a.storage_path)
    const ids = lote.map((a) => a.id)

    const { error: rmError } = await admin.storage.from(BUCKET).remove(paths)
    if (rmError) {
      // Conservar las filas para reintentar en la próxima corrida.
      console.error('cron adjuntos: remove de Storage falló', rmError)
      continue
    }

    const { error: delError } = await admin
      .from('solicitud_adjuntos')
      .delete()
      .in('id', ids)
    if (delError) {
      console.error('cron adjuntos: delete de filas falló', delError)
      continue
    }

    borrados += lote.length
  }

  return NextResponse.json({ ok: true, evaluados: data.length, borrados })
}

// El cron llama por POST (net.http_post); GET queda para pruebas manuales.
export const GET = limpiar
export const POST = limpiar
