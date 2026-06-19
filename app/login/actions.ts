'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { esEmailValido, MAX_PASSWORD } from '@/lib/validacion'

export type LoginState = { error: string } | undefined

const PANEL: Record<string, string> = {
  trabajador: '/trabajador',
  tecnico: '/tecnico',
  jefe: '/jefe',
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''

  if (!email || !password) {
    return { error: 'Completa todos los campos.' }
  }

  if (!esEmailValido(email)) {
    return { error: 'Escribe un correo válido.' }
  }

  if (password.length > MAX_PASSWORD) {
    return { error: 'Correo o contraseña incorrectos.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Correo o contraseña incorrectos.' }
  }

  const rol = data.user?.user_metadata?.rol as string | undefined
  const panel = rol ? PANEL[rol] : undefined

  if (!panel) {
    return { error: 'Rol de usuario no reconocido. Contacta al administrador.' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('primer_ingreso, activo')
    .eq('id', data.user.id)
    .single()

  // Cuenta desactivada (SPEC 14): cerrar sesión y bloquear el acceso. Defensa
  // en capas junto al ban de auth; el ban ya rechaza en signInWithPassword,
  // este chequeo cubre el caso de que ban y `activo` queden desincronizados.
  if (profile && profile.activo === false) {
    await supabase.auth.signOut()
    return {
      error: 'Tu cuenta está desactivada. Comunícate con el área de informática.',
    }
  }

  // Si no se puede leer el perfil, no se puede saber si debe pasar por el
  // primer ingreso: se le manda a /primer-ingreso, que redirige al panel
  // si ya lo completó (fallo seguro).
  if (profileError || profile?.primer_ingreso) {
    redirect('/primer-ingreso')
  }

  redirect(panel)
}
