'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MAX_PASSWORD, MIN_PASSWORD } from '@/lib/validacion'

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

  if (password.length < MIN_PASSWORD) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }
  }

  if (password.length > MAX_PASSWORD) {
    return { error: `La contraseña no puede superar ${MAX_PASSWORD} caracteres.` }
  }

  if (password !== confirmacion) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'No se pudo actualizar la contraseña. El link puede haber expirado.' }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: 'No se pudo actualizar la contraseña. El link puede haber expirado.' }
  }

  // Cerrar la sesión de recuperación: sin esto el proxy ve la sesión activa
  // y rebota /login al panel del rol (SPEC 04 exige terminar en /login).
  const { error: signOutError } = await supabase.auth.signOut()
  if (signOutError) {
    console.error('actualizarContrasena: signOut falló', signOutError)
  }

  redirect('/login')
}
