import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type RolApp = 'trabajador' | 'tecnico' | 'jefe'

/** Ruta del panel de cada rol (la fuente para redirigir roles equivocados). */
export const PANEL_POR_ROL: Record<RolApp, string> = {
  trabajador: '/trabajador',
  tecnico: '/tecnico',
  jefe: '/jefe',
}

export type Autorizacion =
  | {
      ok: true
      supabase: Awaited<ReturnType<typeof createClient>>
      user: User
      rol: RolApp
    }
  | { ok: false; error: string }

/**
 * Verifica en el servidor que hay sesión activa y que el rol del usuario
 * (leído de `profiles.rol`, no de metadata editable por el cliente) está
 * dentro de los permitidos. Toda Server Action debe pasar por aquí antes
 * de tocar la base (SPEC 10).
 */
export async function autorizar(roles: RolApp[]): Promise<Autorizacion> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return { ok: false, error: 'No se pudo verificar tu cuenta. Inténtalo de nuevo.' }
  }

  if (!roles.includes(profile.rol as RolApp)) {
    return { ok: false, error: 'No tienes permiso para realizar esta acción.' }
  }

  return { ok: true, supabase, user, rol: profile.rol as RolApp }
}
