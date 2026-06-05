'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ActualizarContrasenaState = { error: string } | undefined

export async function actualizarContrasena(
  _prevState: ActualizarContrasenaState,
  formData: FormData,
): Promise<ActualizarContrasenaState> {
  const password = (formData.get('password') as string | null) ?? ''
  const confirmacion = (formData.get('confirmacion') as string | null) ?? ''

  if (!password) {
    return { error: 'Escribe la nueva contraseña.' }
  }

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  }

  if (password !== confirmacion) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: 'No se pudo actualizar la contraseña. El link puede haber expirado.' }
  }

  redirect('/login')
}
