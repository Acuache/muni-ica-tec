'use server'

import { revalidatePath } from 'next/cache'
import { autorizar } from '@/lib/autorizacion'
import { ultimosMesesCerrados } from '@/lib/reportes/fechas'
import { generarReporteMensual } from '@/lib/reportes/generar'

export type ActionState = { error: string } | undefined

export async function generarReporteManual(
  { mes }: { mes: string },
): Promise<ActionState> {
  // generarReporteMensual escribe con el cliente service-role (sin RLS):
  // la verificación de rol aquí es la única barrera. No quitarla.
  const auth = await autorizar(['jefe'])
  if (!auth.ok) return { error: auth.error }

  if (!ultimosMesesCerrados(3).includes(mes)) {
    return { error: 'Mes no válido.' }
  }

  const resultado = await generarReporteMensual(mes)
  if ('error' in resultado) return { error: resultado.error }

  revalidatePath('/jefe/reportes')
}
