'use server'

import { autorizar } from '@/lib/autorizacion'
import { createAdminClient } from '@/lib/supabase/admin'
import { esUuidValido } from '@/lib/validacion'

const BUCKET = 'solicitud-adjuntos'
const TTL_SEGUNDOS = 60

/**
 * Devuelve una URL firmada de corta duración para descargar un adjunto
 * (SPEC 12). La autorización la decide el RLS de `solicitud_adjuntos`:
 * el trabajador solo ve los suyos; técnico y jefe ven todos. Si no hay
 * fila visible, no está autorizado o el archivo ya no existe.
 */
export async function descargarAdjunto(
  adjuntoId: string,
): Promise<{ ok: true; url: string } | { error: string }> {
  if (!esUuidValido(adjuntoId)) return { error: 'Archivo no identificado.' }

  const auth = await autorizar(['trabajador', 'tecnico', 'jefe'])
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth

  const { data: adjunto, error } = await supabase
    .from('solicitud_adjuntos')
    .select('storage_path, nombre_original')
    .eq('id', adjuntoId)
    .maybeSingle()
  if (error) return { error: 'No se pudo preparar la descarga. Inténtalo de nuevo.' }
  if (!adjunto) return { error: 'Archivo no disponible.' }

  const admin = createAdminClient()
  const { data: firma, error: firmaError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(adjunto.storage_path, TTL_SEGUNDOS, {
      download: adjunto.nombre_original,
    })
  if (firmaError || !firma) return { error: 'No se pudo preparar la descarga.' }

  return { ok: true, url: firma.signedUrl }
}
