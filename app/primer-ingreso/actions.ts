'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type PrimerIngresoState = { error: string } | undefined

const PANEL: Record<string, string> = {
  trabajador: '/trabajador',
  tecnico: '/tecnico',
  jefe: '/jefe',
}

export async function completarPrimerIngreso(
  _prevState: PrimerIngresoState,
  formData: FormData,
): Promise<PrimerIngresoState> {
  const telefono = (formData.get('telefono') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? ''

  if (!telefono) {
    return { error: 'El teléfono no puede estar vacío.' }
  }

  if (!email) {
    return { error: 'El correo no puede estar vacío.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (email !== user.email?.trim().toLowerCase()) {
    return { error: 'El correo no coincide con el registrado en tu cuenta.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ telefono, email, primer_ingreso: false })
    .eq('id', user.id)

  if (error) {
    return { error: 'No se pudo guardar la información. Inténtalo de nuevo.' }
  }

  const rol = user.user_metadata?.rol as string | undefined
  const panel = rol ? PANEL[rol] : undefined

  if (!panel) {
    return { error: 'Rol de usuario no reconocido. Contacta al administrador.' }
  }

  redirect(panel)
}
