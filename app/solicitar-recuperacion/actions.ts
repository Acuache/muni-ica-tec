'use server'

import { createClient } from '@/lib/supabase/server'

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

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/actualizar-contrasena`,
  })

  // Siempre devuelve éxito para no revelar si el correo existe o no.
  return { success: true }
}
