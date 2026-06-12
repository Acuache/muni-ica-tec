'use server'

import { createClient } from '@/lib/supabase/server'
import { esEmailValido } from '@/lib/validacion'

export type SolicitarRecuperacionState =
  | { success: true }
  | { error: string }
  | undefined

export async function solicitarRecuperacion(
  _prevState: SolicitarRecuperacionState,
  formData: FormData,
): Promise<SolicitarRecuperacionState> {
  const email = (formData.get('email') as string | null)?.trim() ?? ''

  if (!email) {
    return { error: 'Escribe tu correo para continuar.' }
  }

  if (!esEmailValido(email)) {
    return { error: 'Escribe un correo válido.' }
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/actualizar-contrasena`,
  })

  // Se registra el fallo en el servidor, pero al usuario siempre se le
  // responde éxito para no revelar si el correo existe o no.
  if (error) {
    console.error('solicitarRecuperacion: resetPasswordForEmail falló', error)
  }

  return { success: true }
}
