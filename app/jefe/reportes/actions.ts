'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ultimosMesesCerrados } from '@/lib/reportes/fechas'
import { generarReporteMensual } from '@/lib/reportes/generar'

export type ActionState = { error: string } | undefined

export async function generarReporteManual(
  { mes }: { mes: string },
): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada.' }

  if (!ultimosMesesCerrados(3).includes(mes)) {
    return { error: 'Mes no válido.' }
  }

  const resultado = await generarReporteMensual(mes)
  if ('error' in resultado) return { error: resultado.error }

  revalidatePath('/jefe/reportes')
}
